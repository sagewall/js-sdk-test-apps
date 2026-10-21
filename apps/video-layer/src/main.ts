import Color from "@arcgis/core/Color.js";
import config from "@arcgis/core/config.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Layer from "@arcgis/core/layers/Layer.js";
import type { TelemetryDisplayType } from "@arcgis/core/layerList/types.js";
import VideoLayer from "@arcgis/core/layers/VideoLayer.js";
import PortalItem from "@arcgis/core/portal/PortalItem.js";
import request from "@arcgis/core/request.js";
import type ActionToggle from "@arcgis/core/support/actions/ActionToggle.js";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol.js";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol.js";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol.js";
import WebMap from "@arcgis/core/WebMap.js";
import "@arcgis/map-components/components/arcgis-editor";
import "@arcgis/map-components/components/arcgis-expand";
import "@arcgis/map-components/components/arcgis-layer-list-next";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-video-player";
import "@arcgis/map-components/components/arcgis-zoom";
import "@esri/calcite-components/components/calcite-block";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-color-picker";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-shell";
import "@esri/calcite-components/components/calcite-slider";
import "@esri/calcite-components/components/calcite-switch";
import { airplanePath } from "./airplane-path";
import "./style.css";

type TelemetrySymbolContext = {
  action: ActionToggle;
  layer: VideoLayer;
  name: TelemetryDisplayType;
};

type TelemetrySymbolProperty =
  | "frameCenterSymbol"
  | "frameOutlineSymbol"
  | "sensorPathSymbol"
  | "sensorSightLineSymbol"
  | "sensorSymbol"
  | "sensorTrailSymbol";

type TelemetrySymbolDefinition = {
  label: string;
  property: TelemetrySymbolProperty;
};

const editTelemetrySymbolActionId = "edit-telemetry-symbol";

const state: {
  telemetrySymbolContext: TelemetrySymbolContext | null;
  videoLayer: VideoLayer;
  webMap: WebMap;
} = {
  telemetrySymbolContext: null,
  videoLayer: new VideoLayer({
    url: "https://video-server.idt.geocloud.com/video/rest/services/Exercise_1/VideoServer",
  }),
  webMap: new WebMap({
    basemap: "topo-vector",
  }),
};

const telemetrySymbolDefinitions = {
  frame: null,
  frameCenter: {
    label: "Frame center",
    property: "frameCenterSymbol",
  },
  frameOutline: {
    label: "Frame outline",
    property: "frameOutlineSymbol",
  },
  lineOfSight: {
    label: "Sight line",
    property: "sensorSightLineSymbol",
  },
  sensorLocation: {
    label: "Sensor",
    property: "sensorSymbol",
  },
  sensorPath: {
    label: "Sensor path",
    property: "sensorPathSymbol",
  },
  sensorTrail: {
    label: "Sensor trail",
    property: "sensorTrailSymbol",
  },
} as const satisfies Record<TelemetryDisplayType, TelemetrySymbolDefinition | null>;

// config.portalUrl = "https://devtesting.mapsdevext.arcgis.com/";
// config.portalUrl = "https://dev0019062.esri.com/portal";
config.portalUrl = "https://video-portal.idt.geocloud.com/portal";

const addPortalLayersButton = document.querySelector(
  "#add-portal-layers-button",
)! as HTMLCalciteButtonElement;
const frameEffectBrightnessSlider = document.querySelector(
  "#frame-effect-brightness-slider",
)! as HTMLCalciteSliderElement;
const frameEffectContrastSlider = document.querySelector(
  "#frame-effect-contrast-slider",
)! as HTMLCalciteSliderElement;
const frameEffectInvertSwitch = document.querySelector(
  "#frame-effect-invert-switch",
)! as HTMLCalciteSwitchElement;
const frameEffectSaturateSlider = document.querySelector(
  "#frame-effect-saturate-slider",
)! as HTMLCalciteSliderElement;
const frameOpacitySlider = document.querySelector(
  "#frame-opacity-slider",
)! as HTMLCalciteSliderElement;
const layerListElement = document.querySelector(
  "arcgis-layer-list-next",
)! as HTMLArcgisLayerListNextElement;
const opacitySlider = document.querySelector("#opacity-slider")! as HTMLCalciteSliderElement;
const saveAsButton = document.querySelector("#save-as-button")! as HTMLCalciteButtonElement;
const saveButton = document.querySelector("#save-button")! as HTMLCalciteButtonElement;
const telemetryColorPicker = document.querySelector(
  "#telemetry-color-picker",
)! as HTMLCalciteColorPickerElement;
const telemetrySymbolPanel = document.querySelector(
  "#telemetry-symbol-panel",
)! as HTMLCalcitePanelElement;
const testingPropertiesSwitch = document.querySelector(
  "#testing-properties-switch",
)! as HTMLCalciteSwitchElement;
const viewElement = document.querySelector("arcgis-map")! as HTMLArcgisMapElement;
const videoPlayerElement = document.querySelector("arcgis-video-player")!;

await init();

addPortalLayersButton.addEventListener("click", () => addPortalLayers(config.portalUrl));

frameEffectBrightnessSlider.addEventListener("calciteSliderInput", () => {
  updateFrameEffect();
});

frameEffectContrastSlider.addEventListener("calciteSliderInput", () => {
  updateFrameEffect();
});

frameEffectInvertSwitch.addEventListener("calciteSwitchChange", () => {
  updateFrameEffect();
});

frameOpacitySlider.addEventListener("calciteSliderInput", () => {
  updateFrameOpacity(frameOpacitySlider.value);
});

frameEffectSaturateSlider.addEventListener("calciteSliderInput", () => {
  updateFrameEffect();
});

layerListElement.listItemCreatedFunction = (event) => {
  const { item } = event;

  if (item.layer?.type === "video" && item.content.type === "layer") {
    const inlineVideoPlayer = document.createElement(
      "arcgis-video-player",
    ) as HTMLArcgisVideoPlayerElement;
    inlineVideoPlayer.autoDestroyDisabled = true;
    inlineVideoPlayer.inline = true;
    inlineVideoPlayer.layer = item.layer as VideoLayer;

    item.panel = {
      content: inlineVideoPlayer,
      icon: "follow-play",
    };
  }

  if (
    item.layer?.type === "video" &&
    item.content.type === "telemetry-display" &&
    getTelemetrySymbol(item.layer as VideoLayer, item.content.name)
  ) {
    item.actionsSections = [
      [
        {
          icon: "styling",
          id: editTelemetrySymbolActionId,
          title: "Edit symbol color",
          type: "toggle",
          value: false,
        },
      ],
    ];
  }
};

layerListElement.addEventListener("arcgisTriggerAction", (event) => {
  const { action, item } = event.detail;

  if (
    action.id !== editTelemetrySymbolActionId ||
    action.type !== "toggle" ||
    item.layer?.type !== "video" ||
    item.content.type !== "telemetry-display"
  ) {
    return;
  }

  toggleTelemetrySymbolEditor(action, item.layer as VideoLayer, item.content.name);
});

opacitySlider.addEventListener("calciteSliderInput", () => {
  updateOpacity(opacitySlider.value);
});

saveButton.addEventListener("click", async () => {
  console.log("save button clicked");
  await state.webMap.updateFrom(viewElement.view);
  const result = await state.webMap.save();
  console.log("Save result:", result.id, result);
});

saveAsButton.addEventListener("click", async () => {
  console.log("save as button clicked");
  await state.webMap.loadAll();
  await state.webMap.updateFrom(viewElement.view);
  const result = await state.webMap.saveAs(
    new PortalItem({
      title: "My Video Layer Web Map",
    }),
  );
  state.webMap.portalItem = result;
  saveButton.disabled = false;
  console.log("Save As result:", result.id, result);
});

telemetryColorPicker.addEventListener("calciteColorPickerInput", () => {
  const colorValue = telemetryColorPicker.value;
  const telemetrySymbolContext = state.telemetrySymbolContext;

  if (typeof colorValue === "string" && telemetrySymbolContext) {
    setTelemetrySymbolColor(
      telemetrySymbolContext.layer,
      telemetrySymbolContext.name,
      new Color(colorValue),
    );
  }
});

testingPropertiesSwitch.addEventListener("calciteSwitchChange", async () => {
  if (testingPropertiesSwitch.checked) {
    await addTestingProperties();
  } else {
    await removeTestingProperties();
  }
});

async function addPortalLayers(portalUrl: string) {
  try {
    const portalItems = await getPortalItems(portalUrl);
    for (const portalItem of portalItems as PortalItem[]) {
      console.log(portalItem.title);
      try {
        const layer = await Layer.fromPortalItem({ portalItem });
        await layer.load();
        console.log(layer.title);
        if (layer.loaded) {
          state.webMap.layers.add(layer);
        }
      } catch (error) {
        console.log("Error loading", portalItem.title, error);
      }
    }
  } catch (error) {
    console.log("Error loading portalItems", error);
  }
}

async function addTestingProperties() {
  await state.videoLayer.load();
  state.videoLayer.autoplay = true;
  state.videoLayer.blendMode = "vivid-light";
  state.videoLayer.effect = "brightness(500%) hue-rotate(270deg) contrast(200%)";
  state.videoLayer.frameEffect = "invert()";
  frameEffectInvertSwitch.checked = true;
  state.videoLayer.frameOpacity = 0.1;
  state.videoLayer.frameCenterSymbol = new SimpleMarkerSymbol({
    angle: 0,
    color: new Color([0, 0, 255, 1]),
    outline: new SimpleLineSymbol({
      cap: "round",
      color: new Color([0, 255, 0, 1]),
      join: "round",
      miterLimit: 1,
      style: "short-dash-dot-dot",
      width: 2,
    }),
    size: 12,
    style: "triangle",
    xoffset: 0,
    yoffset: 0,
  });
  state.videoLayer.frameOutlineSymbol = new SimpleFillSymbol({
    color: new Color([255, 0, 0, 1]),
    outline: new SimpleLineSymbol({
      cap: "round",
      color: new Color([0, 255, 0, 1]),
      join: "round",
      miterLimit: 1,
      style: "dot",
      width: 12,
    }),
    style: "vertical",
  });
  state.videoLayer.muted = true;
  state.videoLayer.opacity = 0.5;
  state.videoLayer.sensorPathSymbol = new SimpleLineSymbol({
    cap: "square",
    color: new Color([30, 20, 200, 0.5]),
    join: "round",
    miterLimit: 1,
    style: "dot",
    width: 1,
  });
  state.videoLayer.sensorSightLineSymbol = new SimpleLineSymbol({
    cap: "round",
    color: new Color([255, 255, 0, 1]),
    join: "round",
    miterLimit: 1,
    style: "dash-dot",
    width: 3,
  });
  state.videoLayer.sensorSymbol = new SimpleMarkerSymbol({
    angle: 90,
    color: new Color([0, 0, 255, 1]),
    outline: new SimpleLineSymbol({
      cap: "round",
      color: new Color([0, 255, 0, 1]),
      join: "round",
      miterLimit: 1,
      style: "solid",
      width: 3,
    }),
    path: airplanePath,
    size: 24,
    xoffset: 0,
    yoffset: 0,
  });
  state.videoLayer.sensorSymbolOrientation = {
    source: "platformHeading", // "cameraAzimuth" or "platformHeading"
    symbolOffset: 0,
  };
  state.videoLayer.sensorTrailSymbol = new SimpleLineSymbol({
    cap: "round",
    color: new Color([255, 0, 0, 1]),
    join: "round",
    miterLimit: 1,
    style: "dash",
    width: 12,
  });
  state.videoLayer.start = 6;
  state.videoLayer.telemetryDisplay = {
    frame: true,
    frameCenter: true,
    frameOutline: true,
    lineOfSight: true,
    sensorLocation: true,
    sensorPath: true,
    sensorTrail: true,
  };
  state.videoLayer.visible = true;
  updateTelemetrySymbolColorPicker();
}

async function getPortalItems(portalUrl: string) {
  const url = portalUrl + "/sharing/rest/search";

  const options = {
    query: {
      f: "json",
      q: 'type:"Video Service"',
      sortField: "title",
      sortOrder: "desc",
    },
  };

  const response = await request(url, options);
  const portalItems = response.data.results;

  return portalItems;
}

function getTelemetrySymbol(layer: VideoLayer, name: TelemetryDisplayType) {
  const definition = telemetrySymbolDefinitions[name];
  const symbol = definition ? layer[definition.property] : null;

  return symbol instanceof SimpleFillSymbol ||
    symbol instanceof SimpleLineSymbol ||
    symbol instanceof SimpleMarkerSymbol
    ? symbol
    : null;
}

function getTelemetrySymbolColor(layer: VideoLayer, name: TelemetryDisplayType) {
  const symbol = getTelemetrySymbol(layer, name);

  if (name === "frameOutline" && symbol instanceof SimpleFillSymbol) {
    return symbol.outline?.color;
  }

  if (symbol instanceof SimpleMarkerSymbol && (symbol.style === "cross" || symbol.style === "x")) {
    return symbol.outline?.color;
  }

  return symbol?.color;
}

async function init() {
  try {
    state.webMap.layers.add(state.videoLayer);
  } catch (error) {
    console.log("Error adding initial video layer", error);
  }

  try {
    const featureLayer = new FeatureLayer({
      url: "https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/video-player-editing/FeatureServer",
    });
    state.webMap.layers.add(featureLayer);
  } catch (error) {
    console.log("Error loading editable feature layer", error);
  }

  viewElement.map = state.webMap;

  await viewElement.viewOnReady();
  console.log("the view is ready");

  if (state.videoLayer.loaded) {
    console.log("the layer is loaded");
    videoPlayerElement.layer = state.videoLayer;
  } else {
    await state.videoLayer.load();
    videoPlayerElement.layer = state.videoLayer;
  }
  await viewElement.whenLayerView(state.videoLayer);
  console.log("the layerview is created");
  if (state.videoLayer.fullExtent) {
    await viewElement.goTo(state.videoLayer.fullExtent);
  }

  updateFrameEffect();
}

async function removeTestingProperties() {
  await state.videoLayer.load();
  state.videoLayer.autoplay = false;
  state.videoLayer.blendMode = "normal";
  state.videoLayer.effect = null;
  state.videoLayer.frameEffect = null;
  frameEffectInvertSwitch.checked = false;
  state.videoLayer.frameOpacity = 1;
  state.videoLayer.frameCenterSymbol = new SimpleMarkerSymbol({
    angle: 0,
    color: new Color([255, 127, 0]),
    size: 10,
    style: "cross",
  });
  state.videoLayer.frameOutlineSymbol = new SimpleFillSymbol({
    color: new Color([0, 0, 0, 0.05]),
    outline: new SimpleLineSymbol({
      color: new Color([255, 127, 0]),
      width: 2,
    }),
  });
  state.videoLayer.muted = false;
  state.videoLayer.opacity = 1;
  state.videoLayer.sensorPathSymbol = new SimpleLineSymbol({
    color: new Color([0, 0, 0]),
    style: "dash",
    width: 1,
  });
  state.videoLayer.sensorSightLineSymbol = new SimpleLineSymbol({
    color: new Color([255, 127, 0]),
    width: 1,
  });
  state.videoLayer.sensorSymbol = new SimpleMarkerSymbol({
    angle: 0,
    color: new Color([255, 127, 0]),
    outline: { color: [255, 255, 255], width: 1.33 },
    size: 10,
    style: "circle",
  });
  state.videoLayer.sensorSymbolOrientation = {
    source: "platformHeading",
    symbolOffset: 0,
  };
  state.videoLayer.sensorTrailSymbol = new SimpleLineSymbol({
    color: new Color([255, 127, 0]),
    width: 1,
  });
  state.videoLayer.start = 0;
  state.videoLayer.telemetryDisplay = {
    frame: false,
    frameCenter: false,
    frameOutline: true,
    lineOfSight: true,
    sensorLocation: true,
    sensorPath: true,
    sensorTrail: true,
  };
  state.videoLayer.visible = true;
  updateTelemetrySymbolColorPicker();
}

function hideTelemetrySymbolEditor() {
  if (state.telemetrySymbolContext) {
    state.telemetrySymbolContext.action.value = false;
  }

  state.telemetrySymbolContext = null;
  telemetrySymbolPanel.hidden = true;
}

function setTelemetrySymbolColor(layer: VideoLayer, name: TelemetryDisplayType, color: Color) {
  const definition = telemetrySymbolDefinitions[name];
  const symbol = getTelemetrySymbol(layer, name)?.clone();

  if (!definition || !symbol) {
    return;
  }

  if (name === "frameOutline" && symbol instanceof SimpleFillSymbol) {
    if (symbol.outline) {
      symbol.outline.color = color;
    } else {
      symbol.outline = new SimpleLineSymbol({ color });
    }
  } else if (symbol instanceof SimpleMarkerSymbol) {
    symbol.outline.color = color;
  } else {
    symbol.color = color;
  }

  layer.set(definition.property, symbol);
}

function toggleTelemetrySymbolEditor(
  action: ActionToggle,
  layer: VideoLayer,
  name: TelemetryDisplayType,
) {
  if (!action.value) {
    if (state.telemetrySymbolContext?.action === action) {
      hideTelemetrySymbolEditor();
    }
    return;
  }

  const color = getTelemetrySymbolColor(layer, name);
  const definition = telemetrySymbolDefinitions[name];

  if (!color || !definition) {
    action.value = false;
    return;
  }

  if (state.telemetrySymbolContext) {
    state.telemetrySymbolContext.action.value = false;
  }

  action.value = true;
  state.telemetrySymbolContext = { action, layer, name };
  telemetryColorPicker.value = color.toHex({ digits: 8 });
  telemetrySymbolPanel.hidden = false;
  telemetrySymbolPanel.heading = definition.label;
}

function updateFrameEffect() {
  state.videoLayer.frameEffect = `brightness(${String(frameEffectBrightnessSlider.value ?? 100)}%) contrast(${String(frameEffectContrastSlider.value ?? 100)}%) saturate(${String(frameEffectSaturateSlider.value ?? 100)}%)`;
  if (frameEffectInvertSwitch.checked) {
    state.videoLayer.frameEffect += " invert()";
  }
}

function updateFrameOpacity(value: number | number[] | null) {
  if (typeof value === "number") {
    state.videoLayer.frameOpacity = value / 100;
  } else if (Array.isArray(value) && typeof value[0] === "number") {
    state.videoLayer.frameOpacity = value[0] / 100;
  } else {
    state.videoLayer.frameOpacity = 1;
  }
}

function updateOpacity(value: number | number[] | null) {
  if (typeof value === "number") {
    state.videoLayer.opacity = value / 100;
  } else if (Array.isArray(value) && typeof value[0] === "number") {
    state.videoLayer.opacity = value[0] / 100;
  } else {
    state.videoLayer.opacity = 1;
  }
}

function updateTelemetrySymbolColorPicker() {
  const telemetrySymbolContext = state.telemetrySymbolContext;

  if (!telemetrySymbolContext) {
    return;
  }

  const color = getTelemetrySymbolColor(telemetrySymbolContext.layer, telemetrySymbolContext.name);

  if (color) {
    telemetryColorPicker.value = color.toHex({ digits: 8 });
  }
}

layerListElement.addEventListener("arcgisSelectedItemsChange", async () => {
  const selectedListItem = layerListElement.selectedItems.getItemAt(0);

  console.log(selectedListItem?.layer);

  if (selectedListItem?.content.type !== "layer" || selectedListItem.layer?.type !== "video") {
    return;
  }

  const videoLayer = selectedListItem.layer as VideoLayer;
  await videoLayer.load();
  videoPlayerElement.layer = videoLayer;
  state.videoLayer = videoLayer;
  updateFrameEffect();
  updateFrameOpacity(frameOpacitySlider.value);
  updateOpacity(opacitySlider.value);

  if (testingPropertiesSwitch.checked) {
    await addTestingProperties();
  } else {
    await removeTestingProperties();
  }
});
