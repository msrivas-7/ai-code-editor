export interface LessonContext {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  lessonObjectives: string[];
  conceptTags: string[];
  completionRules: { type: string; expected?: string; file?: string; pattern?: string }[];
  studentProgressSummary: string;
  lessonOrder?: number;
  totalLessons?: number;
}

export function buildLessonContextBlock(ctx: LessonContext): string {
  const objectives = ctx.lessonObjectives.map((o) => `  - ${o}`).join("\n");
  const tags = ctx.conceptTags.join(", ");
  const task = ctx.completionRules
    .map((r) => {
      if (r.type === "expected_stdout") return `produce stdout containing "${r.expected}"`;
      if (r.type === "required_file_contains") return `write code in ${r.file ?? "main.py"} containing \`${r.pattern}\``;
      return `pass custom validation`;
    })
    .join("; and ");

  const orderInfo =
    ctx.lessonOrder && ctx.totalLessons
      ? ` (lesson ${ctx.lessonOrder} of ${ctx.totalLessons})`
      : "";

  return `GUIDED LESSON${orderInfo}
You are helping a student with a specific lesson: "${ctx.lessonTitle}".

Learning objectives:
${objectives}

Concepts covered: ${tags}
The student must: ${task}
Progress: ${ctx.studentProgressSummary}

IMPORTANT LESSON RULES:
- Stay within the scope of this lesson's objectives.
- Do not introduce concepts not yet covered in this course.
- Reference the specific task the student is working on.
- Guide toward the solution without giving it away.
- If the student is stuck, give progressively stronger hints tied to the lesson task.`;
}
