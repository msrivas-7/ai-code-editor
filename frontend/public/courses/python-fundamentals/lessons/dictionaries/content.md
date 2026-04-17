# Dictionaries

A dictionary maps **keys** to **values** — like a real dictionary maps words to definitions. They're the go-to structure when you need to look something up by name.

## What you'll learn

- Creating dictionaries with `{key: value}`
- Accessing values by key
- Using `.get()` for safe access (no crash if key is missing)
- Iterating over keys, values, and items
- Nesting dictionaries

## Instructions

1. The starter code gives you a list of words from stdin.
2. Build a **word frequency counter**: a dictionary where each key is a word and each value is how many times that word appears.
3. Print each word and its count, sorted alphabetically.
4. Print the most frequent word.

Example for input `apple banana apple cherry banana apple`:
```
apple: 3
banana: 2
cherry: 1
Most frequent: apple (3 times)
```

## Key concepts

**Creating and accessing:**

```python
scores = {"alice": 92, "bob": 85}
alice_score = scores["alice"]       # 92
```

**Safe access with `.get()`:**

```python
score = scores.get("charlie", 0)    # 0 (default, no KeyError)
```

**Adding / updating:**

```python
scores["charlie"] = 78    # add new key
scores["alice"] = 95       # update existing key
```

**Iterating:**

```python
for name, score in scores.items():
    print(f"{name}: {score}")
```

**Counting pattern:**

```python
counts = {}
for word in words:
    counts[word] = counts.get(word, 0) + 1
```

## Hints

- Split the input string with `.split()` (splits on whitespace by default).
- Use `sorted(counts.items())` to iterate alphabetically.
- To find the max, look at `max(counts, key=counts.get)`.
