/**
 * Quickstart consistency test (T103 — automated portion).
 *
 * T103 is "Run quickstart.md end-to-end on a fresh clone" — the full manual
 * fresh-clone test still has to be done by a human. This test guards the
 * *automatable* part: every script and every env var the quickstart mentions
 * must exist in `package.json` / `.env.local.example`. If a contributor renames
 * a script or adds a new env var, the quickstart + this file must move together.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const QUICKSTART = join(
  ROOT,
  "specs/001-household-finance-dashboard/quickstart.md",
);
const PACKAGE_JSON = join(ROOT, "package.json");
const ENV_EXAMPLE = join(ROOT, ".env.local.example");

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

describe("quickstart.md (T103) consistency", () => {
  const quickstart = readIfExists(QUICKSTART);
  const pkg = JSON.parse(readIfExists(PACKAGE_JSON));
  const envExample = readIfExists(ENV_EXAMPLE);

  it("exists and is non-empty", () => {
    expect(quickstart.length).toBeGreaterThan(200);
  });

  it("covers the required sections", () => {
    const required = [
      "## Prerequisites",
      "## 1. Clone and install",
      "## 2. Create the Firebase project",
      "## 3. Configure environment",
      "## 4. Bootstrap the first admin",
      "## 5. Seed the settings singleton",
      "## 6. Run dev",
      "## 7. Run tests",
      "## 8. Deploy",
    ];
    for (const heading of required) {
      expect(quickstart, `missing heading ${heading}`).toContain(heading);
    }
  });

  it("every `pnpm <script>` it references exists in package.json", () => {
    // Built-in pnpm subcommands are not npm scripts and must be ignored.
    const PNPM_BUILTINS = new Set([
      "install",
      "add",
      "remove",
      "update",
      "run",
      "test",
      "exec",
      "dlx",
      "publish",
      "version",
      "init",
      "link",
      "unlink",
      "list",
      "outdated",
      "why",
      "info",
      "pack",
      "cache",
      "store",
      "prune",
    ]);
    const scriptRefs = Array.from(
      quickstart.matchAll(/pnpm ([a-z][a-z0-9:_-]*)/g),
    )
      .map((m) => m[1])
      .filter((s) => !PNPM_BUILTINS.has(s));
    expect(scriptRefs.length).toBeGreaterThan(0);
    for (const s of new Set(scriptRefs)) {
      expect(
        pkg.scripts[s],
        `package.json is missing script "${s}"`,
      ).toBeDefined();
    }
  });

  it("every `NEXT_PUBLIC_FIREBASE_*` it references is documented in .env.local.example", () => {
    const envRefs = Array.from(
      quickstart.matchAll(/NEXT_PUBLIC_FIREBASE_[A-Z_]+/g),
    ).map((m) => m[0]);
    expect(envRefs.length).toBeGreaterThan(0);
    for (const k of new Set(envRefs)) {
      expect(envExample, `.env.local.example is missing ${k}`).toContain(k);
    }
  });

  it("the test:coverage script exists in package.json (T105b)", () => {
    expect(pkg.scripts["test:coverage"]).toBeDefined();
    expect(pkg.scripts["test:coverage"]).toContain("vitest");
  });

  it("@vitest/coverage-v8 is a devDependency (T105b)", () => {
    expect(pkg.devDependencies["@vitest/coverage-v8"]).toBeDefined();
  });

  it("`sonner` is NOT in dependencies (T006c — shadcn toast replaces it)", () => {
    expect(pkg.dependencies.sonner).toBeUndefined();
  });

  it("shadcn form + toast components exist on disk (T006b, T006c)", () => {
    expect(existsSync(join(ROOT, "src/components/ui/form.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "src/components/ui/toast.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "src/components/ui/use-toast.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/components/ui/toaster.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "src/components/ui/sonner.tsx"))).toBe(false);
  });
});
