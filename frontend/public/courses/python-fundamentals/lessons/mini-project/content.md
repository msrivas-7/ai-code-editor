# Mini Project: Student Grade Book

Time to put it all together. You'll build a complete program that reads student data, calculates grades, and prints a summary — using every concept from the course.

## What you'll build

A grade book program that:
1. Reads student names and scores from stdin
2. Stores them in a dictionary
3. Calculates the letter grade for each student
4. Prints a formatted report with class statistics

## Instructions

**Input format** (via the stdin tab):
```
Alice 92
Bob 78
Charlie 85
Diana 96
Eve 64
```

Each line has a name and a numeric score, separated by a space.

**Expected output:**
```
--- Grade Book ---
Alice:   92 (A)
Bob:     78 (C)
Charlie: 85 (B)
Diana:   96 (A)
Eve:     64 (D)

Class average: 83.0
Highest: Diana (96)
Lowest: Eve (64)
Passing: 5/5
```

## Requirements

- Write a function `letter_grade(score)` that returns "A"/"B"/"C"/"D"/"F" (same thresholds as the conditionals lesson).
- Store students in a **dictionary**: `{name: score}`.
- Use a **loop** to process each student.
- Use `.get()` or dictionary iteration to calculate statistics.
- Use **f-strings** with alignment for clean formatting (e.g., `f"{name:<8} {score}"`).

## Hints

- Read lines until input is empty: `import sys` and use `sys.stdin.read().strip().splitlines()`.
- Or use a try/except around `input()` to handle EOF.
- For the highest/lowest, you can use `max()` and `min()` with a `key` function.
- Left-align names with `f"{name:<8}"` — the `<8` means left-aligned, 8 characters wide.
- This is meant to be the hardest lesson — take your time and build it piece by piece.
