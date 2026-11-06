import type Extent from "@arcgis/core/geometry/Extent.js";
import type Polygon from "@arcgis/core/geometry/Polygon.js";
import type SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import type GeospatialPDFLayer from "@arcgis/core/layers/GeospatialPDFLayer.js";
import MediaLayer from "@arcgis/core/layers/MediaLayer.js";
import ExtentAndRotationGeoreference from "@arcgis/core/layers/support/ExtentAndRotationGeoreference.js";
import ImageElement from "@arcgis/core/layers/support/ImageElement.js";
import type { PixelData } from "@arcgis/core/layers/raster/types.js";

type PDFRasterAccess = {
  getCompatibleFullExtent(spatialReference: SpatialReference): Extent | null;
  fetchPixels(
    extent: Extent,
    width: number,
    height: number,
    options: { interpolation: "bilinear" },
  ): Promise<PixelData>;
  createNeatline(spatialReference: SpatialReference): Polygon | null;
};

export async function convertPDFToMediaLayer(
  layer: GeospatialPDFLayer,
  spatialReference: SpatialReference,
): Promise<MediaLayer> {
  await layer.load();
  const raster = layer as GeospatialPDFLayer & Partial<PDFRasterAccess>;
  if (!raster.getCompatibleFullExtent || !raster.fetchPixels || !raster.createNeatline) {
    throw new Error("This SDK version does not expose the PDF raster conversion hooks.");
  }

  const extent = raster.getCompatibleFullExtent(spatialReference)?.clone();
  if (
    !extent ||
    !Number.isFinite(extent.width) ||
    !Number.isFinite(extent.height) ||
    extent.width <= 0 ||
    extent.height <= 0
  ) {
    throw new Error("The PDF cannot be rendered in the map's spatial reference.");
  }

  const size = 2048;
  const scale = size / Math.max(extent.width, extent.height);
  const width = Math.max(1, Math.round(extent.width * scale));
  const height = Math.max(1, Math.round(extent.height * scale));
  const { pixelBlock, extent: imageExtent } = await raster.fetchPixels(extent, width, height, {
    interpolation: "bilinear",
  });
  if (!pixelBlock || !pixelBlock.width || !pixelBlock.height) {
    throw new Error("The PDF did not produce an image in the map's spatial reference.");
  }
  if (!imageExtent.spatialReference.equals(spatialReference)) {
    throw new Error("The PDF raster output does not match the requested spatial reference.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = pixelBlock.width;
  canvas.height = pixelBlock.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create the PDF image canvas.");
  context.putImageData(new ImageData(pixelBlock.getAsRGBA(), canvas.width, canvas.height), 0, 0);

  if (layer.clippedToNeatline) {
    const neatline = raster.createNeatline(imageExtent.spatialReference);
    if (!neatline) throw new Error("The PDF neatline could not be projected.");
    context.globalCompositeOperation = "destination-in";
    context.beginPath();
    for (const ring of neatline.rings) {
      ring.forEach(([mapX, mapY], index) => {
        const x = ((mapX - imageExtent.xmin) / imageExtent.width) * canvas.width;
        const y = ((imageExtent.ymax - mapY) / imageExtent.height) * canvas.height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
    }
    context.fill("evenodd");
    context.globalCompositeOperation = "source-over";
  }

  return new MediaLayer({
    title: `${layer.title ?? "Geospatial PDF"} (image)`,
    opacity: layer.opacity,
    minScale: layer.minScale,
    maxScale: layer.maxScale,
    source: new ImageElement({
      image: canvas,
      georeference: new ExtentAndRotationGeoreference({ extent: imageExtent.clone() }),
    }),
  });
}
