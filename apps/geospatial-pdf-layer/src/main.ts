import Collection from "@arcgis/core/core/Collection.js";
import GeospatialPDFLayer from "@arcgis/core/layers/GeospatialPDFLayer.js";
import MediaLayer from "@arcgis/core/layers/MediaLayer.js";
import Portal from "@arcgis/core/portal/Portal.js";
import PortalItem from "@arcgis/core/portal/PortalItem.js";
import ActionButton from "@arcgis/core/support/actions/ActionButton.js";
import WebMap from "@arcgis/core/WebMap.js";
import "@arcgis/map-components/components/arcgis-basemap-gallery";
import "@arcgis/map-components/components/arcgis-expand";
import "@arcgis/map-components/components/arcgis-layer-list-next";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import "@esri/calcite-components/components/calcite-block";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-input-text";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-link";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-shell";
import "@esri/calcite-components/components/calcite-shell-panel";
import "@esri/calcite-components/components/calcite-switch";
import { convertPDFToMediaLayer } from "./pdf-to-media";
import { createSaveableWebMap, isSaveCancelled } from "./save-webmap";
import "./style.css";

const viewElement = document.querySelector("arcgis-map")!;
const shell = document.querySelector("calcite-shell")!;
const chooseButton = document.querySelector<HTMLCalciteButtonElement>("#choose-file")!;
const fileInput = document.querySelector<HTMLInputElement>("#file-input")!;
const clipSwitch = document.querySelector<HTMLCalciteSwitchElement>("#clip")!;
const status = document.querySelector<HTMLCalciteNoticeElement>("#status")!;
const statusTitle = document.querySelector("#status-title")!;
const statusMessage = document.querySelector("#status-message")!;
const layerList = document.querySelector("arcgis-layer-list-next")!;
const saveButton = document.querySelector<HTMLCalciteButtonElement>("#save-webmap")!;
const titleInput = document.querySelector<HTMLCalciteInputTextElement>("#webmap-title")!;
const savedWebMapLink = document.querySelector<HTMLCalciteLinkElement>("#saved-webmap-link")!;
const webMap = new WebMap({ basemap: "topo" });
viewElement.map = webMap;
let loading = false;
let dragDepth = 0;
let dropHandled = false;

layerList.listItemCreatedFunction = ({ item }) => {
  const layer = item.layer;
  if (
    item.content.type !== "layer" ||
    (!isGeospatialPDFLayer(layer) && !(layer instanceof MediaLayer))
  )
    return;
  // Each Collection added to actionsSections represents one group of actions.
  item.actionsSections.add(
    new Collection([
      ...(isGeospatialPDFLayer(layer)
        ? [
            new ActionButton({
              id: "create-media-layer",
              title: "Create MediaLayer",
              icon: "media-layer",
            }),
          ]
        : []),
      new ActionButton({
        id: "remove-layer",
        title: `Remove ${layer.title}`,
        icon: "trash",
      }),
    ]),
  );
};

layerList.addEventListener("arcgisTriggerAction", (event) => {
  const { action, item } = event.detail;
  const layer = item.layer;
  if (action.id === "create-media-layer" && isGeospatialPDFLayer(layer)) {
    void addMediaLayer(layer);
    return;
  }
  if (
    action.id !== "remove-layer" ||
    (!isGeospatialPDFLayer(layer) && !(layer instanceof MediaLayer))
  )
    return;
  if (loading) {
    showStatus("Please wait", "Wait for the map operation to finish before removing a layer.");
    return;
  }
  const title = layer.title ?? "Geospatial PDF";
  viewElement.map?.remove(layer);
  // Removing a layer does not destroy it; release its raster resources and object URL explicitly.
  layer.destroy();
  showStatus("Layer removed", title, "success");
});

const statusIcons = {
  info: "information",
  danger: "exclamation-mark-triangle",
  success: "check-circle",
} satisfies Partial<
  Record<HTMLCalciteNoticeElement["kind"], NonNullable<HTMLCalciteNoticeElement["icon"]>>
>;

type StatusKind = keyof typeof statusIcons;

function showStatus(title: string, message: string, kind: StatusKind = "info") {
  status.kind = kind;
  status.icon = statusIcons[kind];
  statusTitle.textContent = title;
  statusMessage.textContent = message;
}

function updateSaveButton() {
  saveButton.disabled = loading || !titleInput.value.trim();
}

titleInput.addEventListener("calciteInputTextInput", updateSaveButton);
saveButton.addEventListener("click", async () => {
  if (loading || !titleInput.value.trim()) return;
  loading = true;
  updateSaveButton();
  saveButton.loading = true;
  titleInput.disabled = true;
  chooseButton.disabled = true;
  clipSwitch.disabled = true;
  savedWebMapLink.hidden = true;
  showStatus("Saving WebMap", "Connecting to ArcGIS Online");
  let snapshot: WebMap | undefined;
  try {
    const portal = new Portal({ url: "https://www.arcgis.com", authMode: "immediate" });
    await portal.load();
    await viewElement.viewOnReady();
    await webMap.updateFrom(viewElement.view);
    showStatus("Saving WebMap", "Preparing map images");
    snapshot = await createSaveableWebMap(webMap, viewElement.spatialReference);
    await snapshot.loadAll();
    const item = await snapshot.saveAs(
      new PortalItem({
        portal,
        title: titleInput.value.trim(),
        description:
          "Created with the geospatial PDF test app. PDF layers are saved as georeferenced images.",
      }),
    );
    if (!item.id) throw new Error("ArcGIS Online did not return a WebMap item ID.");
    savedWebMapLink.href = `https://www.arcgis.com/apps/mapviewer/index.html?webmap=${encodeURIComponent(item.id)}`;
    savedWebMapLink.hidden = false;
    showStatus("WebMap saved", item.title ?? titleInput.value.trim(), "success");
  } catch (error) {
    if (isSaveCancelled(error)) {
      showStatus("Save cancelled", "No WebMap was created.");
    } else {
      console.error("Unable to save WebMap", error);
      showStatus(
        "Unable to save WebMap",
        error instanceof Error ? error.message : String(error),
        "danger",
      );
    }
  } finally {
    snapshot?.destroy();
    loading = false;
    saveButton.loading = false;
    titleInput.disabled = false;
    chooseButton.disabled = false;
    clipSwitch.disabled = false;
    updateSaveButton();
  }
});

async function addMediaLayer(pdfLayer: GeospatialPDFLayer) {
  if (loading) {
    showStatus("Please wait", "A map operation is already in progress.");
    return;
  }
  loading = true;
  updateSaveButton();
  chooseButton.disabled = true;
  clipSwitch.disabled = true;
  showStatus("Creating MediaLayer", pdfLayer.title ?? "Geospatial PDF");
  let mediaLayer: MediaLayer | undefined;
  try {
    await viewElement.viewOnReady();
    const map = viewElement.map;
    if (!map) throw new Error("The map is not available.");
    mediaLayer = await convertPDFToMediaLayer(pdfLayer, viewElement.spatialReference);
    map.add(mediaLayer, map.layers.indexOf(pdfLayer) + 1);
    await viewElement.whenLayerView(mediaLayer);
    await mediaLayer.load();
    pdfLayer.visible = false;
    showStatus("MediaLayer created", mediaLayer.title ?? "PDF image", "success");
  } catch (error) {
    if (mediaLayer) {
      viewElement.map?.remove(mediaLayer);
      mediaLayer.destroy();
    }
    console.error("Unable to convert geospatial PDF", error);
    showStatus("Unable to create MediaLayer", String(error), "danger");
  } finally {
    loading = false;
    updateSaveButton();
    chooseButton.disabled = false;
    clipSwitch.disabled = false;
  }
}

// Both drag-and-drop and the file picker use the same loading workflow.
async function addPDF(files: File[] | FileList) {
  if (loading) {
    showStatus("Please wait", "A map operation is in progress. Drop your file after it finishes.");
    return;
  }
  // The extension only filters obvious invalid input; layer.load() validates the PDF and its georeferencing.
  if (files.length !== 1 || !/\.pdf$/i.test(files[0].name)) {
    showStatus("Choose one PDF", "Drop a single file with a .pdf extension.", "danger");
    return;
  }

  const file = files[0];
  loading = true;
  updateSaveButton();
  chooseButton.loading = true;
  chooseButton.disabled = true;
  showStatus("Loading PDF", file.name);
  let layer: GeospatialPDFLayer | undefined;

  try {
    // Read the local File in the browser, using its embedded georeferencing instead of manual placement.
    layer = new GeospatialPDFLayer({
      data: file,
      title: file.name,
      clippedToNeatline: clipSwitch.checked,
    });
    // Wait for the map component's underlying view before using its map and layer-view APIs.
    await viewElement.viewOnReady();
    await layer.load();
    // Loading derives the extent from embedded georeferencing; require it before adding and zooming.
    if (!layer.fullExtent) {
      throw new Error("The PDF did not provide a geographic extent.");
    }
    // Use the latest switch value, which may have changed during loading.
    layer.clippedToNeatline = clipSwitch.checked;
    viewElement.map?.add(layer);
    // Catch layer-view creation failures in the same cleanup path as PDF loading failures.
    await viewElement.whenLayerView(layer);

    try {
      // expand() mutates the extent; clone it to add a zoom margin without changing the layer's fullExtent.
      await viewElement.goTo(layer.fullExtent.clone().expand(1.1), {
        animate: false,
      });
      showStatus("PDF added", file.name, "success");
    } catch (error) {
      // Keep the loaded layer on the map even if zooming fails.
      console.error("Unable to zoom to PDF", error);
      showStatus("PDF added; zoom failed", String(error), "danger");
    }
  } catch (error) {
    // Release the failed layer, whether or not it was added, without affecting previously loaded PDFs.
    if (layer) {
      viewElement.map?.remove(layer);
      layer.destroy();
    }
    console.error("Unable to load geospatial PDF", error);
    showStatus("Unable to load PDF", String(error), "danger");
  } finally {
    loading = false;
    updateSaveButton();
    chooseButton.loading = false;
    chooseButton.disabled = false;
  }
}

chooseButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files ?? []);
  // Reset the input so selecting the same file again still fires a change event.
  fileInput.value = "";
  if (files.length) void addPDF(files);
});

// Clip all loaded PDFs to their neatlines, hiding page content outside the georeferenced map frames.
clipSwitch.addEventListener("calciteSwitchChange", () => {
  viewElement.map?.layers.forEach((layer) => {
    if (isGeospatialPDFLayer(layer)) {
      layer.clippedToNeatline = clipSwitch.checked;
    }
  });
});

viewElement.addEventListener("dragenter", (event) => {
  if (!event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  dropHandled = false;
  // Child elements also fire enter/leave events; count them to keep the prompt until the drag leaves the map.
  dragDepth++;
  if (!loading) showStatus("Drop your PDF", "Release the file to add it to the map.");
});
// Browsers only allow a drop when the target cancels dragover's default behavior.
viewElement.addEventListener("dragover", (event) => {
  if (!event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = loading ? "none" : "copy";
});
viewElement.addEventListener("drop", (event) => {
  if (!event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  dragDepth = 0;
  dropHandled = true;
  void addPDF(event.dataTransfer.files);
});
viewElement.addEventListener("dragleave", () => {
  // A leave event after a drop must not overwrite the loading or validation notice.
  if (dropHandled) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0 && !loading) {
    showStatus("Ready for a PDF", "Drop one georeferenced PDF onto the map or use Choose PDF.");
  }
});

// Prevent file drops outside the map from navigating away from the app.
function preventFileNavigation(event: DragEvent) {
  // Map-handled events bubble here already canceled; leave their drop effect unchanged.
  if (event.defaultPrevented || !event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "none";
}

shell.addEventListener("dragover", preventFileNavigation);
shell.addEventListener("drop", preventFileNavigation);

// Type guard to check if a layer is a GeospatialPDFLayer.
function isGeospatialPDFLayer(layer: unknown): layer is GeospatialPDFLayer {
  return (
    typeof layer === "object" &&
    layer !== null &&
    "type" in layer &&
    layer.type === "geospatial-pdf"
  );
}
