# Conditionals

Programs need to make decisions. Conditionals let your code take different paths depending on whether something is true or false.

## What you'll learn

- `if`, `elif`, and `else` blocks
- Comparison operators: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Combining conditions with `and`, `or`, `not`

## Instructions

1. The starter code reads a numeric score from stdin.
2. Write a grading function that prints the letter grade:
   - 90 and above → `"A"`
   - 80–89 → `"B"`
   - 70–79 → `"C"`
   - 60–69 → `"D"`
   - Below 60 → `"F"`
3. Also print `"Passing"` if the grade is D or above, otherwise `"Failing"`.

Example output for input `85`:
```
Score: 85
Grade: B
Passing
```

## Key concepts

**if/elif/else** checks conditions top-to-bottom and runs the first one that's true:

```python
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
else:
    grade = "F"
```

**Comparison operators** produce `True` or `False`:
- `==` equal, `!=` not equal
- `<` less than, `>` greater than
- `<=` less or equal, `>=` greater or equal

**Logical operators** combine conditions:
- `and` — both must be true
- `or` — at least one must be true
- `not` — flips true to false

## Hints

- Use `elif` for the middle ranges — don't use a separate `if` for each.
- Indentation matters in Python. Each block under `if`/`elif`/`else` must be indented.
- The order of your `elif` checks matters — start from the highest threshold.
