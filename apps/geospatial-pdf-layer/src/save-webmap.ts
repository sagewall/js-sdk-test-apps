import Basemap from "@arcgis/core/Basemap.js";
import type SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import GeospatialPDFLayer from "@arcgis/core/layers/GeospatialPDFLayer.js";
import MediaLayer from "@arcgis/core/layers/MediaLayer.js";
import ImageElement from "@arcgis/core/layers/support/ImageElement.js";
import WebMap from "@arcgis/core/WebMap.js";
import { convertPDFToMediaLayer } from "./pdf-to-media";

export function isSaveCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "identity-manager:user-aborted"
  );
}

export async function createSaveableWebMap(
  source: WebMap,
  spatialReference: SpatialReference,
): Promise<WebMap> {
  const snapshot = new WebMap({
    basemap: source.basemap ? Basemap.fromJSON(source.basemap.toJSON()) : undefined,
    initialViewProperties: source.initialViewProperties.clone(),
  });
  try {
    for (const layer of source.layers) {
      let savedLayer: MediaLayer;
      if (layer instanceof GeospatialPDFLayer) {
        savedLayer = await convertPDFToMediaLayer(layer, spatialReference);
        savedLayer.blendMode = layer.blendMode;
      } else if (layer instanceof MediaLayer && layer.source instanceof ImageElement) {
        savedLayer = new MediaLayer({
          title: layer.title,
          opacity: layer.opacity,
          minScale: layer.minScale,
          maxScale: layer.maxScale,
          blendMode: layer.blendMode,
          source: new ImageElement({
            image: layer.source.image,
            georeference: layer.source.georeference?.clone(),
            opacity: layer.source.opacity,
          }),
        });
      } else {
        throw new Error(`Cannot save the layer "${layer.title}" as a PDF image.`);
      }
      savedLayer.visible = layer.visible;
      snapshot.add(savedLayer);
    }
    return snapshot;
  } catch (error) {
    snapshot.destroy();
    throw error;
  }
}
