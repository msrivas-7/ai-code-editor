export type Language = "python" | "javascript" | "c" | "cpp" | "java";

export interface LanguageCommand {
  entrypoint: string;
  compile: { label: string; shell: string } | null;
  run: { label: string; shell: string };
}

export const LANGUAGES: readonly Language[] = [
  "python",
  "javascript",
  "c",
  "cpp",
  "java",
] as const;

export function isLanguage(x: unknown): x is Language {
  return typeof x === "string" && (LANGUAGES as readonly string[]).includes(x);
}

export function commandFor(language: Language): LanguageCommand {
  switch (language) {
    case "python":
      return {
        entrypoint: "main.py",
        compile: null,
        run: { label: "run", shell: "python3 main.py" },
      };
    case "javascript":
      return {
        entrypoint: "main.js",
        compile: null,
        run: { label: "run", shell: "node main.js" },
      };
    case "c":
      return {
        entrypoint: "main.c",
        compile: { label: "compile", shell: "gcc -O0 -Wall -o /tmp/out *.c" },
        run: { label: "run", shell: "/tmp/out" },
      };
    case "cpp":
      return {
        entrypoint: "main.cpp",
        compile: {
          label: "compile",
          shell: "g++ -std=c++17 -O0 -Wall -o /tmp/out *.cpp",
        },
        run: { label: "run", shell: "/tmp/out" },
      };
    case "java":
      return {
        entrypoint: "Main.java",
        compile: { label: "compile", shell: "javac *.java" },
        run: { label: "run", shell: "java Main" },
      };
  }
}
