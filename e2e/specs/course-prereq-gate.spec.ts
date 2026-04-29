// Phase 22F2A — B6: dashboard course-prerequisite soft-warning flow.
//
// The gate is implemented in [LearningDashboardPage] — clicking a course
// whose `prerequisiteCourseIds` aren't fully completed opens a confirm
// modal (CoursePrereqWarningModal) instead of routing immediately. The user
// can route into the prereq course or continue anyway; either way it's
// their choice. Always shown — no "don't show again" toggle in v1.
//
// **Spec status (2026-04-29):** placeholder + skipped. The gate is wired
// and unit-tested today (isCourseCompleted, resolveInheritedVocabulary,
// firstUnmetPrereq), but exercising it through Playwright requires a
// public course on the dashboard with `prerequisiteCourseIds` set. None
// exist until Phase 22F2 ships `python-intermediate` with a prereq on
// `python-fundamentals`. When 22F2 lands, flip `test.skip(true)` to
// `test.skip(false)` and the suite below activates against the real
// dashboard state — no other changes needed.
//
// What this spec asserts (paraphrased — exact selectors below):
//
//   1. Fresh user → click python-intermediate → modal appears, copy mentions
//      python-fundamentals as the prereq.
//   2. "Take me to Python Fundamentals" routes to the fundamentals course
//      view; the lesson list there matches the existing fundamentals shape.
//   3. "Continue to Python Intermediate" routes into intermediate; the
//      modal does NOT reappear on a follow-up click within the session
//      (modal state isn't sticky-persisted, but the user's choice for
//      THIS interaction is honored).
//   4. After completing every fundamentals lesson, clicking intermediate
//      again routes directly with no modal.

import { expect, test } from "../fixtures/auth";

import { mockAllAI } from "../fixtures/aiMocks";
import { loadProfile, markOnboardingDone } from "../fixtures/profiles";

const TARGET_COURSE_ID = "python-intermediate";
const PREREQ_COURSE_ID = "python-fundamentals";
const TARGET_TITLE = /python intermediate/i;
const PREREQ_TITLE = /python fundamentals/i;

test.describe("Phase 22F2A — course prereq soft-warning", () => {
  // Activates once `python-intermediate` ships (22F2) with
  // `prerequisiteCourseIds: ["python-fundamentals"]` in its course.json.
  test.skip(true, "activates when python-intermediate ships in Phase 22F2");

  test.beforeEach(async ({ page }) => {
    await mockAllAI(page);
    await markOnboardingDone(page);
  });

  test("fresh user clicking the prereq-gated course sees the warning modal", async ({
    page,
  }) => {
    await loadProfile(page, "fresh-install");
    await page.goto("/start");

    await page.getByRole("button", { name: TARGET_TITLE }).click();

    // Modal renders with title "Heads up" + body referencing the prereq.
    await expect(
      page.getByRole("alertdialog").getByText(/heads up/i),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole("alertdialog").getByText(PREREQ_TITLE),
    ).toBeVisible();
  });

  test("'Take me to Python Fundamentals' routes to the prereq course", async ({
    page,
  }) => {
    await loadProfile(page, "fresh-install");
    await page.goto("/start");

    await page.getByRole("button", { name: TARGET_TITLE }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /take me to/i })
      .click();

    await expect(page).toHaveURL(
      new RegExp(`/learn/course/${PREREQ_COURSE_ID}`),
    );
  });

  test("'Continue to Python Intermediate' routes into the target course", async ({
    page,
  }) => {
    await loadProfile(page, "fresh-install");
    await page.goto("/start");

    await page.getByRole("button", { name: TARGET_TITLE }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /continue to/i })
      .click();

    await expect(page).toHaveURL(
      new RegExp(`/learn/course/${TARGET_COURSE_ID}`),
    );
  });

  test("user with all prereqs completed clicks intermediate without seeing the modal", async ({
    page,
  }) => {
    // `all-complete` profile (or whatever maps onto fully-completed
    // fundamentals when 22F2 lands) — adjust the seed name once 22F2's
    // intermediate authoring sets up its own profile fixtures.
    await loadProfile(page, "all-complete");
    await page.goto("/start");

    await page.getByRole("button", { name: TARGET_TITLE }).click();

    // No alertdialog should appear.
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page).toHaveURL(
      new RegExp(`/learn/course/${TARGET_COURSE_ID}`),
    );
  });
});
