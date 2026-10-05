import { createDefaultControlPointsGeoreference } from "@arcgis/core/applications/MapViewer/mediaUtils.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import MediaLayer from "@arcgis/core/layers/MediaLayer.js";
import ControlPointsGeoreference from "@arcgis/core/layers/support/ControlPointsGeoreference.js";
import ImageElement from "@arcgis/core/layers/support/ImageElement.js";
import PortalItem from "@arcgis/core/portal/PortalItem.js";
import type MediaLayerInteractionOptions from "@arcgis/core/views/3d/layers/support/MediaLayerInteractionOptions.js";
import type MediaLayerView from "@arcgis/core/views/layers/MediaLayerView.js";
import WebMap from "@arcgis/core/WebMap.js";
import type { LayerListViewModelEvents } from "@arcgis/core/widgets/LayerList/LayerListViewModel.js";
import type LayerListItem from "@arcgis/core/widgets/LayerList/ListItem.js";
import "@arcgis/map-components/components/arcgis-layer-list-next";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-search";
import "@arcgis/map-components/components/arcgis-zoom";
import "@esri/calcite-components/components/calcite-action";
import "@esri/calcite-components/components/calcite-action-bar";
import "@esri/calcite-components/components/calcite-block";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-dialog";
import "@esri/calcite-components/components/calcite-input-number";
import "@esri/calcite-components/components/calcite-input-text";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-link";
import "@esri/calcite-components/components/calcite-loader";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-segmented-control";
import "@esri/calcite-components/components/calcite-segmented-control-item";
import "@esri/calcite-components/components/calcite-shell";
import "@esri/calcite-components/components/calcite-shell-panel";
import "@esri/calcite-components/components/calcite-switch";
import { createLatestWinsAsyncSetter } from "./interactive-state";
import "./style.css";

// ------------------------------
// Constants
// ------------------------------

const CONTROL_POINT_HISTORY_LIMIT = 10;
const CONTROL_POINT_INDEXES = [0, 1, 2, 3] as const;
const EXTENT_EXPAND_FACTOR = 1.2;

// ------------------------------
// Types
// ------------------------------

type AppState = {
  selectedMediaLayer: MediaLayer | null;
};

type ControlPointCoordinateSnapshot = {
  x: number;
  y: number;
};

type ControlPointInputRow = {
  row: HTMLDivElement;
  xInput: HTMLCalciteInputNumberElement;
  yInput: HTMLCalciteInputNumberElement;
};

type ControlPointSection = {
  emptyMessage: HTMLParagraphElement;
  rows: ControlPointInputRow[];
};

type ControlPointSnapshot = {
  mapPoint: ControlPointCoordinateSnapshot | null;
  sourcePoint: ControlPointCoordinateSnapshot | null;
};

type ControlPointsSnapshot = ControlPointSnapshot[];

type ControlPointType = "map" | "source";

type ToolType = "transform" | "reshape";

// ------------------------------
// DOM references and derived UI state
// ------------------------------

const addMediaLayerPanel =
  document.querySelector<HTMLCalcitePanelElement>("#add-media-layer-panel")!;
const cancelAddMediaLayerButton =
  document.querySelector<HTMLCalciteButtonElement>("#cancel-add-media-layer")!;
const createMediaLayerButton =
  document.querySelector<HTMLCalciteButtonElement>("#create-media-layer")!;
const editMediaPanel = document.querySelector<HTMLCalcitePanelElement>("#edit-media-panel")!;
const editMediaToolSegmentedControl = document.querySelector<HTMLCalciteSegmentedControlElement>(
  "#edit-media-tool-segmented-control",
)!;
const editSourcePointsSwitch = document.querySelector<HTMLCalciteSwitchElement>(
  "#edit-source-points-switch",
)!;
const layerListElement =
  document.querySelector<HTMLArcgisLayerListElement>("arcgis-layer-list-next")!;
const locationSearch = document.querySelector<HTMLArcgisSearchElement>("#media-location-search")!;
const mapControlPointsGrid = document.querySelector<HTMLDivElement>("#map-control-points-grid")!;
const mapElement = document.querySelector<HTMLArcgisMapElement>("arcgis-map")!;
const mapPointsSection = document.querySelector<HTMLCalciteBlockElement>("#map-points-section")!;
const mediaUrlInput = document.querySelector<HTMLCalciteInputTextElement>("#new-media-url")!;
const reshapePointControls = document.querySelector<HTMLDivElement>("#reshape-point-controls")!;
const redoControlPointEditsButton = document.querySelector<HTMLCalciteButtonElement>(
  "#redo-control-point-edits",
)!;
const saveErrorMessage = document.querySelector<HTMLDivElement>("#save-error-message")!;
const saveErrorNotice = document.querySelector<HTMLCalciteNoticeElement>("#save-error-notice")!;
const saveLoader = document.querySelector<HTMLCalciteLoaderElement>("#save-loader")!;
const saveResultsDialog = document.querySelector<HTMLCalciteDialogElement>("#save-results-dialog")!;
const saveSuccessLink = document.querySelector<HTMLCalciteLinkElement>("#save-success-link")!;
const saveSuccessNotice = document.querySelector<HTMLCalciteNoticeElement>("#save-success-notice")!;
const saveSuccessTitle = document.querySelector<HTMLDivElement>("#save-success-title")!;
const saveWebMapButton = document.querySelector<HTMLCalciteButtonElement>("#save-webmap")!;
const saveWebMapPanel = document.querySelector<HTMLCalcitePanelElement>("#save-webmap-panel")!;
const shellPanelEnd = document.querySelector<HTMLCalciteShellPanelElement>("#shell-panel-end")!;
const showAddMediaLayerAction = document.querySelector<HTMLCalciteActionElement>(
  "#show-add-media-layer-action",
)!;
const showEditMediaAction =
  document.querySelector<HTMLCalciteActionElement>("#show-edit-media-action")!;
const showSaveWebMapAction = document.querySelector<HTMLCalciteActionElement>(
  "#show-save-webmap-action",
)!;
const sourceControlPointsGrid = document.querySelector<HTMLDivElement>(
  "#source-control-points-grid",
)!;
const sourcePointsSection =
  document.querySelector<HTMLCalciteBlockElement>("#source-points-section")!;
const undoControlPointEditsButton = document.querySelector<HTMLCalciteButtonElement>(
  "#undo-control-point-edits",
)!;

const webMapTitleInput = document.querySelector<HTMLCalciteInputTextElement>(
  "#webmap-title-input-text",
)!;
renderControlPointRows();

const controlPointSections = [
  getControlPointSection("map"),
  getControlPointSection("source"),
] as const;
const [mapControlPointSection, sourceControlPointSection] = controlPointSections;
const setInteractiveLayer = createLatestWinsAsyncSetter<MediaLayer | null>(applyInteractiveLayer);
const state: AppState = {
  selectedMediaLayer: null,
};
const webMap = new WebMap({
  basemap: "streets-vector",
});
const workspaceActions = [showAddMediaLayerAction, showEditMediaAction, showSaveWebMapAction];
const workspacePanels = [addMediaLayerPanel, editMediaPanel, saveWebMapPanel];

// ------------------------------
// Mutable runtime state
// ------------------------------

let controlPointRedoStack: ControlPointsSnapshot[] = [];
let controlPointsWatchHandle: ReturnType<typeof reactiveUtils.watch> | null = null;
let controlPointUndoStack: ControlPointsSnapshot[] = [];
let isApplyingControlPointHistory = false;
let mediaLayerCount = 0;

// ------------------------------
// Initial app setup
// ------------------------------

mapElement.map = webMap;
await mapElement.viewOnReady();

layerListElement.listItemCreatedFunction = (event) => {
  if (!(event.item.layer instanceof MediaLayer)) {
    return;
  }

  event.item.actionsSections = [
    [
      {
        id: "zoom-to-media-layer",
        icon: "zoom-out-fixed",
        title: "Zoom to layer",
        type: "button",
      },
      {
        id: "reposition-media-layer",
        icon: "move",
        title: "Reposition layer",
        type: "button",
      },
      {
        id: "remove-media-layer",
        icon: "trash",
        title: "Remove layer",
        type: "button",
      },
    ],
  ];
};

// ------------------------------
// Event listeners and handlers
// ------------------------------

addMediaLayerPanel.addEventListener("calcitePanelClose", () => {
  closeWorkspacePanels();
  void setInteractiveLayer(null);
});

cancelAddMediaLayerButton.addEventListener("click", () => {
  closeWorkspacePanels();
  void setInteractiveLayer(null);
});

createMediaLayerButton.addEventListener("click", async () => {
  const mediaUrl = mediaUrlInput.value.trim();
  if (!mediaUrl) {
    return;
  }

  createMediaLayerButton.loading = true;

  try {
    const imageElement = new ImageElement({
      image: mediaUrl,
    });

    const georeference = await createDefaultControlPointsGeoreference(
      imageElement,
      getVisibleExtent().expand(EXTENT_EXPAND_FACTOR),
    );

    imageElement.georeference = georeference;

    const layer = new MediaLayer({
      source: imageElement,
      title: buildMediaLayerTitle(mediaUrl),
      opacity: 1,
    });

    webMap.layers.add(layer);
    state.selectedMediaLayer = layer;
    showEditMediaAction.disabled = false;

    closeWorkspacePanels();
    resetAddPanel();
  } catch (error) {
    console.error("Failed to add media layer:", error);
  } finally {
    createMediaLayerButton.loading = false;
    createMediaLayerButton.disabled = mediaUrlInput.value.trim().length === 0;
  }
});

editMediaPanel.addEventListener("calcitePanelClose", () => {
  closeWorkspacePanels();
  void setInteractiveLayer(null);
});

editMediaToolSegmentedControl.addEventListener("calciteSegmentedControlChange", async () => {
  if (!state.selectedMediaLayer) {
    return;
  }

  const nextTool = editMediaToolSegmentedControl.value as ToolType | undefined;
  if (!nextTool) {
    return;
  }

  try {
    const layerView = await getLayerView(state.selectedMediaLayer);
    layerView.interactionOptions.tool = nextTool;
    setSelectedTool(nextTool);

    if (nextTool === "reshape") {
      startControlPointsWatcher(state.selectedMediaLayer);
      refreshReshapePointUi(state.selectedMediaLayer);
      await syncEditSourcePointsSwitch(state.selectedMediaLayer);
    } else {
      stopControlPointsWatcher();
      clearControlPointDisplay();
    }
  } catch (error) {
    console.error("Failed to update media tool:", error);
  }
});

editSourcePointsSwitch.addEventListener("calciteSwitchChange", async () => {
  const layer = state.selectedMediaLayer;
  if (!layer) {
    return;
  }

  try {
    const layerView = await getLayerView(layer);
    setReshapeEditSourcePoints(layerView, editSourcePointsSwitch.checked);
    syncControlPointSectionExpansion();
  } catch (error) {
    console.error("Failed to update source point editing option:", error);
    await syncEditSourcePointsSwitch(layer);
  }
});

layerListElement.addEventListener("arcgisSelectedItemsChange", () => {
  const previousSelectedMediaLayerId = state.selectedMediaLayer?.id ?? null;
  state.selectedMediaLayer = getSelectedMediaLayer();
  const selectedMediaLayerId = state.selectedMediaLayer?.id ?? null;

  if (previousSelectedMediaLayerId !== selectedMediaLayerId) {
    resetControlPointHistory();
  }

  const isEditMediaPanelOpen = !editMediaPanel.closed && showEditMediaAction.active;

  if (!state.selectedMediaLayer) {
    showEditMediaAction.hidden = true;
    showEditMediaAction.disabled = true;
    closeWorkspacePanels();
    void setInteractiveLayer(null);
    resetEditControls();
    return;
  }

  showEditMediaAction.hidden = false;
  showEditMediaAction.disabled = false;

  if (isEditMediaPanelOpen) {
    void setInteractiveLayer(state.selectedMediaLayer);
    void syncEditControls();
    return;
  }

  void setInteractiveLayer(null);
});

layerListElement.addEventListener("arcgisTriggerAction", async (event) => {
  const triggerEvent = event as CustomEvent<LayerListViewModelEvents["trigger-action"]>;

  const layer = triggerEvent.detail.item.layer;
  if (!(layer instanceof MediaLayer)) {
    return;
  }

  switch (triggerEvent.detail.action.id) {
    case "zoom-to-media-layer":
      await zoomToLayer(layer);
      break;
    case "reposition-media-layer":
      await repositionLayer(layer);
      break;
    case "remove-media-layer":
      removeLayer(layer);
      break;
  }
});

mediaUrlInput.addEventListener("calciteInputTextInput", () => {
  createMediaLayerButton.disabled = mediaUrlInput.value.trim().length === 0;
});

redoControlPointEditsButton.addEventListener("click", () => {
  void redoControlPointEdits();
});

saveResultsDialog.addEventListener("calciteDialogClose", resetSaveDialog);

saveWebMapButton.addEventListener("click", async () => {
  saveWebMapButton.disabled = true;
  saveResultsDialog.open = true;
  resetSaveDialog();

  const saveMode = webMap.portalItem?.id ? "overwrite" : "create";
  setSaveDialogMode(saveMode);

  try {
    await webMap.updateFrom(mapElement.view);

    const title = webMapTitleInput.value || "Media Layer WebMap";
    const description = "WebMap created with the media-layer sample app.";

    let item: PortalItem;
    if (saveMode === "overwrite") {
      if (!webMap.portalItem) {
        throw new Error("No existing portal item available to overwrite.");
      }

      webMap.portalItem.title = title;
      webMap.portalItem.description = description;
      item = await webMap.save();
    } else {
      item = await webMap.saveAs(new PortalItem({ description, title }));
      webMap.portalItem = item;
    }

    const portalUrl = item.portal?.url;
    if (!portalUrl || !item.id) {
      throw new Error("The saved WebMap did not return portal metadata.");
    }

    saveSuccessLink.href = `${portalUrl}/home/item.html?id=${item.id}`;
    saveSuccessLink.textContent = item.title ?? "Open saved WebMap";
    saveLoader.hidden = true;
    saveSuccessNotice.open = true;
  } catch (error) {
    saveLoader.hidden = true;
    saveErrorMessage.textContent = error instanceof Error ? error.message : String(error);
    saveErrorNotice.open = true;
  } finally {
    saveWebMapButton.disabled = false;
  }
});

saveWebMapPanel.addEventListener("calcitePanelClose", () => {
  closeWorkspacePanels();
  void setInteractiveLayer(null);
});

showAddMediaLayerAction.addEventListener("click", () => {
  void setInteractiveLayer(null);
  toggleWorkspacePanel(showAddMediaLayerAction, addMediaLayerPanel);
});

showEditMediaAction.addEventListener("click", async () => {
  const selectedMediaLayer = getSelectedMediaLayer();
  if (selectedMediaLayer) {
    state.selectedMediaLayer = selectedMediaLayer;
  }

  if (!state.selectedMediaLayer) {
    return;
  }

  const wasOpen = !editMediaPanel.closed && showEditMediaAction.active;
  toggleWorkspacePanel(showEditMediaAction, editMediaPanel);

  if (wasOpen) {
    await setInteractiveLayer(null);
    return;
  }

  await setInteractiveLayer(state.selectedMediaLayer);
  await syncEditControls();
});

showSaveWebMapAction.addEventListener("click", () => {
  void setInteractiveLayer(null);
  toggleWorkspacePanel(showSaveWebMapAction, saveWebMapPanel);
});

undoControlPointEditsButton.addEventListener("click", () => {
  void undoControlPointEdits();
});

// ------------------------------
// Functions
// ------------------------------

async function applyControlPointEdits() {
  const layer = state.selectedMediaLayer;
  if (!layer) {
    return;
  }

  const georeference = getControlPointsGeoreference(layer);
  const controlPoints = georeference?.controlPoints;
  if (!georeference || !controlPoints?.length) {
    return;
  }

  const beforeSnapshot = isApplyingControlPointHistory
    ? null
    : getControlPointsSnapshot(controlPoints);

  CONTROL_POINT_INDEXES.forEach((index) => {
    const sectionRows = {
      map: mapControlPointSection.rows.at(index),
      source: sourceControlPointSection.rows.at(index),
    };
    const controlPoint = controlPoints.at(index);

    if (!controlPoint || !sectionRows.map || !sectionRows.source) {
      return;
    }

    updateMapPointFromRow(controlPoint, sectionRows.map);
    updateSourcePointFromRow(controlPoint, sectionRows.source);
  });

  if (!isApplyingControlPointHistory && beforeSnapshot) {
    const afterSnapshot = getControlPointsSnapshot(controlPoints);

    if (!areControlPointsSnapshotsEqual(beforeSnapshot, afterSnapshot)) {
      controlPointRedoStack = [];
      pushControlPointUndoSnapshot(beforeSnapshot);
      updateControlPointHistoryButtons();
    }
  }

  await refreshInteractiveEditState(layer);
}

function applyControlPointsSnapshot(
  controlPoints: NonNullable<ControlPointsGeoreference["controlPoints"]>,
  snapshot: ControlPointsSnapshot,
) {
  CONTROL_POINT_INDEXES.forEach((index) => {
    const controlPoint = controlPoints.at(index);
    const snapshotControlPoint = snapshot.at(index);

    if (!controlPoint || !snapshotControlPoint) {
      return;
    }

    const mapPoint = controlPoint.mapPoint;
    if (mapPoint && snapshotControlPoint.mapPoint) {
      mapPoint.x = snapshotControlPoint.mapPoint.x;
      mapPoint.y = snapshotControlPoint.mapPoint.y;
    }

    if (snapshotControlPoint.sourcePoint) {
      controlPoint.sourcePoint = {
        x: snapshotControlPoint.sourcePoint.x,
        y: snapshotControlPoint.sourcePoint.y,
      };
    }
  });
}

async function applyEditStateToLayer(layer: MediaLayer) {
  const layerView = await getLayerView(layer);
  const currentTool = layerView.interactionOptions.tool as ToolType | undefined;
  layerView.interactionOptions.tool = currentTool ?? "transform";
}

async function applyInteractiveLayer(targetLayer: MediaLayer | null) {
  const layers = webMap.layers.toArray();

  await Promise.all(
    layers.map(async (layer) => {
      if (!(layer instanceof MediaLayer)) {
        return;
      }

      const layerView = await getLayerView(layer);
      const isTarget = !!targetLayer && layer.id === targetLayer.id;
      layerView.interactive = isTarget;

      if (isTarget) {
        ensureSelectedElement(layer, layerView);
      }
    }),
  );

  if (!targetLayer) {
    stopControlPointsWatcher();
    clearControlPointDisplay();
  }
}

function areControlPointsSnapshotsEqual(left: ControlPointsSnapshot, right: ControlPointsSnapshot) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftControlPoint, index) => {
    const rightControlPoint = right.at(index);
    if (!rightControlPoint) {
      return false;
    }

    return (
      areCoordinateSnapshotsEqual(leftControlPoint.mapPoint, rightControlPoint.mapPoint) &&
      areCoordinateSnapshotsEqual(leftControlPoint.sourcePoint, rightControlPoint.sourcePoint)
    );
  });
}

function areCoordinateSnapshotsEqual(
  left: ControlPointCoordinateSnapshot | null,
  right: ControlPointCoordinateSnapshot | null,
) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.x === right.x && left.y === right.y;
}

function buildMediaLayerTitle(mediaUrl: string): string {
  mediaLayerCount += 1;
  const fallback = `Media Layer ${mediaLayerCount}`;

  try {
    const parsedUrl = new URL(mediaUrl);
    const fileName = parsedUrl.pathname.split("/").pop();

    return fileName ? `Media Layer ${mediaLayerCount}: ${decodeURIComponent(fileName)}` : fallback;
  } catch {
    return fallback;
  }
}

function clearControlPointDisplay() {
  controlPointSections.forEach(clearControlPointSection);
}

function clearControlPointSection(section: ControlPointSection) {
  section.emptyMessage.hidden = false;

  section.rows.forEach((inputRow) => {
    inputRow.row.hidden = true;
    inputRow.xInput.value = "";
    inputRow.yInput.value = "";
  });
}

function closeWorkspacePanels() {
  workspaceActions.forEach((action) => {
    action.active = false;
  });

  workspacePanels.forEach((panel) => {
    panel.closed = true;
  });

  shellPanelEnd.collapsed = true;
}

function createControlPointRow(type: ControlPointType, index: number) {
  const row = document.createElement("div");
  row.className = "control-point-row";
  row.id = `${type}-control-point-row-${index}`;

  const title = document.createElement("div");
  title.className = "control-point-title";
  title.textContent = `Point ${index + 1}`;

  const xLabel = createCoordinateField(type, index, "x");
  const yLabel = createCoordinateField(type, index, "y");

  row.append(title, xLabel, yLabel);
  return row;
}

function createCoordinateField(type: ControlPointType, index: number, axis: "x" | "y") {
  const label = document.createElement("calcite-label");
  label.scale = "s";
  label.textContent = axis.toUpperCase();

  const input = document.createElement("calcite-input-number");
  input.id = `${type}-control-point-${index}-${axis}`;
  input.integer = true;
  input.scale = "s";
  input.step = 1;
  input.addEventListener("calciteInputNumberChange", () => {
    void applyControlPointEdits();
  });

  label.append(input);
  return label;
}

function ensureSelectedElement(layer: MediaLayer, layerView: MediaLayerView) {
  if (layerView.selectedElement) {
    return;
  }

  const source = layer.source;
  if (source instanceof ImageElement) {
    layerView.selectedElement = source;
    return;
  }

  if (source && typeof source === "object" && "elements" in source) {
    const firstElement = source.elements?.at?.(0);
    if (firstElement) {
      layerView.selectedElement = firstElement;
    }
  }
}

function formatCoordinateValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "";
  }

  return Math.round(value).toString();
}

function getControlPointSection(type: ControlPointType): ControlPointSection {
  return {
    emptyMessage: document.querySelector<HTMLParagraphElement>(`#${type}-control-points-empty`)!,
    rows: CONTROL_POINT_INDEXES.map((index) => ({
      row: document.querySelector<HTMLDivElement>(`#${type}-control-point-row-${index}`)!,
      xInput: document.querySelector<HTMLCalciteInputNumberElement>(
        `#${type}-control-point-${index}-x`,
      )!,
      yInput: document.querySelector<HTMLCalciteInputNumberElement>(
        `#${type}-control-point-${index}-y`,
      )!,
    })),
  };
}

function getControlPointsGeoreference(layer: MediaLayer): ControlPointsGeoreference | null {
  const source = layer.source;
  if (!source || typeof source !== "object" || !("georeference" in source)) {
    return null;
  }

  const georeference = (source as { georeference?: unknown }).georeference;
  return georeference instanceof ControlPointsGeoreference ? georeference : null;
}

function getControlPointsSnapshot(
  controlPoints: NonNullable<ControlPointsGeoreference["controlPoints"]>,
): ControlPointsSnapshot {
  return controlPoints.map((controlPoint) => ({
    mapPoint: controlPoint.mapPoint
      ? {
          x: controlPoint.mapPoint.x,
          y: controlPoint.mapPoint.y,
        }
      : null,
    sourcePoint: controlPoint.sourcePoint
      ? {
          x: controlPoint.sourcePoint.x,
          y: controlPoint.sourcePoint.y,
        }
      : null,
  }));
}

async function getLayerView(layer: MediaLayer): Promise<MediaLayerView> {
  return (await mapElement.view.whenLayerView(layer)) as MediaLayerView;
}

function getMediaLayerInteractionOptions(layerView: MediaLayerView) {
  return layerView.interactionOptions as MediaLayerInteractionOptions;
}

function getNextCoordinateValue(currentValue: number, rawValue: string) {
  const parsedValue = Number.parseFloat(rawValue);
  return Number.isNaN(parsedValue) ? currentValue : parsedValue;
}

function getReshapeEditSourcePoints(layerView: MediaLayerView): boolean {
  const reshapeOptions = getMediaLayerInteractionOptions(layerView).reshapeOptions;

  return reshapeOptions?.editSourcePoints ?? true;
}

function getSelectedMediaLayer(): MediaLayer | null {
  const selectedItem: LayerListItem | undefined = layerListElement.selectedItems?.at(0);
  const layer = selectedItem?.layer;
  return layer instanceof MediaLayer ? layer : null;
}

function getVisibleExtent() {
  return mapElement.visibleArea?.extent?.clone() ?? mapElement.view.extent.clone();
}

async function refreshInteractiveEditState(layer: MediaLayer) {
  await setInteractiveLayer(null);
  await setInteractiveLayer(layer);
  await syncEditControls();
}

function refreshReshapePointUi(layer: MediaLayer) {
  updateControlPointDisplay(layer);
}

function removeLayer(layer: MediaLayer) {
  if (state.selectedMediaLayer?.id === layer.id) {
    state.selectedMediaLayer = null;
    showEditMediaAction.disabled = true;
    showEditMediaAction.active = false;
    editMediaPanel.closed = true;
    resetEditControls();
  }

  webMap.layers.remove(layer);
}

function renderControlPointRows() {
  mapControlPointsGrid.replaceChildren(
    ...CONTROL_POINT_INDEXES.map((index) => createControlPointRow("map", index)),
  );
  sourceControlPointsGrid.replaceChildren(
    ...CONTROL_POINT_INDEXES.map((index) => createControlPointRow("source", index)),
  );
}

async function repositionLayer(layer: MediaLayer) {
  try {
    await layer.load();

    const source = layer.source;
    if (!(source instanceof ImageElement)) {
      return;
    }

    const georeference = await createDefaultControlPointsGeoreference(
      source,
      getVisibleExtent().expand(EXTENT_EXPAND_FACTOR),
    );

    source.georeference = georeference;

    const isEditMediaPanelOpen = !editMediaPanel.closed && showEditMediaAction.active;
    const isSelectedMediaLayer = state.selectedMediaLayer?.id === layer.id;

    if (!isSelectedMediaLayer) {
      return;
    }

    resetControlPointHistory();

    if (isEditMediaPanelOpen) {
      await refreshInteractiveEditState(layer);
    }
  } catch (error) {
    console.error("Failed to reposition media layer:", layer.title, error);
  }
}

function resetAddPanel() {
  mediaUrlInput.value = "";
  locationSearch.clear();
  createMediaLayerButton.disabled = true;
}

function resetControlPointHistory() {
  controlPointRedoStack = [];
  controlPointUndoStack = [];
  updateControlPointHistoryButtons();
}

function resetEditControls() {
  editSourcePointsSwitch.checked = true;
  syncControlPointSectionExpansion();
  stopControlPointsWatcher();
  setSelectedTool("transform");
  clearControlPointDisplay();
}

function resetSaveDialog() {
  saveLoader.hidden = false;
  saveSuccessNotice.open = false;
  saveErrorNotice.open = false;
}

function setReshapeEditSourcePoints(layerView: MediaLayerView, value: boolean) {
  const interactionOptions = getMediaLayerInteractionOptions(layerView);

  if (!interactionOptions.reshapeOptions) {
    interactionOptions.reshapeOptions = {};
  }

  interactionOptions.reshapeOptions.editSourcePoints = value;
}

function setSaveDialogMode(mode: "create" | "overwrite") {
  const isOverwrite = mode === "overwrite";

  saveWebMapButton.textContent = isOverwrite ? "Overwrite WebMap" : "Save New WebMap";
  saveLoader.label = isOverwrite ? "Overwriting WebMap" : "Saving New WebMap";
  saveLoader.text = isOverwrite ? "Overwriting WebMap" : "Saving New WebMap";
  saveSuccessTitle.textContent = isOverwrite
    ? "The existing WebMap has been overwritten successfully"
    : "A new WebMap has been saved successfully";
}

function setSelectedTool(tool: ToolType) {
  const items = editMediaToolSegmentedControl.querySelectorAll(
    "calcite-segmented-control-item",
  ) as NodeListOf<HTMLCalciteSegmentedControlItemElement>;

  items.forEach((item) => {
    item.checked = item.value === tool;
  });

  editMediaToolSegmentedControl.value = tool;
  reshapePointControls.hidden = tool !== "reshape";
}

function pushControlPointUndoSnapshot(snapshot: ControlPointsSnapshot) {
  controlPointUndoStack.push(snapshot);

  if (controlPointUndoStack.length > CONTROL_POINT_HISTORY_LIMIT) {
    controlPointUndoStack.shift();
  }
}

async function redoControlPointEdits() {
  const layer = state.selectedMediaLayer;
  if (!layer || !controlPointRedoStack.length) {
    return;
  }

  const georeference = getControlPointsGeoreference(layer);
  const controlPoints = georeference?.controlPoints;
  if (!controlPoints?.length) {
    resetControlPointHistory();
    return;
  }

  const redoSnapshot = controlPointRedoStack.pop();
  if (!redoSnapshot) {
    return;
  }

  pushControlPointUndoSnapshot(getControlPointsSnapshot(controlPoints));

  isApplyingControlPointHistory = true;

  try {
    applyControlPointsSnapshot(controlPoints, redoSnapshot);
    await refreshInteractiveEditState(layer);
  } finally {
    isApplyingControlPointHistory = false;
  }

  updateControlPointHistoryButtons();
}

function showPanel(action: HTMLCalciteActionElement, panel: HTMLCalcitePanelElement) {
  workspaceActions.forEach((currentAction) => {
    currentAction.active = currentAction === action;
  });

  workspacePanels.forEach((currentPanel) => {
    currentPanel.closed = currentPanel !== panel;
  });

  shellPanelEnd.collapsed = false;
}

function startControlPointsWatcher(layer: MediaLayer) {
  stopControlPointsWatcher();

  controlPointsWatchHandle = reactiveUtils.watch(
    () => {
      const georeference = getControlPointsGeoreference(layer);
      const controlPoints = georeference?.controlPoints;

      if (!controlPoints?.length) {
        return "no-control-points";
      }

      const pointsToken = controlPoints
        .map((controlPoint, index) => {
          const sourcePoint = controlPoint.sourcePoint;
          const mapPoint = controlPoint.mapPoint;
          return [index, sourcePoint?.x, sourcePoint?.y, mapPoint?.x, mapPoint?.y].join(":");
        })
        .join("|");

      return pointsToken;
    },
    () => {
      refreshReshapePointUi(layer);
    },
    {
      initial: true,
    },
  );
}

function stopControlPointsWatcher() {
  controlPointsWatchHandle?.remove();
  controlPointsWatchHandle = null;
}

function syncControlPointSectionExpansion() {
  const isEditingSourcePoints = editSourcePointsSwitch.checked;

  mapPointsSection.expanded = !isEditingSourcePoints;
  sourcePointsSection.expanded = isEditingSourcePoints;
}

async function syncEditControls() {
  if (!state.selectedMediaLayer) {
    resetEditControls();
    return;
  }

  try {
    await applyEditStateToLayer(state.selectedMediaLayer);

    const layerView = await getLayerView(state.selectedMediaLayer);
    const currentTool = layerView.interactionOptions.tool as ToolType | undefined;
    const activeTool = currentTool ?? "transform";

    setSelectedTool(activeTool);

    if (activeTool === "reshape") {
      startControlPointsWatcher(state.selectedMediaLayer);
      refreshReshapePointUi(state.selectedMediaLayer);
      await syncEditSourcePointsSwitch(state.selectedMediaLayer);
    } else {
      stopControlPointsWatcher();
      clearControlPointDisplay();
    }
  } catch (error) {
    console.error("Failed to sync edit controls:", error);
    resetEditControls();
  }
}

async function syncEditSourcePointsSwitch(layer: MediaLayer) {
  const layerView = await getLayerView(layer);
  editSourcePointsSwitch.checked = getReshapeEditSourcePoints(layerView);
  syncControlPointSectionExpansion();
}

function toggleWorkspacePanel(action: HTMLCalciteActionElement, panel: HTMLCalcitePanelElement) {
  if (!panel.closed && action.active) {
    closeWorkspacePanels();
    return;
  }

  showPanel(action, panel);
}

async function undoControlPointEdits() {
  const layer = state.selectedMediaLayer;
  if (!layer || !controlPointUndoStack.length) {
    return;
  }

  const georeference = getControlPointsGeoreference(layer);
  const controlPoints = georeference?.controlPoints;
  if (!controlPoints?.length) {
    resetControlPointHistory();
    return;
  }

  const undoSnapshot = controlPointUndoStack.pop();
  if (!undoSnapshot) {
    return;
  }

  controlPointRedoStack.push(getControlPointsSnapshot(controlPoints));

  isApplyingControlPointHistory = true;

  try {
    applyControlPointsSnapshot(controlPoints, undoSnapshot);
    await refreshInteractiveEditState(layer);
  } finally {
    isApplyingControlPointHistory = false;
  }

  updateControlPointHistoryButtons();
}

function updateControlPointDisplay(layer: MediaLayer) {
  const georeference = getControlPointsGeoreference(layer);
  const controlPoints = georeference?.controlPoints;

  if (!controlPoints?.length) {
    clearControlPointDisplay();
    return;
  }

  const sectionTypes: Array<[ControlPointSection, ControlPointType]> = [
    [mapControlPointSection, "map"],
    [sourceControlPointSection, "source"],
  ];

  sectionTypes.forEach(([section, type]) => {
    updateControlPointSection(section, controlPoints, type);
  });
}

function updateControlPointHistoryButtons() {
  redoControlPointEditsButton.disabled = controlPointRedoStack.length === 0;
  undoControlPointEditsButton.disabled = controlPointUndoStack.length === 0;
}

function updateControlPointSection(
  section: ControlPointSection,
  controlPoints: NonNullable<ControlPointsGeoreference["controlPoints"]>,
  type: ControlPointType,
) {
  section.emptyMessage.hidden = true;

  section.rows.forEach((inputRow, index) => {
    const controlPoint = controlPoints.at(index);
    const point = type === "map" ? controlPoint?.mapPoint : controlPoint?.sourcePoint;
    const hasValues = point?.x != null && point?.y != null;

    inputRow.row.hidden = !hasValues;
    inputRow.xInput.value = formatCoordinateValue(point?.x);
    inputRow.yInput.value = formatCoordinateValue(point?.y);
  });
}

function updateMapPointFromRow(
  controlPoint: NonNullable<ControlPointsGeoreference["controlPoints"]>[number],
  row: ControlPointInputRow,
) {
  const mapPoint = controlPoint.mapPoint;
  if (!mapPoint) {
    return;
  }

  mapPoint.x = getNextCoordinateValue(mapPoint.x, row.xInput.value);
  mapPoint.y = getNextCoordinateValue(mapPoint.y, row.yInput.value);
}

function updateSourcePointFromRow(
  controlPoint: NonNullable<ControlPointsGeoreference["controlPoints"]>[number],
  row: ControlPointInputRow,
) {
  const sourcePoint = controlPoint.sourcePoint;
  if (!sourcePoint) {
    return;
  }

  const nextSourcePoint = {
    x: getNextCoordinateValue(sourcePoint.x, row.xInput.value),
    y: getNextCoordinateValue(sourcePoint.y, row.yInput.value),
  };

  if (nextSourcePoint.x !== sourcePoint.x || nextSourcePoint.y !== sourcePoint.y) {
    controlPoint.sourcePoint = nextSourcePoint;
  }
}

async function zoomToLayer(layer: MediaLayer) {
  try {
    await layer.load();

    const targetExtent = layer.fullExtent;
    if (!targetExtent) {
      return;
    }

    await mapElement.view.goTo(targetExtent.expand(EXTENT_EXPAND_FACTOR));
  } catch (error) {
    console.error("Failed to zoom to media layer:", layer.title, error);
  }
}
