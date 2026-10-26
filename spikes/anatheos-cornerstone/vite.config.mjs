import { defineConfig } from "vite";

export default defineConfig({
  // Isolated Vite probe: NO Vinext app, no Entheos Worker or hosting manifest.
  root: "spikes/anatheos-cornerstone",
  base: "./",
  optimizeDeps: {
    exclude: ["@cornerstonejs/dicom-image-loader"],
    include: ["dicom-parser"],
  },
  build: {
    outDir: "../../.sites-runtime/anatheos-cornerstone-bundle",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    reportCompressedSize: true,
  },
});