# Lists

A list is an ordered collection of items. You can add, remove, sort, and iterate over items — they're one of the most useful data structures in Python.

## What you'll learn

- Creating lists and accessing items by index
- Slicing to get sublists
- Adding and removing items
- Iterating with `for` loops
- List comprehensions for concise transformations

## Instructions

You'll write two small functions that the grader will test with several inputs.

1. Write `clean(numbers)` — returns a NEW list with `0` appended to the end and any negative numbers removed. Don't modify the input list.
2. Write `average(numbers)` — returns the mean of the list (sum divided by length).
3. The starter has a driver block that reads a comma-separated list from stdin and calls your functions. Leave it as-is — it only runs when you click Run.

Example for input `3, -1, 7, 2, -4, 10`:
```
Original: [3, -1, 7, 2, -4, 10]
Cleaned: [3, 7, 2, 10, 0]
Sum: 22
Average: 4.4
```

## Key concepts

**Creating and accessing:**

```python
nums = [10, 20, 30]
first = nums[0]      # 10
last = nums[-1]      # 30
sub = nums[1:3]      # [20, 30]
```

**Modifying:**

```python
nums.append(40)       # add to end
nums.remove(20)       # remove first occurrence
nums.pop()            # remove and return last item
```

**Iterating:**

```python
for n in nums:
    print(n)
```

**List comprehension** — a compact way to build a new list:

```python
positives = [n for n in nums if n > 0]
```

`len(nums)` gives you the number of items. `sum(nums)` adds them all up.

## Hints

- To split a comma-separated string: `"3, -1, 7".split(",")` gives `["3", " -1", " 7"]`.
- You'll need `int(x.strip())` to convert each piece to a number.
- Don't modify a list while iterating over it — build a new one instead (list comprehension is perfect for this).
