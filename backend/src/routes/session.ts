import { Router } from "express";
import { z } from "zod";
import {
  startSession,
  pingSession,
  endSession,
  getSessionStatus,
  rebindSession,
} from "../services/session/sessionManager.js";

export const sessionRouter = Router();

const idBody = z.object({ sessionId: z.string().min(1) });

sessionRouter.post("/", async (_req, res, next) => {
  try {
    const s = await startSession();
    res.json({ sessionId: s.id, createdAt: s.createdAt });
  } catch (err) {
    next(err);
  }
});

sessionRouter.post("/ping", (req, res) => {
  const parsed = idBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "sessionId required" });
  const ok = pingSession(parsed.data.sessionId);
  if (!ok) return res.status(404).json({ error: "session not found" });
  res.json({ ok: true });
});

sessionRouter.post("/rebind", async (req, res, next) => {
  const parsed = idBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "sessionId required" });
  try {
    const { record, reused } = await rebindSession(parsed.data.sessionId);
    res.json({ sessionId: record.id, reused });
  } catch (err) {
    next(err);
  }
});

sessionRouter.post("/end", async (req, res, next) => {
  const parsed = idBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "sessionId required" });
  try {
    const ok = await endSession(parsed.data.sessionId);
    res.json({ ok });
  } catch (err) {
    next(err);
  }
});

sessionRouter.get("/:id/status", async (req, res, next) => {
  try {
    const status = await getSessionStatus(req.params.id);
    res.json(status);
  } catch (err) {
    next(err);
  }
});
