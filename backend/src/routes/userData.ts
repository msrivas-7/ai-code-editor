import { Router, type Request } from "express";
import { z } from "zod";
import { getPreferences, upsertPreferences } from "../db/preferences.js";
import {
  listCourseProgress,
  upsertCourseProgress,
  deleteCourseProgress,
} from "../db/courseProgress.js";
import {
  listLessonProgress,
  upsertLessonProgress,
  deleteLessonProgress,
} from "../db/lessonProgress.js";
import { getEditorProject, saveEditorProject } from "../db/editorProject.js";

// Phase 18b: /api/user/* endpoints. authMiddleware upstream guarantees
// req.userId; every handler scopes reads/writes by that id. RLS on the tables
// is a second line of defense (backend holds a service-role connection; if
// that connection context is ever downgraded, RLS enforces per-user access).

function requireUser(req: Request): string {
  const u = req.userId;
  if (!u) throw new Error("authMiddleware missing — bootstrap bug");
  return u;
}

// ── Shared bounds ──────────────────────────────────────────────────────────
//
// courseId / lessonId are drawn from content authored in the repo (see
// content/courses/**). Human-curated, always short, always `[a-z0-9-]+`.
// Bounding them keeps a malicious client from jamming a megabyte string
// into the primary-key column and fanning the cost out through the RLS
// query plan. The regex matches what our content linter emits.
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const slug = (name: string) =>
  z
    .string()
    .min(1, `${name} required`)
    .max(64, `${name} too long`)
    .regex(SLUG_RE, `${name} has invalid chars`);

// `last_code` is a jsonb blob keyed by file path. A single 200 KB cap
// covers any reasonable project (our largest starter files are ~2 KB) and
// forecloses a user gradually consuming hundreds of MB of Postgres with
// a pathologically large autosave payload. Enforced on encoded byte
// length since TextEncoder-compatible size is what Postgres stores.
const LAST_CODE_MAX_BYTES = 200_000;

function byteLen(v: unknown): number {
  return Buffer.byteLength(JSON.stringify(v));
}

const lastCodeSchema = z
  .record(z.string().max(256), z.string().max(100_000))
  .nullable()
  .refine(
    (v) => v === null || byteLen(v) <= LAST_CODE_MAX_BYTES,
    { message: `lastCode exceeds ${LAST_CODE_MAX_BYTES} bytes` },
  );

export const userDataRouter = Router();

// ---------- preferences ----------

const prefsPatchSchema = z
  .object({
    persona: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    openaiModel: z.string().nullable().optional(),
    theme: z.enum(["system", "light", "dark"]).optional(),
    welcomeDone: z.boolean().optional(),
    workspaceCoachDone: z.boolean().optional(),
    editorCoachDone: z.boolean().optional(),
    uiLayout: z.record(z.unknown()).optional(),
  })
  .strict();

userDataRouter.get("/preferences", async (req, res, next) => {
  try {
    const prefs = await getPreferences(requireUser(req));
    res.json(prefs);
  } catch (err) {
    next(err);
  }
});

userDataRouter.patch("/preferences", async (req, res, next) => {
  const parsed = prefsPatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid preferences patch" });
  }
  try {
    const prefs = await upsertPreferences(requireUser(req), parsed.data);
    res.json(prefs);
  } catch (err) {
    next(err);
  }
});

// ---------- course progress ----------

const coursePatchSchema = z
  .object({
    status: z.enum(["not_started", "in_progress", "completed"]).optional(),
    startedAt: z.string().nullable().optional(),
    completedAt: z.string().nullable().optional(),
    lastLessonId: z.string().nullable().optional(),
    completedLessonIds: z.array(z.string()).optional(),
  })
  .strict();

userDataRouter.get("/courses", async (req, res, next) => {
  try {
    const rows = await listCourseProgress(requireUser(req));
    res.json({ courses: rows });
  } catch (err) {
    next(err);
  }
});

userDataRouter.patch("/courses/:courseId", async (req, res, next) => {
  const courseId = slug("courseId").safeParse(req.params.courseId);
  if (!courseId.success) {
    return res.status(400).json({ error: "invalid courseId" });
  }
  const parsed = coursePatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid course patch" });
  }
  try {
    const row = await upsertCourseProgress(
      requireUser(req),
      courseId.data,
      parsed.data,
    );
    res.json(row);
  } catch (err) {
    next(err);
  }
});

userDataRouter.delete("/courses/:courseId", async (req, res, next) => {
  const courseId = slug("courseId").safeParse(req.params.courseId);
  if (!courseId.success) {
    return res.status(400).json({ error: "invalid courseId" });
  }
  try {
    const userId = requireUser(req);
    const deletedLessons = await deleteLessonProgress(userId, courseId.data);
    const deletedCourse = await deleteCourseProgress(userId, courseId.data);
    res.json({ course: deletedCourse, lessons: deletedLessons });
  } catch (err) {
    next(err);
  }
});

// ---------- lesson progress ----------

// `practiceExerciseCode` is keyed by exerciseId → (file-path → content).
// Shares the same aggregate jsonb ceiling as lastCode so a user can't turn
// "practice this exercise" into an unbounded-size persistence surface.
const practiceExerciseCodeSchema = z
  .record(
    slug("exerciseId"),
    z.record(z.string().max(256), z.string().max(100_000)),
  )
  .refine(
    (v) => byteLen(v) <= LAST_CODE_MAX_BYTES,
    { message: `practiceExerciseCode exceeds ${LAST_CODE_MAX_BYTES} bytes` },
  );

const lessonPatchSchema = z
  .object({
    status: z.enum(["not_started", "in_progress", "completed"]).optional(),
    startedAt: z.string().nullable().optional(),
    completedAt: z.string().nullable().optional(),
    attemptCount: z.number().int().nonnegative().max(1_000_000).optional(),
    runCount: z.number().int().nonnegative().max(1_000_000).optional(),
    hintCount: z.number().int().nonnegative().max(1_000_000).optional(),
    timeSpentMs: z.number().int().nonnegative().max(30 * 24 * 3600 * 1000).optional(),
    lastCode: lastCodeSchema.optional(),
    lastOutput: z.string().max(200_000).nullable().optional(),
    practiceCompletedIds: z.array(slug("practiceId")).max(256).optional(),
    practiceExerciseCode: practiceExerciseCodeSchema.optional(),
  })
  .strict();

userDataRouter.get("/lessons", async (req, res, next) => {
  let courseId: string | undefined;
  if (typeof req.query.courseId === "string" && req.query.courseId.length > 0) {
    const parsed = slug("courseId").safeParse(req.query.courseId);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid courseId" });
    }
    courseId = parsed.data;
  }
  try {
    const rows = await listLessonProgress(requireUser(req), courseId);
    res.json({ lessons: rows });
  } catch (err) {
    next(err);
  }
});

userDataRouter.patch(
  "/lessons/:courseId/:lessonId",
  async (req, res, next) => {
    const courseId = slug("courseId").safeParse(req.params.courseId);
    const lessonId = slug("lessonId").safeParse(req.params.lessonId);
    if (!courseId.success || !lessonId.success) {
      return res.status(400).json({ error: "invalid courseId or lessonId" });
    }
    const parsed = lessonPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid lesson patch" });
    }
    try {
      const row = await upsertLessonProgress(
        requireUser(req),
        courseId.data,
        lessonId.data,
        parsed.data,
      );
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

// ---------- editor project ----------

// Editor-project limits: we persist one row per user, so the bound is
// "what a reasonable learner would realistically build", not "what an
// IDE can handle". 64 files × 100 KB each caps the payload at ~6 MB
// before compression, and the aggregate check below caps jsonb at 500 KB
// which is the practical Postgres sweet spot for row reads.
const EDITOR_MAX_FILES = 64;
const EDITOR_PATH_MAX = 256;
const EDITOR_FILE_MAX = 100_000;
const EDITOR_STDIN_MAX = 64_000;
const EDITOR_FILES_JSONB_MAX = 500_000;

// Accept only POSIX-ish file paths. Blocks `..` traversal, absolute paths,
// Windows backslashes, and anything that Monaco's tab strip couldn't
// render sanely. Matches what projectStore.createFile() already enforces
// on the frontend — we're hardening the server-side boundary too.
const EDITOR_PATH_RE = /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/;
const editorPathSchema = z
  .string()
  .min(1)
  .max(EDITOR_PATH_MAX)
  .regex(EDITOR_PATH_RE, "invalid path")
  .refine((p) => !p.includes(".."), { message: "path traversal" });

const editorProjectSchema = z
  .object({
    language: z.string().min(1).max(32),
    files: z
      .record(editorPathSchema, z.string().max(EDITOR_FILE_MAX))
      .refine(
        (f) => Object.keys(f).length <= EDITOR_MAX_FILES,
        { message: `too many files (max ${EDITOR_MAX_FILES})` },
      )
      .refine(
        (f) => byteLen(f) <= EDITOR_FILES_JSONB_MAX,
        { message: `files payload exceeds ${EDITOR_FILES_JSONB_MAX} bytes` },
      ),
    activeFile: editorPathSchema.nullable(),
    openTabs: z.array(editorPathSchema).max(EDITOR_MAX_FILES),
    fileOrder: z.array(editorPathSchema).max(EDITOR_MAX_FILES),
    stdin: z.string().max(EDITOR_STDIN_MAX),
  })
  .strict();

userDataRouter.get("/editor-project", async (req, res, next) => {
  try {
    const project = await getEditorProject(requireUser(req));
    res.json(project);
  } catch (err) {
    next(err);
  }
});

userDataRouter.put("/editor-project", async (req, res, next) => {
  const parsed = editorProjectSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid editor project payload" });
  }
  try {
    const project = await saveEditorProject(requireUser(req), parsed.data);
    res.json(project);
  } catch (err) {
    next(err);
  }
});
