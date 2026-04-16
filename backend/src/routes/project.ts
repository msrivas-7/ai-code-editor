import { Router } from "express";
import { z } from "zod";
import { getSession, pingSession } from "../services/session/sessionManager.js";
import { writeSnapshot } from "../services/project/snapshot.js";

export const projectRouter = Router();

const snapshotBody = z.object({
  sessionId: z.string().min(1),
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(256),
        content: z.string().max(1_000_000),
      })
    )
    .max(50),
});

projectRouter.post("/snapshot", async (req, res, next) => {
  const parsed = snapshotBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const { sessionId, files } = parsed.data;
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: "session not found" });
  try {
    await writeSnapshot(session.workspacePath, files);
    pingSession(sessionId);
    res.json({ ok: true, fileCount: files.length });
  } catch (err) {
    next(err);
  }
});
