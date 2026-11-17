import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const demoDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(demoDir, "../..");

export default defineConfig({
  root: demoDir,
  publicDir: path.join(demoDir, "public"),
  resolve: {
    alias: {
      "sierpinski-coordinate": path.join(repoRoot, "src/index.ts"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: {
      // Allow importing the library from ../../src
      allow: [repoRoot],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
