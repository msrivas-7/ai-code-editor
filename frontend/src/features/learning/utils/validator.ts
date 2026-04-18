import type { CompletionRule, ValidationResult } from "../types";
import type { RunResult, ProjectFile } from "../../../types";

// Word-boundary-aware substring check. For patterns that start with an
// identifier character (letter/digit/underscore), requires a word boundary
// on the left — otherwise "int(" would falsely match inside "print(". For
// patterns starting with a non-word char (".get(", "else:"), falls back to
// plain substring matching.
function containsPattern(content: string, pattern: string): boolean {
  if (!pattern) return true;
  if (!/^\w/.test(pattern)) return content.includes(pattern);
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}`).test(content);
}

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
        } else if (actual.length === 0) {
          feedback.push("Your code ran but produced no output. Make sure you're using print().");
          nextHints.push("Add a print() statement to display your result.");
          allPassed = false;
        } else {
          feedback.push(`Expected "${expected}" in output, but got: "${actual.slice(0, 80)}"`);
          nextHints.push("Compare your output carefully — check spelling, spacing, and punctuation.");
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
        if (containsPattern(file.content, pattern)) {
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
