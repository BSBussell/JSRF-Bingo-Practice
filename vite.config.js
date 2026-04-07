import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        popout: resolve(__dirname, "popout.html")
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"]
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true
  }
});
