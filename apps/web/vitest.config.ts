import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@skylens/types": path.resolve(__dirname, "../../packages/types/src"),
      "@skylens/lib": path.resolve(__dirname, "../../packages/lib/src"),
      "@skylens/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
  },
});
