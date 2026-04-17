# Functions

Functions let you name a block of code and reuse it. Instead of copying the same logic in three places, you write it once as a function and call it wherever you need it.

## What you'll learn

- How to define a function with `def`
- How parameters and return values work
- What scope means (local vs global variables)
- Default argument values

## Instructions

1. Write a function `celsius_to_fahrenheit(c)` that converts Celsius to Fahrenheit.
   - Formula: `F = C * 9/5 + 32`
2. Write a function `classify_temp(f)` that returns a string:
   - Below 32 → `"freezing"`
   - 32–59 → `"cold"`
   - 60–79 → `"comfortable"`
   - 80 and above → `"hot"`
3. Read a Celsius temperature from stdin. Convert it, classify it, and print both.

Example output for input `22`:
```
22°C = 71.6°F
Classification: comfortable
```

## Key concepts

**Defining a function:**

```python
def greet(name):
    return f"Hello, {name}!"
```

- `def` starts the definition
- `name` is a **parameter** — a placeholder for the value you'll pass in
- `return` sends a value back to the caller

**Calling a function:**

```python
message = greet("Alice")  # "Hello, Alice!"
```

**Default arguments** let you make parameters optional:

```python
def greet(name, greeting="Hello"):
    return f"{greeting}, {name}!"
```

**Scope:** Variables created inside a function only exist inside that function. They don't leak out.

## Hints

- Use `round()` if you want to limit decimal places: `round(71.6, 1)`.
- Your `classify_temp` function should use `if/elif/else` — you already know how from the conditionals lesson.
- Make sure you're calling the function and printing the result, not just defining it.
