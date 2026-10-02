import "@arcgis/map-components/components/arcgis-layer-list";
import "@arcgis/map-components/components/arcgis-legend";
import "@arcgis/map-components/components/arcgis-map";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-navigation";
import "@esri/calcite-components/components/calcite-option";
import "@esri/calcite-components/components/calcite-radio-button";
import "@esri/calcite-components/components/calcite-radio-button-group";
import "@esri/calcite-components/components/calcite-select";
import "@esri/calcite-components/components/calcite-shell";
import "@esri/calcite-components/components/calcite-shell-panel";
import "@esri/calcite-components/components/calcite-switch";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

const shell = document.createElement("calcite-shell");

const navigation = document.createElement("calcite-navigation");
navigation.label = "Legend Testing";
navigation.slot = "header";

const basemapLegendVisibleLabel = document.createElement("calcite-label");
basemapLegendVisibleLabel.innerText = "Basemap Legend Visible";
basemapLegendVisibleLabel.layout = "inline";
basemapLegendVisibleLabel.slot = "content-start";
basemapLegendVisibleLabel.style.padding = "2.5rem 1rem";

const basemapLegendVisibleSwitch = document.createElement("calcite-switch");
basemapLegendVisibleLabel.appendChild(basemapLegendVisibleSwitch);
navigation.appendChild(basemapLegendVisibleLabel);

const hideLayersNotInCurrentViewLabel = document.createElement("calcite-label");
hideLayersNotInCurrentViewLabel.innerText = "Hide Layers Not In Current View";
hideLayersNotInCurrentViewLabel.layout = "inline";
hideLayersNotInCurrentViewLabel.slot = "content-start";
hideLayersNotInCurrentViewLabel.style.padding = "2.5rem 1rem";

const hideLayersNotInCurrentViewSwitch = document.createElement("calcite-switch");
hideLayersNotInCurrentViewLabel.appendChild(hideLayersNotInCurrentViewSwitch);
navigation.appendChild(hideLayersNotInCurrentViewLabel);

const respectLayerDefinitionExpressionLabel = document.createElement("calcite-label");
respectLayerDefinitionExpressionLabel.innerText = "Respect Layer Definition Expression";
respectLayerDefinitionExpressionLabel.layout = "inline";
respectLayerDefinitionExpressionLabel.slot = "content-start";
respectLayerDefinitionExpressionLabel.style.padding = "2.5rem 1rem";

const respectLayerDefinitionExpressionSwitch = document.createElement("calcite-switch");
respectLayerDefinitionExpressionLabel.appendChild(respectLayerDefinitionExpressionSwitch);
navigation.appendChild(respectLayerDefinitionExpressionLabel);

const ignoreLayerVisibilityLabel = document.createElement("calcite-label");
ignoreLayerVisibilityLabel.innerText = "Ignore Layer Visibility";
ignoreLayerVisibilityLabel.layout = "inline";
ignoreLayerVisibilityLabel.slot = "content-start";
ignoreLayerVisibilityLabel.style.padding = "2.5rem 1rem";

const ignoreLayerVisibilitySwitch = document.createElement("calcite-switch");
ignoreLayerVisibilityLabel.appendChild(ignoreLayerVisibilitySwitch);
navigation.appendChild(ignoreLayerVisibilityLabel);

const legendStyleLabel = document.createElement("calcite-label");
legendStyleLabel.style.padding = "2.5rem 1rem";
legendStyleLabel.innerText = "Card Style";
legendStyleLabel.layout = "inline";
legendStyleLabel.slot = "content-end";

const legendStyleSwitch = document.createElement("calcite-switch");

legendStyleLabel.appendChild(legendStyleSwitch);
navigation.appendChild(legendStyleLabel);

const layoutRadioButtonGroup = document.createElement("calcite-radio-button-group");
layoutRadioButtonGroup.layout = "horizontal";
layoutRadioButtonGroup.style.display = "none";
layoutRadioButtonGroup.style.padding = "2rem 1rem";
layoutRadioButtonGroup.slot = "content-end";

const autoLayoutLabel = document.createElement("calcite-label");
autoLayoutLabel.innerText = "Auto";
autoLayoutLabel.layout = "inline";

const autoLayoutRadioButton = document.createElement("calcite-radio-button");
autoLayoutRadioButton.checked = true;
autoLayoutRadioButton.value = "auto";

autoLayoutLabel.appendChild(autoLayoutRadioButton);
layoutRadioButtonGroup.appendChild(autoLayoutLabel);

const sideBySideLabel = document.createElement("calcite-label");
sideBySideLabel.innerText = "Side by Side";
sideBySideLabel.layout = "inline";

const sideBySideRadioButton = document.createElement("calcite-radio-button");
sideBySideRadioButton.value = "side-by-side";

sideBySideLabel.appendChild(sideBySideRadioButton);
layoutRadioButtonGroup.appendChild(sideBySideLabel);

const stackLabel = document.createElement("calcite-label");
stackLabel.innerText = "Stack";
stackLabel.layout = "inline";

const stackRadioButton = document.createElement("calcite-radio-button");
stackRadioButton.value = "stack";

stackLabel.appendChild(stackRadioButton);
layoutRadioButtonGroup.appendChild(stackLabel);

navigation.appendChild(layoutRadioButtonGroup);

const webMapSelect = document.createElement("calcite-select");
webMapSelect.label = "Web Map";
webMapSelect.slot = "content-end";

const webMaps = [
  {
    label: "Various Renderers",
    value: "113b188cb5d64c579118c4943ccc2e26",
  },
  { label: "Binning", value: "8e2f2bd8e5ed4a298cb19873ac08b1a9" },
  { label: "Points", value: "bb272dd7692543b1acc4e104e8da5367" },
  { label: "Lines", value: "f06ce54b8c034d6791ae933a1365727d" },
  { label: "Polygons", value: "727707b4d2034951ab3dc84198dea3ed" },
  {
    label: "Spikes and time series",
    value: "bc74cf4cb5fb43b39b34add7a83ed050",
  },
];

webMaps.forEach((webMap) => {
  const option = document.createElement("calcite-option");
  option.innerText = webMap.label;
  option.label = webMap.label;
  option.value = webMap.value;
  webMapSelect.appendChild(option);
});

navigation.appendChild(webMapSelect);

const zoomButton = document.createElement("calcite-button");
zoomButton.iconEnd = "layer-zoom-to";
zoomButton.id = "zoom-button";
zoomButton.innerText = "Zoom to";
zoomButton.slot = "content-end";
zoomButton.style.padding = "0.5rem 1rem";
navigation.appendChild(zoomButton);

shell.appendChild(navigation);

const mapElement = document.createElement("arcgis-map");
mapElement.itemId = "e66cdb0c412245c6b0d8e58346a115fb";

shell.appendChild(mapElement);

const legendShellPanel = document.createElement("calcite-shell-panel");
legendShellPanel.slot = "panel-end";
legendShellPanel.width = "l";
legendShellPanel.resizable = true;

const legend = document.createElement("arcgis-legend");
legend.referenceElement = mapElement;

legendShellPanel.appendChild(legend);
shell.appendChild(legendShellPanel);

const layerListShellPanel = document.createElement("calcite-shell-panel");
layerListShellPanel.slot = "panel-start";
layerListShellPanel.width = "l";
layerListShellPanel.resizable = true;

const layerList = document.createElement("arcgis-layer-list");
layerList.referenceElement = mapElement;
layerList.visibilityAppearance = "checkbox";
layerList.listItemCreatedFunction = async (event) => {
  const { item } = event;
  const { layer } = item;

  if (layer?.type != "group") {
    item.panel = {
      content: "legend",
      open: true,
    };
  }

  await layer?.load();

  if (layer && "fullExtent" in layer && layer.fullExtent) {
    item.actionsSections = [
      [
        {
          title: "Zoom to layer",
          icon: "layer-zoom-to",
          id: "zoom-to",
          type: "button",
        },
      ],
    ];
  }
};

layerList.addEventListener("arcgisTriggerAction", (event) => {
  const { id } = event.detail.action;
  const { layer } = event.detail.item;

  if (id === "zoom-to") {
    if (layer && "fullExtent" in layer && layer.fullExtent) {
      void mapElement.goTo(layer.fullExtent);
    }
  }
});

layerListShellPanel.appendChild(layerList);
shell.appendChild(layerListShellPanel);

app.appendChild(shell);

basemapLegendVisibleSwitch.addEventListener("calciteSwitchChange", () => {
  legend.basemapLegendVisible = basemapLegendVisibleSwitch.checked;
});

hideLayersNotInCurrentViewSwitch.addEventListener("calciteSwitchChange", () => {
  legend.hideLayersNotInCurrentView = hideLayersNotInCurrentViewSwitch.checked;
});

respectLayerDefinitionExpressionSwitch.addEventListener("calciteSwitchChange", () => {
  legend.respectLayerDefinitionExpression = respectLayerDefinitionExpressionSwitch.checked;
});

ignoreLayerVisibilitySwitch.addEventListener("calciteSwitchChange", () => {
  legend.ignoreLayerVisibility = ignoreLayerVisibilitySwitch.checked;
});

layoutRadioButtonGroup.addEventListener("calciteRadioButtonGroupChange", () => {
  if (autoLayoutRadioButton.checked) {
    legend.legendStyle = { type: "card", layout: "auto" };
  } else if (sideBySideRadioButton.checked) {
    legend.legendStyle = { type: "card", layout: "side-by-side" };
  } else if (stackRadioButton.checked) {
    legend.legendStyle = { type: "card", layout: "stack" };
  }
});

legendStyleSwitch.addEventListener("calciteSwitchChange", () => {
  if (legendStyleSwitch.checked) {
    legend.legendStyle = "card";
    layoutRadioButtonGroup.style.display = "block";
  } else {
    legend.legendStyle = "classic";
    layoutRadioButtonGroup.style.display = "none";
  }
});

webMapSelect.addEventListener("calciteSelectChange", () => {
  const selectedValue = webMapSelect.value;
  mapElement.itemId = selectedValue;
});

zoomButton.addEventListener("click", () => {
  const layerView = mapElement.layerViews?.getItemAt(0);
  if (layerView && layerView.layer.fullExtent) {
    void mapElement.goTo(layerView.layer.fullExtent.expand(0.1));
  }
});
