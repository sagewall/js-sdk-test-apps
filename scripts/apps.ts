import { readdir, readFile } from "node:fs/promises";

export type App = {
  description: string;
  name: string;
  slug: string;
  title: string;
};

export async function getApps(appsDirectory = new URL("../apps/", import.meta.url)) {
  const apps: App[] = [];
  const directories = await readdir(appsDirectory, { withFileTypes: true });

  for (const directory of directories.sort((first, second) =>
    first.name.localeCompare(second.name),
  )) {
    if (!directory.isDirectory()) continue;

    let manifest;
    try {
      manifest = JSON.parse(
        await readFile(new URL(`${directory.name}/package.json`, appsDirectory), "utf8"),
      );
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }

    if (manifest.pages === false) continue;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(directory.name)) {
      throw new Error(`Pages app folders must use lowercase slugs: ${directory.name}`);
    }
    if (!manifest.name || !manifest.scripts?.build) {
      throw new Error(`apps/${directory.name} needs a package name and build script.`);
    }
    if (apps.some((app) => app.name === manifest.name)) {
      throw new Error(`Pages app package names must be unique: ${manifest.name}`);
    }

    apps.push({
      description: manifest.description ?? "",
      name: manifest.name,
      slug: directory.name,
      title: manifest.pages?.title ?? manifest.name,
    });
  }

  return apps;
}
