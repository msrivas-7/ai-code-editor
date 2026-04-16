import { create } from "zustand";
import type { Language, ProjectFile } from "../types";

const STARTER: Record<Language, ProjectFile[]> = {
  python: [
    {
      path: "main.py",
      content:
        'from stats import mean, median, variance\n\n' +
        'values = [12, 4, 7, 9, 15, 3, 8, 11, 6, 10]\n\n' +
        'print(f"values : {values}")\n' +
        'print(f"mean   : {mean(values):.2f}")\n' +
        'print(f"median : {median(values):.2f}")\n' +
        'print(f"var    : {variance(values):.2f}")\n',
    },
    {
      path: "stats.py",
      content:
        'def mean(values):\n' +
        '    return sum(values) / len(values)\n\n\n' +
        'def median(values):\n' +
        '    s = sorted(values)\n' +
        '    n = len(s)\n' +
        '    mid = n // 2\n' +
        '    if n % 2 == 0:\n' +
        '        return (s[mid - 1] + s[mid]) / 2\n' +
        '    return s[mid]\n\n\n' +
        'def variance(values):\n' +
        '    mu = mean(values)\n' +
        '    return sum((x - mu) ** 2 for x in values) / len(values)\n',
    },
  ],
  javascript: [
    {
      path: "main.js",
      content:
        'const { wordFrequency, topN } = require("./frequency.js");\n\n' +
        'const text = `\n' +
        '  the quick brown fox jumps over the lazy dog\n' +
        '  the dog barks and the fox runs away\n' +
        '  the quick fox is quick and the dog is lazy\n' +
        '`;\n\n' +
        'const freq = wordFrequency(text);\n' +
        'const top = topN(freq, 5);\n\n' +
        'console.log("top 5 words:");\n' +
        'for (const [word, count] of top) {\n' +
        '  console.log(`  ${word.padEnd(10)} ${count}`);\n' +
        '}\n',
    },
    {
      path: "frequency.js",
      content:
        'function wordFrequency(text) {\n' +
        '  const counts = new Map();\n' +
        '  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];\n' +
        '  for (const w of words) {\n' +
        '    counts.set(w, (counts.get(w) ?? 0) + 1);\n' +
        '  }\n' +
        '  return counts;\n' +
        '}\n\n' +
        'function topN(freq, n) {\n' +
        '  return [...freq.entries()]\n' +
        '    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))\n' +
        '    .slice(0, n);\n' +
        '}\n\n' +
        'module.exports = { wordFrequency, topN };\n',
    },
  ],
  c: [
    {
      path: "main.c",
      content:
        '#include <stdio.h>\n' +
        '#include "mathx.h"\n\n' +
        'int main(void) {\n' +
        '    int nums[] = {3, 1, 4, 1, 5, 9, 2, 6, 5, 3};\n' +
        '    int n = sizeof(nums) / sizeof(nums[0]);\n\n' +
        '    printf("sum    = %d\\n", array_sum(nums, n));\n' +
        '    printf("max    = %d\\n", array_max(nums, n));\n' +
        '    printf("5!  = %ld\\n", factorial(5));\n' +
        '    printf("10! = %ld\\n", factorial(10));\n' +
        '    return 0;\n' +
        '}\n',
    },
    {
      path: "mathx.c",
      content:
        '#include "mathx.h"\n\n' +
        'int array_sum(const int *arr, int n) {\n' +
        '    int total = 0;\n' +
        '    for (int i = 0; i < n; i++) {\n' +
        '        total += arr[i];\n' +
        '    }\n' +
        '    return total;\n' +
        '}\n\n' +
        'int array_max(const int *arr, int n) {\n' +
        '    int best = arr[0];\n' +
        '    for (int i = 1; i < n; i++) {\n' +
        '        if (arr[i] > best) best = arr[i];\n' +
        '    }\n' +
        '    return best;\n' +
        '}\n\n' +
        'long factorial(int n) {\n' +
        '    long r = 1;\n' +
        '    for (int i = 2; i <= n; i++) {\n' +
        '        r *= i;\n' +
        '    }\n' +
        '    return r;\n' +
        '}\n',
    },
    {
      path: "mathx.h",
      content:
        '#ifndef MATHX_H\n' +
        '#define MATHX_H\n\n' +
        'int array_sum(const int *arr, int n);\n' +
        'int array_max(const int *arr, int n);\n' +
        'long factorial(int n);\n\n' +
        '#endif\n',
    },
  ],
  cpp: [
    {
      path: "main.cpp",
      content:
        '#include <iostream>\n' +
        '#include <vector>\n' +
        '#include "strings.h"\n\n' +
        'int main() {\n' +
        '    std::vector<std::string> samples = {\n' +
        '        "racecar",\n' +
        '        "hello",\n' +
        '        "A man a plan a canal Panama",\n' +
        '        "not a palindrome",\n' +
        '        "step on no pets",\n' +
        '    };\n\n' +
        '    for (const auto &s : samples) {\n' +
        '        std::cout << (is_palindrome(s) ? "[yes] " : "[no ] ")\n' +
        '                  << s << "  (reversed: " << reverse(s) << ")\\n";\n' +
        '    }\n' +
        '    return 0;\n' +
        '}\n',
    },
    {
      path: "strings.cpp",
      content:
        '#include <cctype>\n' +
        '#include <string>\n' +
        '#include "strings.h"\n\n' +
        'std::string reverse(const std::string &s) {\n' +
        '    return std::string(s.rbegin(), s.rend());\n' +
        '}\n\n' +
        'bool is_palindrome(const std::string &s) {\n' +
        '    std::string cleaned;\n' +
        '    for (char c : s) {\n' +
        '        if (std::isalnum(static_cast<unsigned char>(c))) {\n' +
        '            cleaned.push_back(std::tolower(static_cast<unsigned char>(c)));\n' +
        '        }\n' +
        '    }\n' +
        '    int i = 0;\n' +
        '    int j = static_cast<int>(cleaned.size()) - 1;\n' +
        '    while (i < j) {\n' +
        '        if (cleaned[i] != cleaned[j]) return false;\n' +
        '        i++;\n' +
        '        j--;\n' +
        '    }\n' +
        '    return true;\n' +
        '}\n',
    },
    {
      path: "strings.h",
      content:
        '#pragma once\n\n' +
        '#include <string>\n\n' +
        'std::string reverse(const std::string &s);\n' +
        'bool is_palindrome(const std::string &s);\n',
    },
  ],
  java: [
    {
      path: "Main.java",
      content:
        'public class Main {\n' +
        '    public static void main(String[] args) {\n' +
        '        int[][] m = {\n' +
        '            {1, 2, 3},\n' +
        '            {4, 5, 6},\n' +
        '            {7, 8, 9},\n' +
        '        };\n\n' +
        '        System.out.println("original:");\n' +
        '        Matrix.print(m);\n\n' +
        '        System.out.println("\\ntranspose:");\n' +
        '        Matrix.print(Matrix.transpose(m));\n\n' +
        '        System.out.println("\\nsum = " + Matrix.sum(m));\n' +
        '        System.out.println("trace = " + Matrix.trace(m));\n' +
        '    }\n' +
        '}\n',
    },
    {
      path: "Matrix.java",
      content:
        'public class Matrix {\n' +
        '    public static int[][] transpose(int[][] m) {\n' +
        '        int rows = m.length;\n' +
        '        int cols = m[0].length;\n' +
        '        int[][] t = new int[cols][rows];\n' +
        '        for (int i = 0; i < rows; i++) {\n' +
        '            for (int j = 0; j < cols; j++) {\n' +
        '                t[j][i] = m[i][j];\n' +
        '            }\n' +
        '        }\n' +
        '        return t;\n' +
        '    }\n\n' +
        '    public static int sum(int[][] m) {\n' +
        '        int total = 0;\n' +
        '        for (int[] row : m) {\n' +
        '            for (int v : row) total += v;\n' +
        '        }\n' +
        '        return total;\n' +
        '    }\n\n' +
        '    public static int trace(int[][] m) {\n' +
        '        int t = 0;\n' +
        '        int n = Math.min(m.length, m[0].length);\n' +
        '        for (int i = 0; i < n; i++) t += m[i][i];\n' +
        '        return t;\n' +
        '    }\n\n' +
        '    public static void print(int[][] m) {\n' +
        '        for (int[] row : m) {\n' +
        '            StringBuilder sb = new StringBuilder("  ");\n' +
        '            for (int v : row) sb.append(String.format("%4d", v));\n' +
        '            System.out.println(sb);\n' +
        '        }\n' +
        '    }\n' +
        '}\n',
    },
  ],
};

interface ProjectState {
  language: Language;
  files: Record<string, string>;
  activeFile: string | null;
  order: string[];
  setLanguage: (lang: Language) => void;
  setActive: (path: string) => void;
  setContent: (path: string, content: string) => void;
  createFile: (path: string, content?: string) => { ok: boolean; error?: string };
  deleteFile: (path: string) => void;
  renameFile: (from: string, to: string) => { ok: boolean; error?: string };
  snapshot: () => ProjectFile[];
  resetToStarter: (lang: Language) => void;
}

function seedFor(lang: Language) {
  const seed = STARTER[lang];
  return {
    files: Object.fromEntries(seed.map((f) => [f.path, f.content])),
    order: seed.map((f) => f.path),
    activeFile: seed[0]?.path ?? null,
  };
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  language: "python",
  ...seedFor("python"),
  setLanguage: (lang) => set({ language: lang }),
  setActive: (path) => set({ activeFile: path }),
  setContent: (path, content) =>
    set((s) => ({ files: { ...s.files, [path]: content } })),
  createFile: (path, content = "") => {
    const s = get();
    if (s.files[path]) return { ok: false, error: "file exists" };
    if (!/^[A-Za-z0-9_./-]+$/.test(path) || path.includes("..")) {
      return { ok: false, error: "invalid path" };
    }
    set({
      files: { ...s.files, [path]: content },
      order: [...s.order, path],
      activeFile: path,
    });
    return { ok: true };
  },
  deleteFile: (path) =>
    set((s) => {
      if (!s.files[path]) return s;
      const files = { ...s.files };
      delete files[path];
      const order = s.order.filter((p) => p !== path);
      const activeFile = s.activeFile === path ? order[0] ?? null : s.activeFile;
      return { files, order, activeFile };
    }),
  renameFile: (from, to) => {
    const s = get();
    if (!s.files[from]) return { ok: false, error: "source not found" };
    if (s.files[to]) return { ok: false, error: "destination exists" };
    if (!/^[A-Za-z0-9_./-]+$/.test(to) || to.includes("..")) {
      return { ok: false, error: "invalid path" };
    }
    const files = { ...s.files, [to]: s.files[from] };
    delete files[from];
    const order = s.order.map((p) => (p === from ? to : p));
    const activeFile = s.activeFile === from ? to : s.activeFile;
    set({ files, order, activeFile });
    return { ok: true };
  },
  snapshot: () => {
    const s = get();
    return s.order.map((p) => ({ path: p, content: s.files[p] ?? "" }));
  },
  resetToStarter: (lang) =>
    set({ language: lang, ...seedFor(lang) }),
}));
