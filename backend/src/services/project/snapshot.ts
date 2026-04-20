import path from "node:path";

/**
 * Normalise a file path relative to the workspace. Rejects traversal (`..`),
 * absolute paths, and anything that would escape the session workspace.
 * Shared between the ExecutionBackend file-I/O methods — it's the single
 * choke point for path validation.
 */
export function safeResolve(workspace: string, relative: string): string {
  const cleaned = relative.replace(/\\/g, "/").replace(/^\/+/, "");
  if (cleaned === "" || cleaned.includes("..")) {
    throw new Error(`invalid path: "${relative}"`);
  }
  // Reject any segment starting with `-`. Shell expansion of `*.c` on the
  // runner would otherwise pass a file named e.g. `-O3.c` as a flag to gcc.
  // The compile commands use `./*` prefixes as the primary defense; this
  // check ensures such filenames can never land on disk in the first place.
  for (const segment of cleaned.split("/")) {
    if (segment.startsWith("-")) {
      throw new Error(`invalid path: "${relative}"`);
    }
  }
  const resolved = path.resolve(workspace, cleaned);
  if (!resolved.startsWith(path.resolve(workspace) + path.sep)) {
    throw new Error(`path escapes workspace: "${relative}"`);
  }
  return resolved;
}
