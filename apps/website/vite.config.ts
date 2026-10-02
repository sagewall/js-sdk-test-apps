import { defineConfig } from "vite-plus";
import { getApps } from "../../scripts/apps.ts";

export default defineConfig({
  define: {
    "import.meta.env.VITE_APPS": JSON.stringify(await getApps()),
  },
});
