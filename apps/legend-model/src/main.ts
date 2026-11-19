import { watch } from "@arcgis/core/core/reactiveUtils.js";
import * as sqlUtils from "@arcgis/core/core/sql.js";
import type Graphic from "@arcgis/core/Graphic.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter.js";
import type ActiveLayerInfo from "@arcgis/core/legend/ActiveLayerInfo.js";
import LegendModel from "@arcgis/core/legend/LegendModel.js";
import type { LegendElement, SymbolTableElementType } from "@arcgis/core/legend/types";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer.js";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol.js";
import type { ClickEvent } from "@arcgis/core/views/input/types.js";
import FeatureLayerView from "@arcgis/core/views/layers/FeatureLayerView.js";
import type LayerView from "@arcgis/core/views/layers/LayerView.js";
import type { ObjectId } from "@arcgis/core/views/types.js";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import "@esri/calcite-components/components/calcite-block";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-shell";
import "@esri/calcite-components/components/calcite-shell-panel";
import "./style.css";

// Constants

const countFormatter = new Intl.NumberFormat();

// Types

type AppliedSelectionFilter = {
  layers: Map<FeatureLayerView, SelectionFilter>;
  mode: SelectionFilterMode;
};

type SelectionFilter = {
  objectIds?: ObjectId[];
  where?: string;
};

type SelectionFilterMode = "features" | "categories";

// DOM references

const addLayerButton = document.querySelector<HTMLCalciteButtonElement>("#add-layer")!;
const categoryFilterHelp = document.getElementById("category-filter-help")!;
const clearMapSelection = document.querySelector<HTMLCalciteButtonElement>("#clear-map-selection")!;
const extentSummary = document.querySelector<HTMLCalciteListElement>("#extent-summary")!;
const extentSummaryStatus = document.getElementById("extent-summary-status")!;
const filterSelectedCategories = document.querySelector<HTMLCalciteButtonElement>(
  "#filter-selected-categories",
)!;
const filterSelectedFeatures = document.querySelector<HTMLCalciteButtonElement>(
  "#filter-selected-features",
)!;
const layerError = document.querySelector<HTMLCalciteNoticeElement>("#layer-error")!;
const legendSections = document.getElementById("legend-sections")!;
const removeSelectionFilter = document.querySelector<HTMLCalciteButtonElement>(
  "#remove-selection-filter",
)!;
const selectFeatures = document.querySelector<HTMLInputElement>("#select-features")!;
const selectedFeatures = document.querySelector<HTMLCalciteListElement>("#selected-features")!;
const selectionFilterStatus = document.getElementById("selection-filter-status")!;
const selectionStatus = document.getElementById("selection-status")!;
const viewElement = document.querySelector("arcgis-map")!;

// State

let appliedSelectionFilter: AppliedSelectionFilter | undefined;
let clickRevision = 0;
let countRequest: AbortController | undefined;
const highlights = new Map<FeatureLayerView, { remove(): void }>();
const layerSelections = new Map<string, Set<string>>();
const mapSelections = new Map<FeatureLayerView, Map<ObjectId, Graphic>>();
const renderedLayers = new Map<
  ActiveLayerInfo,
  { block: HTMLCalciteBlockElement; version: number }
>();

// Initialization

await viewElement.viewOnReady();
const view = viewElement.view;
const viewMap = view.map;
if (!viewMap) {
  throw new Error("The map view must have a map to initialize the legend sample.");
}
const map = viewMap;

const legendModel = new LegendModel({ view });
const popupDisabled = viewElement.popupDisabled;

// Watchers

// Layer identity tracks collection membership; version tracks legend content updates.
watch(
  () =>
    legendModel.activeLayerInfos.map((activeLayerInfo) => [
      activeLayerInfo,
      activeLayerInfo.version,
    ]),
  renderLegend,
  { initial: true },
);

watch(
  () => ({
    extent: view.stationary ? view.extent : null,
    layers: view.allLayerViews
      .toArray()
      .filter((layerView) => layerView instanceof FeatureLayerView)
      .map((layerView) => ({
        layer: layerView.layer,
        title: layerView.layer.title ?? "Untitled layer",
        visible: layerView.visible && !layerView.suspended,
        filter: layerView.filter,
        definitionExpression: layerView.layer.definitionExpression,
      })),
  }),
  async ({ extent, layers }) => {
    countRequest?.abort();
    extentSummary.replaceChildren();
    if (!extent) {
      extentSummaryStatus.textContent = "Counts refresh when the map stops moving.";
      return;
    }
    if (!layers.length) {
      extentSummaryStatus.textContent = "No feature layers in the map.";
      return;
    }

    const request = new AbortController();
    countRequest = request;
    extentSummaryStatus.textContent = "Updating feature counts.";
    const counts = layers.map(({ title, visible }) => {
      const item = document.createElement("calcite-list-item");
      item.label = title;
      item.description = visible ? "Counting features…" : "Not visible in this view";
      return item;
    });
    extentSummary.replaceChildren(...counts);
    await Promise.all(
      layers.map(async ({ layer, title, visible, filter }, index) => {
        if (!visible) {
          return;
        }

        try {
          const query = layer.createQuery();
          query.geometry = extent;
          query.spatialRelationship = "intersects";
          const options = { signal: request.signal };
          const filtered = filter?.where || filter?.objectIds?.length ? query.clone() : null;
          if (filtered && filter) {
            if (filter.where) {
              filtered.where = query.where
                ? `(${query.where}) AND (${filter.where})`
                : filter.where;
            }
            if (filter.objectIds?.length) {
              filtered.objectIds = filter.objectIds;
            }
          }
          // Use service counts for both queries so they cover the same extent and source data.
          const total = layer.queryFeatureCount(query, options);
          const shown = filtered ? layer.queryFeatureCount(filtered, options) : total;
          const [totalCount, shownCount] = await Promise.all([total, shown]);
          if (!request.signal.aborted) {
            counts[index].description =
              `${countFormatter.format(shownCount)} shown · ${countFormatter.format(totalCount - shownCount)} filtered out`;
          }
        } catch (error) {
          if (!request.signal.aborted) {
            console.error(`Failed to count features for ${title}`, error);
            counts[index].description = "Counts unavailable";
          }
        }
      }),
    );
    if (!request.signal.aborted) {
      extentSummaryStatus.textContent = "Feature counts updated.";
    }
  },
  { initial: true },
);

// Event listeners

addLayerButton.disabled = false;
addLayerButton.addEventListener("click", addCitiesLayer);
clearMapSelection.addEventListener("click", clearMapFeatureSelection);
filterSelectedCategories.addEventListener("click", () => applySelectionFilter("categories"));
filterSelectedFeatures.addEventListener("click", () => applySelectionFilter("features"));
removeSelectionFilter.addEventListener("click", clearAppliedSelectionFilter);
selectFeatures.addEventListener("change", updateSelectionMode);
view.on("click", selectMapFeature);
view.on("layerview-destroy", removeLayerViewSelection);

// Functions

async function addCitiesLayer() {
  addLayerButton.disabled = true;
  addLayerButton.loading = true;
  layerError.open = false;

  const layer = new FeatureLayer({
    url: "https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer/0",
    title: "Cities by class",
    outFields: ["areaname", "class"],
    renderer: new UniqueValueRenderer({
      field: "class",
      uniqueValueInfos: [
        { value: "city", color: "#d1495b" },
        { value: "city (consolidated, balance)", color: "#edae49" },
        { value: "CDP", color: "#00798c" },
        { value: "city and borough", color: "#30638e" },
        { value: "town", color: "#6a994e" },
        { value: "village", color: "#9b5de5" },
        { value: "city and county", color: "#f15bb5" },
        { value: "borough", color: "#8d6e63" },
        { value: "municipality", color: "#555555" },
      ].map(({ value, color }) => ({
        value,
        label: value,
        symbol: new SimpleMarkerSymbol({ color, size: 6 }),
      })),
    }),
  });

  try {
    await layer.load();
    map.add(layer);
    await viewElement.whenLayerView(layer);
    addLayerButton.textContent = "Cities layer added";
  } catch (error) {
    map.remove(layer);
    layer.destroy();
    console.error("Failed to add the cities layer", error);
    layerError.open = true;
    addLayerButton.disabled = false;
  } finally {
    addLayerButton.loading = false;
  }
}

function anyCategory(clauses: Iterable<string>) {
  return Array.from(clauses, (clause) => `(${clause})`).join(" OR ");
}

function appendLegendInfo(
  legendInfo: LegendElement | SymbolTableElementType,
  activeLayerInfo: ActiveLayerInfo,
  list: HTMLCalciteListElement,
  clearButton: HTMLCalciteButtonElement,
) {
  if ("preview" in legendInfo && legendInfo.preview) {
    const whereClause = getCategoryWhereClause(activeLayerInfo, legendInfo);

    if (whereClause) {
      const listItem = document.createElement("calcite-list-item");
      listItem.selected = layerSelections.get(activeLayerInfo.layer.uid)?.has(whereClause) ?? false;
      listItem.label =
        "label" in legendInfo && typeof legendInfo.label === "string"
          ? legendInfo.label
          : "Legend item";

      listItem.addEventListener("calciteListItemSelect", () => {
        // Copy this layer's selection, then add or remove the toggled category.
        const selectedClauses = new Set(layerSelections.get(activeLayerInfo.layer.uid) ?? []);

        if (listItem.selected) {
          selectedClauses.add(whereClause);
        } else {
          selectedClauses.delete(whereClause);
        }

        updateFilter(activeLayerInfo, selectedClauses);
        clearButton.hidden = selectedClauses.size === 0;
      });

      const symbol = document.createElement("div");
      symbol.className = "legend-symbol";
      symbol.slot = "content-start";

      // Clone the preview so the model retains its original node.
      symbol.appendChild(legendInfo.preview.cloneNode(true));

      listItem.appendChild(symbol);
      if (
        "value" in legendInfo &&
        (typeof legendInfo.value === "string" || typeof legendInfo.value === "number")
      ) {
        listItem.dataset.category = String(legendInfo.value);
      }
      list.appendChild(listItem);
    }
  }

  if ("type" in legendInfo && legendInfo.type === "symbol-table") {
    // Add nested categories to the same layer list.
    for (const childInfo of legendInfo.infos) {
      appendLegendInfo(childInfo, activeLayerInfo, list, clearButton);
    }
  }
}

function applyLayerFilter(layerView: FeatureLayerView) {
  const legendClauses = layerSelections.get(layerView.layer.uid);
  const selectionFilter = appliedSelectionFilter?.layers.get(layerView);
  const conditions = [legendClauses && anyCategory(legendClauses), selectionFilter?.where].filter(
    Boolean,
  );
  const where = conditions.map((condition) => `(${condition})`).join(" AND ");
  layerView.filter =
    where || selectionFilter?.objectIds
      ? new FeatureFilter({ where: where || undefined, objectIds: selectionFilter?.objectIds })
      : null;
}

function applySelectionFilter(mode: SelectionFilterMode) {
  const layers = new Map<FeatureLayerView, SelectionFilter>();
  if (mode === "features") {
    for (const [layerView, features] of mapSelections) {
      layers.set(layerView, { objectIds: [...features.keys()] });
    }
  } else {
    const { layers: categories, allMatched } = getSelectedCategories();
    if (!allMatched) {
      categoryFilterHelp.hidden = false;
      return;
    }
    for (const [layerView, clauses] of categories) {
      layers.set(layerView, { where: anyCategory(clauses.values()) });
    }
  }
  if (!layers.size) {
    return;
  }

  const affected = new Set([...(appliedSelectionFilter?.layers.keys() ?? []), ...layers.keys()]);
  appliedSelectionFilter = { mode, layers };
  for (const layerView of affected) {
    applyLayerFilter(layerView);
  }
  renderAppliedSelectionFilter();
}

function clearAppliedSelectionFilter() {
  const affected = appliedSelectionFilter?.layers.keys();
  appliedSelectionFilter = undefined;
  for (const layerView of affected ?? []) {
    applyLayerFilter(layerView);
  }
  renderAppliedSelectionFilter();
}

function clearMapFeatureSelection() {
  clickRevision++;
  mapSelections.clear();
  renderMapSelection();
}

function getCategoryWhereClause(
  activeLayerInfo: ActiveLayerInfo,
  legendInfo: LegendElement | SymbolTableElementType,
) {
  const layer = activeLayerInfo.layer;
  if (
    !(layer instanceof FeatureLayer) ||
    !layer.renderer ||
    !("field" in layer.renderer) ||
    typeof layer.renderer.field !== "string" ||
    !("value" in legendInfo)
  ) {
    return null;
  }

  return getValueWhereClause(layer.renderer.field, legendInfo.value);
}

function getSelectedCategories() {
  const layers = new Map<FeatureLayerView, Map<string, string>>();
  let allMatched = true;
  for (const [layerView, features] of mapSelections) {
    const renderer = layerView.layer.renderer;
    if (
      !(renderer instanceof UniqueValueRenderer) ||
      !renderer.field ||
      renderer.field2 ||
      renderer.field3 ||
      renderer.valueExpression
    ) {
      allMatched = false;
      continue;
    }

    const categories = new Map<string, string>();
    for (const graphic of features.values()) {
      const value = graphic.getAttribute(renderer.field);
      const clause = getValueWhereClause(renderer.field, value);
      if (
        !clause ||
        (typeof value !== "string" && typeof value !== "number") ||
        !renderer.uniqueValueInfos?.some((info) => String(info.value) === String(value))
      ) {
        allMatched = false;
        continue;
      }
      categories.set(String(value), clause);
    }
    layers.set(layerView, categories);
  }
  return { layers, allMatched };
}

function getValueWhereClause(field: string, value: unknown) {
  if (
    value === undefined ||
    (value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean" &&
      !(value instanceof Date))
  ) {
    return null;
  }

  // Use the stored category value; the label is only for display.
  const fieldName = sqlUtils.sqlName(field);
  // SQL equality does not match NULL, so use IS NULL for that category.
  if (value === null) {
    return `${fieldName} IS NULL`;
  }
  return `${fieldName} = ${sqlUtils.sqlLiteral(value)}`;
}

function removeLayerViewSelection({ layerView }: { layerView: LayerView }) {
  if (!(layerView instanceof FeatureLayerView)) {
    return;
  }
  if (appliedSelectionFilter?.layers.delete(layerView)) {
    if (!appliedSelectionFilter.layers.size) {
      appliedSelectionFilter = undefined;
    }
    renderAppliedSelectionFilter();
  }
  if (mapSelections.delete(layerView)) {
    renderMapSelection();
  }
}

function renderAppliedSelectionFilter() {
  removeSelectionFilter.disabled = !appliedSelectionFilter;
  selectionFilterStatus.textContent = !appliedSelectionFilter
    ? "No map selection filter applied."
    : appliedSelectionFilter.mode === "features"
      ? "Applied map filter: selected features."
      : "Applied map filter: matching legend categories.";
}

function renderLegend() {
  for (const [activeLayerInfo, { block }] of renderedLayers) {
    if (!legendModel.activeLayerInfos.includes(activeLayerInfo) || !activeLayerInfo.ready) {
      block.remove();
      renderedLayers.delete(activeLayerInfo);
    }
  }

  for (const activeLayerInfo of legendModel.activeLayerInfos) {
    if (!activeLayerInfo.ready) {
      continue;
    }

    const renderedLayer = renderedLayers.get(activeLayerInfo);
    if (renderedLayer?.version === activeLayerInfo.version) {
      legendSections.appendChild(renderedLayer.block);
      continue;
    }
    renderedLayer?.block.remove();

    // Create a separate multi-select list for each layer.
    const block = document.createElement("calcite-block");
    block.heading = activeLayerInfo.title ?? activeLayerInfo.layer.title ?? "Layer";
    block.expanded = true;
    const list = document.createElement("calcite-list");
    list.label = `${activeLayerInfo.title} legend items`;
    list.scale = "s";
    list.selectionMode = "multiple";
    list.selectionAppearance = "highlight";

    // Add a heading action to clear this layer's selections.
    const clearButton = document.createElement("calcite-button");
    clearButton.slot = "content-end";
    clearButton.appearance = "transparent";
    clearButton.scale = "s";
    clearButton.label = `Clear selections for ${activeLayerInfo.title}`;
    clearButton.textContent = "Clear Selection";
    clearButton.hidden = !layerSelections.get(activeLayerInfo.layer.uid)?.size;

    for (const legendInfo of activeLayerInfo.legendElements) {
      appendLegendInfo(legendInfo, activeLayerInfo, list, clearButton);
    }
    block.append(list, clearButton);
    legendSections.appendChild(block);
    renderedLayers.set(activeLayerInfo, { block, version: activeLayerInfo.version });

    clearButton.addEventListener("click", async () => {
      for (const listItem of list.querySelectorAll("calcite-list-item")) {
        listItem.selected = false;
      }
      updateFilter(activeLayerInfo, new Set());
      await list.setFocus();
      clearButton.hidden = true;
    });
  }
  renderLegendMapSelection(getSelectedCategories().layers);
}

function renderLegendMapSelection(layers: ReturnType<typeof getSelectedCategories>["layers"]) {
  for (const [activeLayerInfo, { block }] of renderedLayers) {
    const layerView = activeLayerInfo.layerView;
    const categories = layerView instanceof FeatureLayerView ? layers.get(layerView) : undefined;
    for (const row of block.querySelectorAll<HTMLCalciteListItemElement>(
      "calcite-list-item[data-category]",
    )) {
      const category = row.dataset.category;
      const selectedOnMap = category !== undefined && !!categories?.has(category);
      row.classList.toggle("map-selected", selectedOnMap);
      if (selectedOnMap) {
        row.setAttribute("aria-description", "Selected on map");
      } else {
        row.removeAttribute("aria-description");
      }
    }
  }
}

function renderMapSelection() {
  for (const handle of highlights.values()) {
    handle.remove();
  }
  highlights.clear();

  const items: HTMLCalciteListItemElement[] = [];
  for (const [layerView, features] of mapSelections) {
    highlights.set(layerView, layerView.highlight([...features.keys()]));
    const { displayField, title } = layerView.layer;
    for (const [objectId, graphic] of features) {
      const item = document.createElement("calcite-list-item");
      const name = displayField && graphic.getAttribute(displayField);
      item.label = String(name || `Feature ${objectId}`);
      item.description = title ?? undefined;
      items.push(item);
    }
  }

  selectedFeatures.replaceChildren(...items);
  selectedFeatures.hidden = items.length === 0;
  selectionStatus.textContent = items.length
    ? `${items.length} ${items.length === 1 ? "feature" : "features"} selected.`
    : "No features selected.";
  clearMapSelection.disabled = items.length === 0;
  filterSelectedFeatures.disabled = items.length === 0;
  const { layers, allMatched } = getSelectedCategories();
  filterSelectedCategories.disabled = items.length === 0 || !allMatched;
  categoryFilterHelp.hidden = items.length === 0 || allMatched;
  renderLegendMapSelection(layers);
}

async function selectMapFeature(event: ClickEvent) {
  if (!selectFeatures.checked) {
    return;
  }

  const revision = ++clickRevision;
  const layerViews = view.allLayerViews
    .filter((layerView) => layerView instanceof FeatureLayerView)
    .toArray();
  try {
    const { results } = await view.hitTest(event, {
      include: layerViews.map(({ layer }) => layer),
    });
    if (revision !== clickRevision) {
      return;
    }

    const hit = results.find((result) => result.type === "graphic" && !result.graphic.isAggregate);
    const layerView = hit && layerViews.find(({ layer }) => layer === hit.layer);
    const graphic = hit?.type === "graphic" ? hit.graphic : undefined;
    const objectId = graphic?.getObjectId();
    const toggle = event.native.ctrlKey || event.native.metaKey;
    if (!toggle) {
      mapSelections.clear();
    }
    if (layerView && view.allLayerViews.includes(layerView) && graphic && objectId != null) {
      const features = mapSelections.get(layerView) ?? new Map<ObjectId, Graphic>();
      if (toggle && features.has(objectId)) {
        features.delete(objectId);
      } else {
        features.set(objectId, graphic);
      }
      if (features.size) {
        mapSelections.set(layerView, features);
      } else {
        mapSelections.delete(layerView);
      }
    }
    renderMapSelection();
  } catch (error) {
    if (revision === clickRevision) {
      console.error("Failed to select a feature on the map", error);
      selectionStatus.textContent = "Unable to update the map selection. Please try again.";
    }
  }
}

function updateFilter(activeLayerInfo: ActiveLayerInfo, selectedClauses: Set<string>) {
  const layerId = activeLayerInfo.layer.uid;
  const layerView = activeLayerInfo.layerView;
  if (!(layerView instanceof FeatureLayerView)) {
    return;
  }

  if (!selectedClauses.size) {
    layerSelections.delete(layerId);
  } else {
    layerSelections.set(layerId, selectedClauses);
  }
  applyLayerFilter(layerView);
}

async function updateSelectionMode() {
  clickRevision++;
  viewElement.popupDisabled = selectFeatures.checked || popupDisabled;
  if (selectFeatures.checked) {
    try {
      await viewElement.closePopup();
    } catch (error) {
      console.error("Failed to close the popup when enabling map selection", error);
      selectionStatus.textContent = "Unable to close the popup. Please close it manually.";
    }
  }
}
