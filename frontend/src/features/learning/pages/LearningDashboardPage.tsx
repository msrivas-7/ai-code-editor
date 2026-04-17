import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Course, LessonMeta, CourseProgress } from "../types";
import { loadCourse, loadAllLessonMetas } from "../content/courseLoader";
import { useProgressStore } from "../stores/progressStore";
import { useLearnerStore } from "../stores/learnerStore";
import { CourseCard } from "../components/CourseCard";
import { ResumeLearningCard } from "../components/ResumeLearningCard";

const COURSES = ["python-fundamentals"];

interface CourseData {
  course: Course;
  lessons: LessonMeta[];
}

export default function LearningDashboardPage() {
  const nav = useNavigate();
  const { identity } = useLearnerStore();
  const loadCourseProgress = useProgressStore((s) => s.loadCourseProgress);
  const courseProgressMap = useProgressStore((s) => s.courseProgress);

  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      COURSES.map(async (id) => {
        const [course, lessons] = await Promise.all([
          loadCourse(id),
          loadAllLessonMetas(id),
        ]);
        loadCourseProgress(identity.learnerId, id);
        return { course, lessons };
      })
    )
      .then(setCourses)
      .finally(() => setLoading(false));
  }, [identity.learnerId, loadCourseProgress]);

  const resumeCourse = courses.find((c) => {
    const p = courseProgressMap[c.course.id];
    return p && p.status === "in_progress";
  });

  const resumeProgress: CourseProgress | null =
    resumeCourse ? courseProgressMap[resumeCourse.course.id] ?? null : null;

  const nextLesson: LessonMeta | null = (() => {
    if (!resumeCourse || !resumeProgress) return null;
    return (
      resumeCourse.lessons.find(
        (l) => !resumeProgress.completedLessonIds.includes(l.id)
      ) ?? null
    );
  })();

  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      <header className="flex items-center gap-3 border-b border-border bg-panel/80 px-4 py-2 backdrop-blur">
        <button
          onClick={() => nav("/")}
          className="rounded px-2 py-1 text-xs text-muted transition hover:bg-elevated hover:text-ink"
        >
          ← Home
        </button>
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-accent to-violet text-[11px] font-bold text-bg shadow-glow">
          AI
        </div>
        <h1 className="text-sm font-semibold tracking-tight">Guided Learning</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="skeleton h-4 w-32 rounded" />
            </div>
          ) : (
            <>
              {resumeCourse && resumeProgress && nextLesson && (
                <div className="mb-8">
                  <ResumeLearningCard
                    courseTitle={resumeCourse.course.title}
                    progress={resumeProgress}
                    nextLesson={nextLesson}
                    onResume={() =>
                      nav(`/learn/course/${resumeCourse.course.id}/lesson/${nextLesson.id}`)
                    }
                  />
                </div>
              )}

              <h2 className="mb-4 text-lg font-bold">Courses</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {courses.map(({ course, lessons }) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    progress={courseProgressMap[course.id] ?? null}
                    lessonCount={lessons.length}
                    onOpen={() => nav(`/learn/course/${course.id}`)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
