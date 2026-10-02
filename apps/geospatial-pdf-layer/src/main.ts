import GeospatialPDFLayer from "@arcgis/core/layers/GeospatialPDFLayer";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import "@esri/calcite-components/components/calcite-shell";
import "./style.css";

const viewElement = document.querySelector("arcgis-map");

const layer = new GeospatialPDFLayer({
  portalItem: {
    id: "382f7689abf2450ea8de335ff667c2fc",
  },
});

await viewElement?.viewOnReady();
viewElement?.map?.add(layer);

await layer.load();

if (layer.fullExtent) {
  await viewElement?.goTo(layer.fullExtent);
}
