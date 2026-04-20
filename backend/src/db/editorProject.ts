import type { JSONValue } from "postgres";
import { db } from "./client.js";

export interface EditorProject {
  language: string;
  files: Record<string, string>;
  activeFile: string | null;
  openTabs: string[];
  fileOrder: string[];
  stdin: string;
  updatedAt: string;
}

const DEFAULT_PROJECT: EditorProject = {
  language: "python",
  files: {},
  activeFile: null,
  openTabs: [],
  fileOrder: [],
  stdin: "",
  updatedAt: new Date(0).toISOString(),
};

interface Row {
  language: string;
  files: Record<string, string>;
  active_file: string | null;
  open_tabs: string[];
  file_order: string[];
  stdin: string;
  updated_at: Date;
}

function rowToProject(r: Row): EditorProject {
  return {
    language: r.language,
    files: r.files ?? {},
    activeFile: r.active_file,
    openTabs: r.open_tabs ?? [],
    fileOrder: r.file_order ?? [],
    stdin: r.stdin ?? "",
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function getEditorProject(userId: string): Promise<EditorProject> {
  const sql = db();
  const rows = await sql<Row[]>`
    SELECT language, files, active_file, open_tabs, file_order, stdin, updated_at
      FROM public.editor_project
     WHERE user_id = ${userId}
  `;
  if (rows.length === 0) return { ...DEFAULT_PROJECT };
  return rowToProject(rows[0]);
}

export interface EditorProjectInput {
  language: string;
  files: Record<string, string>;
  activeFile: string | null;
  openTabs: string[];
  fileOrder: string[];
  stdin: string;
}

export async function saveEditorProject(
  userId: string,
  project: EditorProjectInput,
): Promise<EditorProject> {
  const sql = db();
  const rows = await sql<Row[]>`
    INSERT INTO public.editor_project (
      user_id, language, files, active_file, open_tabs, file_order, stdin
    )
    VALUES (
      ${userId},
      ${project.language},
      ${sql.json(project.files as JSONValue)},
      ${project.activeFile},
      ${project.openTabs},
      ${project.fileOrder},
      ${project.stdin}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      language    = EXCLUDED.language,
      files       = EXCLUDED.files,
      active_file = EXCLUDED.active_file,
      open_tabs   = EXCLUDED.open_tabs,
      file_order  = EXCLUDED.file_order,
      stdin       = EXCLUDED.stdin,
      updated_at  = now()
    RETURNING language, files, active_file, open_tabs, file_order, stdin, updated_at
  `;
  return rowToProject(rows[0]);
}
