import { watch } from "@arcgis/core/core/reactiveUtils.js";
import * as sqlUtils from "@arcgis/core/core/sql.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
import FeatureFilter from "@arcgis/core/layers/support/FeatureFilter.js";
import type ActiveLayerInfo from "@arcgis/core/legend/ActiveLayerInfo.js";
import LegendModel from "@arcgis/core/legend/LegendModel.js";
import type { LegendElement, SymbolTableElementType } from "@arcgis/core/legend/types";
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

// Keep category selections independent for each layer.
const layerSelections = new Map<string, Set<string>>();

// Wait for the map view before creating its legend model.
await viewElement.viewOnReady();

const legendModel = new LegendModel({
  view: viewElement.view,
});
const renderedLayerIds = new Set();

// Re-render when layer readiness changes; renderLegend adds each ready layer once.
watch(
  () => legendModel.activeLayerInfos.map((activeLayerInfo) => activeLayerInfo.ready),
  renderLegend,
  { initial: true },
);

function renderLegend() {
  for (const activeLayerInfo of legendModel.activeLayerInfos) {
    // Skip layers whose legend is not ready or has already been rendered.
    if (!activeLayerInfo.ready || renderedLayerIds.has(activeLayerInfo.layer.uid)) {
      continue;
    }

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
    clearButton.hidden = true;

    for (const legendInfo of activeLayerInfo.legendElements) {
      appendLegendInfo(legendInfo, activeLayerInfo, list, clearButton);
    }
    block.append(list, clearButton);
    legendSections.appendChild(block);
    renderedLayerIds.add(activeLayerInfo.layer.uid);

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
