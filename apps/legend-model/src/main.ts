import { watch } from "@arcgis/core/core/reactiveUtils.js";
import * as sqlUtils from "@arcgis/core/core/sql.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter.js";
import type ActiveLayerInfo from "@arcgis/core/legend/ActiveLayerInfo.js";
import LegendModel from "@arcgis/core/legend/LegendModel.js";
import type { LegendElement, SymbolTableElementType } from "@arcgis/core/legend/types";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer.js";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol.js";
import FeatureLayerView from "@arcgis/core/views/layers/FeatureLayerView.js";
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

// Get the map view host and the container for generated legend sections.
const viewElement = document.querySelector("arcgis-map")!;
const legendSections = document.getElementById("legend-sections")!;
const addLayerButton = document.querySelector<HTMLCalciteButtonElement>("#add-layer")!;
const layerError = document.querySelector<HTMLCalciteNoticeElement>("#layer-error")!;

// Keep category selections independent for each layer.
const layerSelections = new Map<string, Set<string>>();

// Wait for the map view before creating its legend model.
await viewElement.viewOnReady();
const map = viewElement.view.map;
if (!map) {
  throw new Error("The map view must have a map to initialize the legend sample.");
}

const legendModel = new LegendModel({
  view: viewElement.view,
});
const renderedLayers = new Map<
  ActiveLayerInfo,
  { block: HTMLCalciteBlockElement; version: number }
>();

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

addLayerButton.disabled = false;
addLayerButton.addEventListener("click", async () => {
  addLayerButton.disabled = true;
  addLayerButton.loading = true;
  layerError.open = false;

  const layer = new FeatureLayer({
    url: "https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer/0",
    title: "Cities by class",
    outFields: ["class"],
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
});

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

  const value = legendInfo.value;
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
  const fieldName = sqlUtils.sqlName(layer.renderer.field);
  // SQL equality does not match NULL, so use IS NULL for that category.
  if (value === null) {
    return `${fieldName} IS NULL`;
  }
  return `${fieldName} = ${sqlUtils.sqlLiteral(value)}`;
}

function updateFilter(activeLayerInfo: ActiveLayerInfo, selectedClauses: Set<string>) {
  const layerId = activeLayerInfo.layer.uid;
  const layerView = activeLayerInfo.layerView;
  if (!(layerView instanceof FeatureLayerView)) {
    return;
  }

  if (!selectedClauses.size) {
    // With no categories selected, show all features in this layer.
    layerView.filter = null;
    layerSelections.delete(layerId);
    return;
  }

  // A feature is included when it matches any selected category.
  const where = Array.from(selectedClauses, (clause) => `(${clause})`).join(" OR ");
  layerView.filter = new FeatureFilter({ where });
  layerSelections.set(layerId, selectedClauses);
}
