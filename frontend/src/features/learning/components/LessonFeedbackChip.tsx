import { lazy, Suspense, useRef, useState } from "react";

// Phase 20-P1 follow-up: contextual feedback chip shown on LessonCompletePanel.
// The persistent FeedbackButton remains the "I have a complaint right now"
// escape hatch; this chip harvests the quieter "that was confusing but I
// wouldn't have clicked Feedback on my own" signal at peak context.
//
// Session-scoped: once the learner submits from the chip in a given tab,
// sessionStorage remembers the fact and subsequent lesson completions don't
// re-nag them. Dismissing (clicking nothing) does NOT set the flag — they'll
// see it again on the next lesson complete, which is fine because it's
// passive. Key name matches the privacy contract (no PII).

const FeedbackModalLazy = lazy(() =>
  import("../../../components/FeedbackModal").then((m) => ({ default: m.FeedbackModal })),
);

export const LESSON_FEEDBACK_SESSION_KEY = "feedback-chip-submitted";

export type LessonFeedbackMood = "good" | "okay" | "bad";

// Exported so a unit test can pin the mood→category mapping: mis-mapping
// 😕 to "other" would drown the bug signal in generic traffic.
export const LESSON_FEEDBACK_MOODS: Array<{
  mood: LessonFeedbackMood;
  emoji: string;
  label: string;
  category: "other" | "bug";
}> = [
  { mood: "good", emoji: "😊", label: "This lesson was good", category: "other" },
  { mood: "okay", emoji: "😐", label: "This lesson was okay", category: "other" },
  { mood: "bad", emoji: "😕", label: "This lesson was confusing", category: "bug" },
];

interface LessonFeedbackChipProps {
  lessonTitle: string;
}

function alreadySubmittedThisSession(): boolean {
  try {
    return sessionStorage.getItem(LESSON_FEEDBACK_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function LessonFeedbackChip({ lessonTitle }: LessonFeedbackChipProps) {
  const [hidden, setHidden] = useState(() => alreadySubmittedThisSession());
  const [openMood, setOpenMood] = useState<LessonFeedbackMood | null>(null);
  // Tracks a successful submit within this component's lifetime so close
  // collapses the chip even if sessionStorage is blocked (private mode).
  const submittedRef = useRef(false);

  if (hidden) return null;

  const selected = LESSON_FEEDBACK_MOODS.find((m) => m.mood === openMood);

  function handleSubmitted() {
    submittedRef.current = true;
    try {
      sessionStorage.setItem(LESSON_FEEDBACK_SESSION_KEY, "1");
    } catch {
      // sessionStorage unavailable (e.g. Safari private mode pre-2022).
      // submittedRef still covers the close-after-submit path below.
    }
  }

  function handleClose() {
    // Closing after a successful submit is how we collapse the chip row
    // itself — we don't want the same "How was this lesson?" prompt to
    // re-appear next to the just-dismissed "Thanks" flow.
    if (submittedRef.current) {
      setHidden(true);
    }
    setOpenMood(null);
  }

  return (
    <>
      <div
        className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-elevated/40 px-3 py-2"
        data-testid="lesson-feedback-chip"
      >
        <span className="text-[11px] font-medium text-muted">How was this lesson?</span>
        <div className="flex gap-1" role="group" aria-label="Lesson feedback">
          {LESSON_FEEDBACK_MOODS.map(({ mood, emoji, label }) => (
            <button
              key={mood}
              type="button"
              onClick={() => setOpenMood(mood)}
              aria-label={label}
              data-testid={`lesson-feedback-${mood}`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent bg-panel/80 text-base transition hover:border-accent/40 hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span aria-hidden="true">{emoji}</span>
            </button>
          ))}
        </div>
      </div>
      {selected && (
        <Suspense fallback={null}>
          <FeedbackModalLazy
            onClose={handleClose}
            onSubmitted={handleSubmitted}
            initialCategory={selected.category}
            initialBody={`Lesson: ${lessonTitle}\n\n`}
          />
        </Suspense>
      )}
    </>
  );
}
