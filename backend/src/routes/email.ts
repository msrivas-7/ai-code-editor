import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { config } from "../config.js";
import { setEmailOptInDirect } from "../db/preferences.js";
import { verifyUnsubscribeToken } from "../services/email/unsubscribeTokens.js";

// Phase 22D: one-click unsubscribe for the streak nudge email.
//
// Mounted at /api/email/* with NO csrf and NO auth — the link is
// opened from an external mail client where neither apply. Authenticity
// is proven by the HMAC-signed token in the query string.
//
// Route: GET /api/email/unsubscribe?token=<HMAC-signed userId>
//   200 OK + HTML "You're unsubscribed" — token verified, opt_in flipped
//   401     + HTML "Link no longer valid"  — token missing/tampered/wrong-secret
//   429     + brief HTML — IP exceeded burst rate limit
//   503     + HTML "Service not configured" — backend missing the unsub
//                                            secret (only happens in
//                                            dev where streak-nudge is
//                                            also disabled)
//
// We send HTML rather than JSON because the user clicks from their
// inbox and lands in the browser; a JSON blob is a worse experience
// than even a minimal styled page. Inline brand styling matches the
// product so the page feels continuous with the email.

// Per-IP burst limit. The token check is HMAC-fast and the action
// (flip a boolean) is idempotent, so this is belt-and-suspenders
// against someone fuzzing the endpoint. Real users click once.
const unsubscribeIpLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip ?? "")}`,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitedHtml(),
  // Browsers don't render JSON-body 429s nicely; tell express-rate-limit
  // to send our HTML payload directly instead.
  handler: (_req, res) => {
    res.status(429).type("html").send(rateLimitedHtml());
  },
});

export const emailRouter: Router = Router();

emailRouter.get("/unsubscribe", unsubscribeIpLimit, async (req, res) => {
  // Backend not configured to mint/verify tokens — render a polite
  // 503 instead of mysteriously failing every link. Production should
  // never hit this branch (the deploy aborts at config-validation
  // time if streak nudge is on), but dev does.
  if (!config.email.unsubscribeSecret) {
    res
      .status(503)
      .type("html")
      .send(
        renderHtml({
          title: "Service not configured",
          message:
            "Email preferences aren't wired up on this environment. If you reached " +
            "this page from a real CodeTutor email, please reply to support.",
          replyTo: config.email.streakNudgeReplyTo,
        }),
      );
    return;
  }

  const token = String(req.query.token ?? "");
  const verified = verifyUnsubscribeToken(token);
  if (!verified) {
    res
      .status(401)
      .type("html")
      .send(
        renderHtml({
          title: "Link no longer valid",
          message:
            "This unsubscribe link couldn't be verified. The link may have " +
            "been edited, or our signing key has been rotated. Open " +
            "Settings in CodeTutor to manage your email preferences.",
          replyTo: config.email.streakNudgeReplyTo,
        }),
      );
    return;
  }

  let updated: boolean;
  try {
    updated = await setEmailOptInDirect(verified.userId, false);
  } catch (err) {
    // DB failure surfaces as a generic 500 page. Logged so on-call
    // sees the failure mode.
    console.error(
      `[email] unsubscribe DB write failed for ${verified.userId}: ${(err as Error).message}`,
    );
    res
      .status(500)
      .type("html")
      .send(
        renderHtml({
          title: "Something went wrong",
          message:
            "We couldn't update your preferences right now. Please try the link " +
            "again, or open Settings in CodeTutor to manage your email preferences.",
          replyTo: config.email.streakNudgeReplyTo,
        }),
      );
    return;
  }

  // `updated === false` means the user has no preferences row yet —
  // possible if they signed up but never touched preferences. The
  // unsubscribe still "succeeded" semantically because the streak
  // nudge sweeper requires a row with email_opt_in = true to send,
  // and no row → no email. Show the same success page either way.
  void updated;

  res
    .status(200)
    .type("html")
    .send(
      renderHtml({
        title: "You're unsubscribed",
        message:
          "We won't send streak nudges anymore. You can turn them back on " +
          "any time from Settings in CodeTutor — no hard feelings.",
        replyTo: config.email.streakNudgeReplyTo,
        showReturnLink: true,
      }),
    );
});

// ---------------------------------------------------------------------------
// HTML rendering. Single self-contained page — no external assets, no
// JS, dark surface matching the product. Inlined here rather than
// pulling a templating engine for one route.
// ---------------------------------------------------------------------------

interface RenderArgs {
  title: string;
  message: string;
  replyTo: string;
  showReturnLink?: boolean;
}

function renderHtml(args: RenderArgs): string {
  const { title, message, replyTo, showReturnLink } = args;
  const baseUrl = config.corsOrigin.replace(/\/+$/, "");
  const settingsLink = `${baseUrl}/start`;
  const returnButton = showReturnLink
    ? `<p style="margin:24px 0 0 0;">
         <a href="${escapeAttr(settingsLink)}"
            style="display:inline-block;padding:12px 24px;border-radius:9999px;
                   background-image:linear-gradient(90deg,#38bdf8,#c084fc);
                   color:#0a0e22;text-decoration:none;font-weight:600;font-size:14px;">
           Back to CodeTutor &rarr;
         </a>
       </p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(title)} &middot; CodeTutor AI</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0e22;color:#e6ecf5;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh;">
  <main style="max-width:520px;margin:0 auto;padding:96px 24px 48px 24px;">
    <h1 style="font-family:'Charter','Georgia','Times New Roman',serif;font-weight:600;font-size:32px;line-height:1.2;color:#e6ecf5;letter-spacing:-0.01em;margin:0 0 16px 0;">
      ${escapeHtml(title)}
    </h1>
    <p style="font-size:15px;line-height:1.65;color:#94a3b8;margin:0;">
      ${escapeHtml(message)}
    </p>
    ${returnButton}
    <p style="margin:48px 0 0 0;font-size:12px;line-height:1.6;color:#64748b;">
      Questions? <a href="mailto:${escapeAttr(replyTo)}" style="color:#94a3b8;text-decoration:underline;">${escapeHtml(replyTo)}</a>
    </p>
  </main>
</body>
</html>`;
}

function rateLimitedHtml(): string {
  return renderHtml({
    title: "Slow down",
    message:
      "We've seen a lot of requests from your network in a short window. " +
      "Wait a minute and try this link again.",
    replyTo: "support@codetutor.msrivas.com",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
