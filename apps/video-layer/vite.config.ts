import { defineConfig } from "vite-plus";

export default defineConfig({
  build: {
    // Lightning CSS turns Calcite's light-dark() colors into invalid concatenated values.
    cssMinify: false,
  },
});
