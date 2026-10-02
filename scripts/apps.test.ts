import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vite-plus/test";
import { getApps } from "./apps.ts";

async function withApps(
  manifests: Record<string, object | null>,
  check: (directory: URL) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "pages-apps-"));
  try {
    for (const [slug, manifest] of Object.entries(manifests)) {
      await mkdir(join(directory, slug));
      if (manifest) {
        await writeFile(join(directory, slug, "package.json"), JSON.stringify(manifest));
      }
    }
    await check(pathToFileURL(`${directory}/`));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("discovers apps in slug order and resolves listing metadata", async () => {
  await withApps(
    {
      website: { name: "website", scripts: { build: "vp build" } },
      "map-view": {
        description: "A map test",
        name: "@tests/map",
        pages: { title: "Map view" },
        scripts: { build: "vp build" },
      },
    },
    async (directory) => {
      expect(await getApps(directory)).toEqual([
        { description: "A map test", name: "@tests/map", slug: "map-view", title: "Map view" },
        { description: "", name: "website", slug: "website", title: "website" },
      ]);
    },
  );
});

test("excludes opted-out packages and non-package directories", async () => {
  await withApps({ disabled: { pages: false }, empty: null }, async (directory) => {
    expect(await getApps(directory)).toEqual([]);
  });
});

test("rejects unsafe URL slugs", async () => {
  await withApps(
    { "Invalid Folder": { name: "invalid", scripts: { build: "vp build" } } },
    async (directory) => {
      await expect(getApps(directory)).rejects.toThrow("lowercase slugs");
    },
  );
});

test("rejects packages without a build script", async () => {
  await withApps({ incomplete: { name: "incomplete" } }, async (directory) => {
    await expect(getApps(directory)).rejects.toThrow("build script");
  });
});

test("rejects duplicate package names", async () => {
  await withApps(
    {
      first: { name: "duplicate", scripts: { build: "vp build" } },
      second: { name: "duplicate", scripts: { build: "vp build" } },
    },
    async (directory) => {
      await expect(getApps(directory)).rejects.toThrow("must be unique");
    },
  );
});
