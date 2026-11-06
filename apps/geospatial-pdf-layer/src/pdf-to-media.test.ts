import Extent from "@arcgis/core/geometry/Extent.js";
import Polygon from "@arcgis/core/geometry/Polygon.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import type GeospatialPDFLayer from "@arcgis/core/layers/GeospatialPDFLayer.js";
import type { PixelData } from "@arcgis/core/layers/raster/types.js";
import ExtentAndRotationGeoreference from "@arcgis/core/layers/support/ExtentAndRotationGeoreference.js";
import ImageElement from "@arcgis/core/layers/support/ImageElement.js";
import PixelBlock from "@arcgis/core/layers/support/PixelBlock.js";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { convertPDFToMediaLayer } from "./pdf-to-media";

const spatialReference = new SpatialReference({ wkid: 3857 });
const extent = new Extent({ xmin: 0, ymin: 0, xmax: 100, ymax: 50, spatialReference });
const context = {
  putImageData: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  globalCompositeOperation: "source-over",
};
let canvas: { width: number; height: number; getContext: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  canvas = { width: 0, height: 0, getContext: vi.fn(() => context) };
  vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
  vi.stubGlobal(
    "ImageData",
    class {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

function createPDF(clippedToNeatline = true) {
  return {
    title: "Rotated PDF",
    opacity: 0.6,
    minScale: 100,
    maxScale: 10,
    clippedToNeatline,
    load: vi.fn().mockResolvedValue(undefined),
    getCompatibleFullExtent: vi.fn(() => extent),
    fetchPixels: vi.fn<() => Promise<PixelData>>().mockResolvedValue({
      extent: extent.clone(),
      pixelBlock: new PixelBlock({
        width: 2,
        height: 1,
        pixelType: "u8",
        pixels: [new Uint8Array([255, 0]), new Uint8Array([0, 255]), new Uint8Array([0, 0])],
        mask: new Uint8Array([1, 0]),
      }),
    }),
    createNeatline: vi.fn(
      () =>
        new Polygon({
          spatialReference,
          rings: [
            [
              [25, 50],
              [100, 25],
              [75, 0],
              [0, 25],
              [25, 50],
            ],
          ],
        }),
    ),
  };
}

test("requests projected pixels and georeferences the returned image extent", async () => {
  const pdf = createPDF();
  const imageExtent = new Extent({ xmin: 10, ymin: 20, xmax: 110, ymax: 70, spatialReference });
  pdf.fetchPixels.mockResolvedValue({
    ...(await pdf.fetchPixels()),
    extent: imageExtent,
  });
  pdf.fetchPixels.mockClear();
  const layer = await convertPDFToMediaLayer(
    pdf as unknown as GeospatialPDFLayer,
    spatialReference,
  );
  expect(pdf.getCompatibleFullExtent).toHaveBeenCalledWith(spatialReference);
  expect(pdf.fetchPixels).toHaveBeenCalledWith(extent, 2048, 1024, { interpolation: "bilinear" });
  expect(layer.source).toBeInstanceOf(ImageElement);
  const image = layer.source as ImageElement;
  expect(image.georeference).toBeInstanceOf(ExtentAndRotationGeoreference);
  const georeference = image.georeference as ExtentAndRotationGeoreference;
  expect(georeference.extent?.equals(imageExtent)).toBe(true);
  expect(canvas.width).toBe(2);
  expect(canvas.height).toBe(1);
  expect(context.putImageData.mock.calls[0][0].data).toEqual(
    new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0]),
  );
  expect(layer.opacity).toBe(0.6);
  layer.destroy();
});

test("clips with the transformed neatline in output pixel coordinates", async () => {
  const pdf = createPDF();
  const layer = await convertPDFToMediaLayer(
    pdf as unknown as GeospatialPDFLayer,
    spatialReference,
  );
  expect(pdf.createNeatline).toHaveBeenCalledWith(spatialReference);
  expect(context.moveTo).toHaveBeenCalledWith(0.5, 0);
  expect(context.lineTo).toHaveBeenCalledWith(2, 0.5);
  expect(context.fill).toHaveBeenCalledWith("evenodd");
  expect(context.globalCompositeOperation).toBe("source-over");
  layer.destroy();
});

test("keeps the full page when neatline clipping is disabled", async () => {
  const pdf = createPDF(false);
  const layer = await convertPDFToMediaLayer(
    pdf as unknown as GeospatialPDFLayer,
    spatialReference,
  );
  expect(pdf.createNeatline).not.toHaveBeenCalled();
  expect(context.fill).not.toHaveBeenCalled();
  layer.destroy();
});

test("rejects unavailable SDK hooks", async () => {
  await expect(
    convertPDFToMediaLayer(
      { load: async () => {} } as unknown as GeospatialPDFLayer,
      spatialReference,
    ),
  ).rejects.toThrow("conversion hooks");
});

test("rejects missing raster output", async () => {
  const pdf = createPDF();
  pdf.fetchPixels.mockResolvedValue({ extent, pixelBlock: null });
  await expect(
    convertPDFToMediaLayer(pdf as unknown as GeospatialPDFLayer, spatialReference),
  ).rejects.toThrow("did not produce an image");
});

test("rejects raster output in an unexpected spatial reference", async () => {
  const pdf = createPDF(false);
  const pixelData = await pdf.fetchPixels();
  pdf.fetchPixels.mockResolvedValue({
    ...pixelData,
    extent: new Extent({
      xmin: -119,
      ymin: 34,
      xmax: -118,
      ymax: 35,
      spatialReference: { wkid: 4326 },
    }),
  });
  await expect(
    convertPDFToMediaLayer(pdf as unknown as GeospatialPDFLayer, spatialReference),
  ).rejects.toThrow("does not match the requested spatial reference");
});
