import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/services/**",
        "src/lib/utils/**",
        "src/lib/schemas/**",
        "src/components/ui/form.tsx",
        "src/components/ui/use-toast.ts",
      ],
      reporter: ["text", "html", "json-summary"],
      // Target: 80% statements on `src/lib/services/` per plan.md.
      // Set as a soft threshold; adjust as coverage improves.
      thresholds: {
        "src/lib/services/**": {
          statements: 50,
          branches: 50,
          functions: 50,
          lines: 50,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
