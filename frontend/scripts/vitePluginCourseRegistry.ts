import { readdirSync, statSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

// QA-M1: the vite dev server serves `public/courses/` verbatim, so the app
// has no way to enumerate the folder at runtime. Before this plugin, adding
// a course directory meant touching a hardcoded TS array in courseLoader and
// hoping content-linter caught the miss. Now the plugin scans on build /
// dev-server start and writes `registry.json` next to the courses — a plain
// JSON manifest the loader fetches like any other static asset.
//
// Filename intentionally does NOT start with `_`: Vite's publicDir serve
// filters out `_`-prefixed paths (treats them as internal), so a file named
// `_registry.json` would be shadowed by the SPA history-fallback in dev and
// return index.html — silently breaking the dashboard.
//
// The scan is tolerant: a folder without a valid `course.json` is skipped
// (with a warning) rather than breaking the build. Stale `registry.json`
// entries don't accumulate because we always overwrite.

const MANIFEST_NAME = "registry.json";

interface ManifestEntry {
  id: string;
}

export function buildRegistry(coursesDir: string): { entries: ManifestEntry[]; skipped: string[] } {
  const entries: ManifestEntry[] = [];
  const skipped: string[] = [];
  if (!existsSync(coursesDir)) return { entries, skipped };
  for (const name of readdirSync(coursesDir).sort()) {
    if (name.startsWith(".") || name === MANIFEST_NAME) continue;
    const full = join(coursesDir, name);
    if (!statSync(full).isDirectory()) continue;
    const courseJson = join(full, "course.json");
    if (!existsSync(courseJson)) {
      skipped.push(`${name} (no course.json)`);
      continue;
    }
    try {
      const raw = JSON.parse(readFileSync(courseJson, "utf8"));
      if (typeof raw?.id !== "string" || raw.id !== name) {
        skipped.push(`${name} (course.json id="${raw?.id ?? ""}" does not match folder)`);
        continue;
      }
      entries.push({ id: name });
    } catch (err) {
      skipped.push(`${name} (course.json parse error: ${(err as Error).message})`);
    }
  }
  return { entries, skipped };
}

function writeManifest(coursesDir: string, logger: { info: (m: string) => void; warn: (m: string) => void }) {
  const { entries, skipped } = buildRegistry(coursesDir);
  const out = join(coursesDir, MANIFEST_NAME);
  writeFileSync(out, JSON.stringify({ courses: entries }, null, 2) + "\n");
  logger.info(`[course-registry] wrote ${entries.length} course(s) to ${MANIFEST_NAME}`);
  for (const msg of skipped) logger.warn(`[course-registry] skipped ${msg}`);
}

export function courseRegistryPlugin(): Plugin {
  const coursesDir = join(process.cwd(), "public", "courses");
  // Write the manifest synchronously at plugin construction — i.e. the moment
  // vite.config.ts is evaluated — so the file exists on disk before Vite's
  // static-serve middleware (sirv) caches its directory index. If we only
  // wrote in `configureServer`, a freshly booted dev server sometimes indexed
  // the public/courses dir before our hook ran, causing /courses/registry.json
  // to fall through to the SPA history-fallback (200 text/html) until a
  // restart. buildStart + configureServer still run on rebuild/hmr so the
  // manifest stays up to date when folders change.
  const bootLogger = {
    info: (m: string) => console.log(m),
    warn: (m: string) => console.warn(m),
  };
  writeManifest(coursesDir, bootLogger);
  return {
    name: "codetutor:course-registry",
    buildStart() {
      writeManifest(coursesDir, {
        info: (m) => this.info(m),
        warn: (m) => this.warn(m),
      });
    },
    configureServer(server) {
      writeManifest(coursesDir, {
        info: (m) => server.config.logger.info(m),
        warn: (m) => server.config.logger.warn(m),
      });
    },
  };
}
