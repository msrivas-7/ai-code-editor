# Lists

A list is an ordered collection of items. You can add, remove, sort, and iterate over items — they're one of the most useful data structures in Python.

## What you'll learn

- Creating lists and accessing items by index
- Slicing to get sublists
- Adding and removing items
- Iterating with `for` loops
- List comprehensions for concise transformations

## Instructions

1. The starter code gives you a list of numbers read from stdin (comma-separated).
2. Write code that:
   - Prints the original list
   - Appends the number `0` to the end
   - Removes any negative numbers
   - Prints the cleaned list
   - Prints the sum and average of the cleaned list

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
