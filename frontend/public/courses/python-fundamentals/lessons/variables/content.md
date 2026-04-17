# Variables and Types

Variables are named containers that hold data. Think of them as labeled boxes you can put values into and retrieve later.

## What you'll learn

- How to create variables with `=`
- Python's basic types: `int`, `float`, `str`, `bool`
- How to format output with f-strings

## Instructions

1. Look at the starter code — it has some variables already defined.
2. Add the missing variables so the output matches exactly:
   ```
   Name: Alice
   Age: 25
   Height: 1.68 meters
   Student: True
   ```
3. Use **f-strings** (formatted string literals) for the print statements.

## Key concepts

**Assignment** uses `=`. The variable name goes on the left, the value on the right:

```python
name = "Alice"
age = 25
```

**Types** are automatic — Python figures out the type from the value:
- `"Alice"` → `str` (string / text)
- `25` → `int` (whole number)
- `1.68` → `float` (decimal number)
- `True` → `bool` (boolean / true or false)

**f-strings** let you embed variables directly in a string:

```python
print(f"Name: {name}")
```

The `f` before the opening quote is what makes it an f-string. Expressions inside `{}` are evaluated and inserted.

## Hints

- Make sure you're using `f"..."` (not just `"..."`).
- `True` and `False` are capitalized in Python — they're special keywords.
- The height should be a `float`, not an `int`.
