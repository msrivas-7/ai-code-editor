# Dictionaries

A dictionary maps **keys** to **values** — like a real dictionary maps words to definitions. They're the go-to structure when you need to look something up by name.

## What you'll learn

- Creating dictionaries with `{key: value}`
- Accessing values by key
- Using `.get()` for safe access (no crash if key is missing)
- Iterating over keys, values, and items
- Nesting dictionaries

## Instructions

You'll write two small functions that the grader will test with several inputs.

1. Write `count_words(words)` — takes a list of words and returns a dict mapping each word to how many times it appears.
2. Write `most_frequent(counts)` — takes a counts dict and returns the word with the highest count. If two words tie, return the one that comes first alphabetically.
3. The starter has a driver that reads words from stdin and prints the sorted counts plus the most frequent word. Leave it as-is — it only runs when you click Run.

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
