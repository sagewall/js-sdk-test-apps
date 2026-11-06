import Basemap from "@arcgis/core/Basemap.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import GeospatialPDFLayer from "@arcgis/core/layers/GeospatialPDFLayer.js";
import MediaLayer from "@arcgis/core/layers/MediaLayer.js";
import ImageElement from "@arcgis/core/layers/support/ImageElement.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import WebMap from "@arcgis/core/WebMap.js";
import { afterAll, afterEach, expect, test, vi } from "vite-plus/test";
import { convertPDFToMediaLayer } from "./pdf-to-media";
import { createSaveableWebMap, isSaveCancelled } from "./save-webmap";

vi.hoisted(() => vi.stubGlobal("self", globalThis));
vi.mock("./pdf-to-media", () => ({ convertPDFToMediaLayer: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllGlobals());

const spatialReference = new SpatialReference({ wkid: 3857 });

test("recognizes SDK sign-in cancellation without requiring a native Error", () => {
  expect(isSaveCancelled({ name: "identity-manager:user-aborted", message: "ABORTED" })).toBe(true);
  expect(isSaveCancelled(new Error("Save failed"))).toBe(false);
  expect(isSaveCancelled(null)).toBe(false);
});

test("converts local PDFs without changing the live map", async () => {
  const pdf = new GeospatialPDFLayer({
    title: "Local PDF",
    data: new File(["PDF"], "local.pdf", { type: "application/pdf" }),
    visible: false,
  });
  const media = new MediaLayer({ title: "PDF image" });
  vi.mocked(convertPDFToMediaLayer).mockResolvedValue(media);
  const source = new WebMap({
    basemap: new Basemap({
      baseLayers: [new TileLayer({ url: "https://example.com/MapServer" })],
    }),
    layers: [pdf],
  });
  const snapshot = await createSaveableWebMap(source, spatialReference);
  expect(convertPDFToMediaLayer).toHaveBeenCalledWith(pdf, spatialReference);
  expect(snapshot.layers.at(0)).toBe(media);
  expect(media.visible).toBe(false);
  expect(source.layers.at(0)).toBe(pdf);
  expect(pdf.destroyed).toBe(false);
  expect(snapshot.basemap).not.toBe(source.basemap);
  const liveBasemapLayer = source.basemap?.baseLayers.at(0);
  expect(liveBasemapLayer).toBeDefined();
  expect(snapshot.basemap?.baseLayers.at(0)).not.toBe(liveBasemapLayer);
  expect(snapshot.initialViewProperties).not.toBe(source.initialViewProperties);
  snapshot.destroy();
  expect(liveBasemapLayer?.destroyed).toBe(false);
  source.destroy();
});

test("clones media elements so resource uploads do not mutate live layers", async () => {
  const image = new ImageElement({ image: "https://example.com/image.png" });
  const media = new MediaLayer({ source: image, visible: false, opacity: 0.4 });
  const source = new WebMap({ basemap: "topo", layers: [media] });
  const snapshot = await createSaveableWebMap(source, spatialReference);
  const saved = snapshot.layers.at(0) as MediaLayer;
  expect(saved).not.toBe(media);
  expect(saved.source).not.toBe(image);
  expect(saved.opacity).toBe(0.4);
  expect(saved.visible).toBe(false);
  snapshot.destroy();
  expect(media.destroyed).toBe(false);
  source.destroy();
});

test("releases the snapshot when conversion fails", async () => {
  const media = new MediaLayer({ title: "Prepared image" });
  const source = new WebMap({
    basemap: "topo",
    layers: [
      new GeospatialPDFLayer({ title: "Valid PDF" }),
      new GeospatialPDFLayer({ title: "Invalid PDF" }),
    ],
  });
  vi.mocked(convertPDFToMediaLayer)
    .mockResolvedValueOnce(media)
    .mockRejectedValueOnce(new Error("Conversion failed"));
  await expect(createSaveableWebMap(source, spatialReference)).rejects.toThrow("Conversion failed");
  expect(media.destroyed).toBe(true);
  expect(source.destroyed).toBe(false);
  source.destroy();
});
