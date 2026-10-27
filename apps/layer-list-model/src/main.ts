import { watch } from "@arcgis/core/core/reactiveUtils.js";
import LayerListModel from "@arcgis/core/layerList/LayerListModel.js";
import "@arcgis/map-components/components/arcgis-expand";
import "@arcgis/map-components/components/arcgis-legend";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import "@esri/calcite-components/components/calcite-block";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-shell";
import "@esri/calcite-components/components/calcite-shell-panel";
import "@esri/calcite-components/components/calcite-switch";
import "./style.css";

// Get the map component so the model can use its map view.
const viewElement = document.querySelector("arcgis-map")!;

// Wait until the map view is ready before using it.
await viewElement.viewOnReady();

// Create a model that provides information about the map's operational layers.
const layerListModel = new LayerListModel({
  view: viewElement.view,
});

// Convert the model's collection of operational items into a regular JavaScript array.
const layerItems = layerListModel.operationalItems.toArray();
const layerControls = document.getElementById("layer-controls")!;

// Match each layer title to the icon and description shown in its control.
const layerDetails = {
  "Parks and Open Space": {
    icon: "tree",
    description: "View parks and open-space areas.",
  },
  Trails: {
    icon: "walking",
    description: "View trail routes and biking-access categories.",
  },
  Trailheads: {
    icon: "map-pin",
    description: "View trail access points and parking categories.",
  },
} as const;

// Sort the layers alphabetically by title in the panel. This does not change their map order.
layerItems.sort(function (firstItem, secondItem) {
  return firstItem.title.localeCompare(secondItem.title);
});

for (const item of layerItems) {
  const details = Object.hasOwn(layerDetails, item.title)
    ? layerDetails[item.title as keyof typeof layerDetails]
    : undefined;
  const block = document.createElement("calcite-block");
  block.heading = item.title;

  // Use default values if the map contains a layer not listed in layerDetails.
  if (details) {
    block.iconStart = details.icon;
    block.description = details.description;
  } else {
    block.iconStart = "layers";
    block.description = "";
  }

  // Add a switch that lets the user show or hide this layer.
  const visibilitySwitch = document.createElement("calcite-switch");
  visibilitySwitch.label = item.title + " visibility";
  visibilitySwitch.slot = "actions-end";
  visibilitySwitch.addEventListener("calciteSwitchChange", function () {
    item.visible = visibilitySwitch.checked;
  });

  // Keep the switch up to date if the layer visibility changes elsewhere.
  watch(
    () => item.visible,
    (visible) => {
      visibilitySwitch.checked = visible;
    },
    // Set the switch to the layer's current visibility when it is created.
    { initial: true },
  );

  block.appendChild(visibilitySwitch);
  layerControls.appendChild(block);
}

// The Show all button turns on visibility for every operational layer.
document.getElementById("show-all")!.addEventListener("click", function () {
  for (let index = 0; index < layerItems.length; index++) {
    layerItems[index].visible = true;
  }
});

// The Hide all button turns off visibility for every operational layer.
document.getElementById("hide-all")!.addEventListener("click", function () {
  for (let index = 0; index < layerItems.length; index++) {
    layerItems[index].visible = false;
  }
});
