import type { CompletionRule, ValidationResult } from "../types";
import type { RunResult, ProjectFile } from "../../../types";

export function validateLesson(
  result: RunResult | null,
  files: ProjectFile[],
  rules: CompletionRule[]
): ValidationResult {
  if (!rules.length) {
    return { passed: true, feedback: ["No validation rules — auto-pass."] };
  }

  const feedback: string[] = [];
  const nextHints: string[] = [];
  let allPassed = true;

  for (const rule of rules) {
    switch (rule.type) {
      case "expected_stdout": {
        if (!result) {
          feedback.push("Run your code first before checking.");
          allPassed = false;
          break;
        }
        if (result.exitCode !== 0) {
          feedback.push("Your code has an error — fix it and run again.");
          nextHints.push("Check the output panel for error messages.");
          allPassed = false;
          break;
        }
        const expected = (rule.expected ?? "").trim();
        const actual = (result.stdout ?? "").trim();
        if (actual.includes(expected)) {
          feedback.push(`Output contains "${expected}" — correct!`);
        } else {
          feedback.push(`Expected output to contain "${expected}" but got: "${actual.slice(0, 100)}"`);
          nextHints.push("Check your print() statement and make sure the output matches exactly.");
          allPassed = false;
        }
        break;
      }
      case "required_file_contains": {
        const targetPath = rule.file ?? "main.py";
        const file = files.find((f) => f.path === targetPath);
        if (!file) {
          feedback.push(`File "${targetPath}" not found.`);
          allPassed = false;
          break;
        }
        const pattern = rule.pattern ?? "";
        if (file.content.includes(pattern)) {
          feedback.push(`File "${targetPath}" contains the required code.`);
        } else {
          feedback.push(`File "${targetPath}" is missing required code pattern.`);
          nextHints.push(`Make sure your code in ${targetPath} uses the required approach.`);
          allPassed = false;
        }
        break;
      }
      case "custom_validator": {
        feedback.push("Custom validation is not yet supported.");
        break;
      }
    }
  }

  return { passed: allPassed, feedback, nextHints: nextHints.length > 0 ? nextHints : undefined };
}
