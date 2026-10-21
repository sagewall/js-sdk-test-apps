import Collection from "@arcgis/core/core/Collection.js";
import GeospatialPDFLayer from "@arcgis/core/layers/GeospatialPDFLayer.js";
import ActionButton from "@arcgis/core/support/actions/ActionButton.js";
import "@arcgis/map-components/components/arcgis-layer-list-next";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import "@esri/calcite-components/components/calcite-block";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-shell";
import "@esri/calcite-components/components/calcite-shell-panel";
import "@esri/calcite-components/components/calcite-switch";
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
let loading = false;
let dragDepth = 0;
let dropHandled = false;

// Add a trash action to each PDF's layer-list entry.
layerList.listItemCreatedFunction = ({ item }) => {
  if (!isGeospatialPDFLayer(item.layer)) return;
  // Each Collection added to actionsSections represents one group of actions.
  item.actionsSections.add(
    new Collection([
      new ActionButton({
        id: "remove-pdf",
        title: `Remove ${item.layer?.title}`,
        icon: "trash",
      }),
    ]),
  );
};

layerList.addEventListener("arcgisTriggerAction", (event) => {
  const { action, item } = event.detail;
  if (action.id !== "remove-pdf" || !isGeospatialPDFLayer(item.layer)) return;
  if (loading) {
    showStatus("Please wait", "Wait for the PDF to finish loading before removing a layer.");
    return;
  }
  const layer = item.layer;
  const title = layer.title ?? "Geospatial PDF";
  viewElement.map?.remove(layer);
  // Removing a layer does not destroy it; release its raster resources and object URL explicitly.
  layer.destroy();
  showStatus("PDF removed", title, "success");
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

// Both drag-and-drop and the file picker use the same loading workflow.
async function addPDF(files: File[] | FileList) {
  if (loading) {
    showStatus("Please wait", "A PDF is already loading. Drop your next file after it finishes.");
    return;
  }
  // The extension only filters obvious invalid input; layer.load() validates the PDF and its georeferencing.
  if (files.length !== 1 || !/\.pdf$/i.test(files[0].name)) {
    showStatus("Choose one PDF", "Drop a single file with a .pdf extension.", "danger");
    return;
  }

  const file = files[0];
  loading = true;
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
