import { defineConfig } from "vite-plus";
import { getApps } from "../../scripts/apps.ts";
import { sharedBuildConfig } from "../../vite.shared.ts";

export default defineConfig({
  build: sharedBuildConfig,
  define: {
    "import.meta.env.VITE_APPS": JSON.stringify(await getApps()),
  },
});
