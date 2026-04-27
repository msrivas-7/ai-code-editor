import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { OgArtifact, type OgArtifactProps } from "./og/OgArtifact.js";
import {
  OgStoryArtifact,
  type OgStoryArtifactProps,
} from "./og/OgStoryArtifact.js";

// Phase 21C: render the OG card to a PNG buffer via Satori → resvg.
//
// Pipeline:
//   1. Resolve the JSX-shaped layout from OgArtifact.tsx
//   2. Hand it to Satori with bundled fonts (Fraunces 600 for display,
//      JetBrains Mono 400/700 for the code block, Inter as a fallback
//      for body text)
//   3. Satori produces an SVG string
//   4. resvg-js rasterizes the SVG to a PNG buffer
//
// Caller (the POST /api/shares route) uploads the buffer to Supabase
// Storage and writes the resulting public path back to the share row.

const W = 1200;
const H = 630;

// Font loading — fonts come from @fontsource/* npm packages, so the
// path resolution works in dev + bundled-prod uniformly. We only load
// what we actually use to keep the cold-start cost bounded.
//
// Satori supports TTF / OTF / WOFF (NOT WOFF2). Fontsource ships both;
// we explicitly take the .woff variant.

interface LoadedFont {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 700;
  style: "normal" | "italic";
}

let cachedFonts: LoadedFont[] | null = null;

async function loadFonts(): Promise<LoadedFont[]> {
  if (cachedFonts) return cachedFonts;
  // Resolve relative to this file so the path works whether the
  // backend is running compiled (`dist/`) or via tsx in dev. The
  // node_modules path is stable from the backend root.
  const here = fileURLToPath(import.meta.url);
  // Walk up from src/services/share/ogRenderer.{js,ts} to backend root.
  // dist layout: backend/dist/services/share/ogRenderer.js
  // dev layout:  backend/src/services/share/ogRenderer.ts
  const backendRoot = path.resolve(path.dirname(here), "../../..");
  const fonts: LoadedFont[] = await Promise.all([
    readFile(
      path.join(
        backendRoot,
        "node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff",
      ),
    ).then((data) => ({ name: "Fraunces", data, weight: 600 as const, style: "normal" as const })),
    readFile(
      path.join(
        backendRoot,
        "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff",
      ),
    ).then((data) => ({ name: "JetBrainsMono", data, weight: 400 as const, style: "normal" as const })),
    readFile(
      path.join(
        backendRoot,
        "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff",
      ),
    ).then((data) => ({ name: "JetBrainsMono", data, weight: 700 as const, style: "normal" as const })),
    // Inter is loaded for body text. We bundle it because Satori
    // needs an explicit font for any text it can't fall back on, and
    // we don't want it to silently use a system font that may not
    // exist on the prod container.
    readFile(
      path.join(
        backendRoot,
        "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff",
      ),
    ).then((data) => ({ name: "Inter", data, weight: 400 as const, style: "normal" as const })),
  ]);
  cachedFonts = fonts;
  return fonts;
}

// Render the OG card (1200×630) for the given share data and return a
// PNG buffer. Errors propagate so the caller can decide whether to
// retry, stash the failure, or proceed without an image.
export async function renderOgPng(props: OgArtifactProps): Promise<Buffer> {
  const fonts = await loadFonts();
  const svg = await satori(OgArtifact(props), {
    width: W,
    height: H,
    fonts: fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight,
      style: f.style,
    })),
  });
  const resvg = new Resvg(svg, {
    background: "rgb(11, 16, 32)", // matches OgArtifact's bg so any
    // edge anti-aliasing blends into the panel rather than to white.
    fitTo: { mode: "width", value: W },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

// Phase 21C-ext: 9:16 Story-format render. Same content, different
// layout — see OgStoryArtifact for the vertical hierarchy. Used by the
// "Save for Stories" download path in the share dialog.
const STORY_W = 1080;
const STORY_H = 1920;

export async function renderOgStoryPng(
  props: OgStoryArtifactProps,
): Promise<Buffer> {
  const fonts = await loadFonts();
  const svg = await satori(OgStoryArtifact(props), {
    width: STORY_W,
    height: STORY_H,
    fonts: fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight,
      style: f.style,
    })),
  });
  const resvg = new Resvg(svg, {
    background: "rgb(11, 16, 32)",
    fitTo: { mode: "width", value: STORY_W },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
