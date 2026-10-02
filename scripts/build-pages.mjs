import { spawnSync } from "node:child_process";
import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getApps } from "./apps.ts";

const apps = await getApps();
const base = `${(process.argv[2] ?? "/").replace(/\/$/, "")}/`;
const output = new URL("../dist/", import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const website = apps.find((app) => app.slug === "website");

if (!base.startsWith("/") || base.includes("..") || /[?#\\]/.test(base)) {
  throw new Error("The Pages base must be an absolute URL pathname, such as /repo/.");
}
if (!website) throw new Error("apps/website is required as the Pages index.");

function run(args) {
  const result = spawnSync("vp", args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["run", "--no-cache", "--filter", "./packages/*", "build"]);

for (const app of apps) {
  const appBase = app.slug === "website" ? base : `${base}${app.slug}/`;
  await rm(new URL(`../apps/${app.slug}/dist/`, import.meta.url), {
    force: true,
    recursive: true,
  });
  run(["run", "--no-cache", `${app.name}#build`, "--base", appBase]);
  await access(new URL(`../apps/${app.slug}/dist/index.html`, import.meta.url));
}

await rm(output, { force: true, recursive: true });
await mkdir(output, { recursive: true });
await cp(new URL("../apps/website/dist/", import.meta.url), output, { recursive: true });

for (const app of apps.filter((entry) => entry.slug !== "website")) {
  const destination = new URL(`${app.slug}/`, output);
  try {
    await access(destination);
    throw new Error(`Website output conflicts with the app path: ${app.slug}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await cp(new URL(`../apps/${app.slug}/dist/`, import.meta.url), destination, {
    recursive: true,
  });
}

await writeFile(new URL(".nojekyll", output), "");
console.log(`Pages output: ${fileURLToPath(output)} (base: ${base})`);
