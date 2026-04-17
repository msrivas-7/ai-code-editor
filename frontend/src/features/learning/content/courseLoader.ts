import type { Course, LessonMeta, Lesson } from "../types";

const COURSE_BASE = "/courses";

export async function loadCourse(courseId: string): Promise<Course> {
  const res = await fetch(`${COURSE_BASE}/${courseId}/course.json`);
  if (!res.ok) throw new Error(`Course not found: ${courseId}`);
  return res.json();
}

export async function loadLessonMeta(
  courseId: string,
  lessonId: string
): Promise<LessonMeta> {
  const res = await fetch(
    `${COURSE_BASE}/${courseId}/lessons/${lessonId}/lesson.json`
  );
  if (!res.ok) throw new Error(`Lesson not found: ${courseId}/${lessonId}`);
  return res.json();
}

export async function loadLessonContent(
  courseId: string,
  lessonId: string
): Promise<string> {
  const res = await fetch(
    `${COURSE_BASE}/${courseId}/lessons/${lessonId}/content.md`
  );
  if (!res.ok) return "";
  return res.text();
}

export async function loadStarterFiles(
  courseId: string,
  lessonId: string
): Promise<{ path: string; content: string }[]> {
  const indexRes = await fetch(
    `${COURSE_BASE}/${courseId}/lessons/${lessonId}/starter/_index.json`
  );
  const isJson = indexRes.ok &&
    (indexRes.headers.get("content-type") ?? "").includes("application/json");
  if (!isJson) {
    const fallback = await fetch(
      `${COURSE_BASE}/${courseId}/lessons/${lessonId}/starter/main.py`
    );
    if (!fallback.ok) return [];
    const text = await fallback.text();
    if (text.trimStart().startsWith("<!")) return [];
    return [{ path: "main.py", content: text }];
  }
  const filenames: string[] = await indexRes.json();
  const files = await Promise.all(
    filenames.map(async (name) => {
      const r = await fetch(
        `${COURSE_BASE}/${courseId}/lessons/${lessonId}/starter/${name}`
      );
      return { path: name, content: r.ok ? await r.text() : "" };
    })
  );
  return files;
}

export async function loadFullLesson(
  courseId: string,
  lessonId: string
): Promise<Lesson> {
  const [meta, content, starterFiles] = await Promise.all([
    loadLessonMeta(courseId, lessonId),
    loadLessonContent(courseId, lessonId),
    loadStarterFiles(courseId, lessonId),
  ]);
  return { ...meta, content, starterFiles };
}

export async function loadAllLessonMetas(
  courseId: string
): Promise<LessonMeta[]> {
  const course = await loadCourse(courseId);
  const metas = await Promise.all(
    course.lessonOrder.map((id) => loadLessonMeta(courseId, id))
  );
  return metas;
}
