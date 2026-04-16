import fs from "node:fs/promises";
import path from "node:path";

export interface ProjectFile {
  path: string;
  content: string;
}

/**
 * Normalise a file path relative to the workspace. Rejects traversal (`..`),
 * absolute paths, and anything that would escape the session workspace.
 */
function safeResolve(workspace: string, relative: string): string {
  const cleaned = relative.replace(/\\/g, "/").replace(/^\/+/, "");
  if (cleaned === "" || cleaned.includes("..")) {
    throw new Error(`invalid path: "${relative}"`);
  }
  const resolved = path.resolve(workspace, cleaned);
  if (!resolved.startsWith(path.resolve(workspace) + path.sep)) {
    throw new Error(`path escapes workspace: "${relative}"`);
  }
  return resolved;
}

/** Wipe the workspace *contents* (not the directory itself — the runner
 * container has a bind mount on this path and recreating the directory would
 * invalidate the mount's inode) and write each file fresh. */
export async function writeSnapshot(
  workspace: string,
  files: ProjectFile[]
): Promise<void> {
  await fs.mkdir(workspace, { recursive: true });
  await fs.chmod(workspace, 0o777).catch(() => {});
  const entries = await fs.readdir(workspace);
  await Promise.all(
    entries.map((name) => fs.rm(path.join(workspace, name), { recursive: true, force: true }))
  );

  for (const f of files) {
    const abs = safeResolve(workspace, f.path);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, f.content, "utf8");
    await fs.chmod(abs, 0o666).catch(() => {});
  }
}

export async function hasEntrypoint(
  workspace: string,
  entrypoint: string
): Promise<boolean> {
  try {
    await fs.access(path.join(workspace, entrypoint));
    return true;
  } catch {
    return false;
  }
}
