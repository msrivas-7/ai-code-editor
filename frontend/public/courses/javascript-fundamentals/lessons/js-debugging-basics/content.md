# Debugging

Code does what you wrote, not what you meant. Once you internalize that — really internalize it — debugging stops being a panic and starts being a routine. This lesson teaches the move you'll use forever, then has you fix four small bugs that walk through the most common patterns.

## What you'll learn

- Use `console.log` to see what variables actually hold mid-function
- Read code top-down, looking for the gap between *intent* and *behavior*
- Recognize a few bug shapes the first time you meet them so they don't fool you twice

## Instructions

The function `findMax(numbers)` is supposed to return the largest number in an array. The starter code looks reasonable, and it even passes some tests. But it's wrong — and the test that catches it is *all-negative inputs*.

Your job:

1. **Read the failing test in the Examples tab.** It tells you what the bug looks like.
2. **Add a `console.log` inside the loop** to see how `max` evolves on the all-negative case. (You can leave it in for now; you can clean up at the end.)
3. **Find the wrong assumption.** Fix it.
4. **Run again.** Tests pass.

The bug is in ONE line. You've been writing this kind of code already in earlier lessons.

## Key concepts

### console.log is your microscope

You can't see what's happening inside a running function. Add `console.log` to make the invisible visible:

```javascript
function findMax(numbers) {
  let max = 0;
  for (const n of numbers) {
    console.log("checking", n, "current max:", max);  // ← this is the trick
    if (n > max) max = n;
  }
  return max;
}
```

The labels matter: `"checking", n, "current max:", max` is much easier to read than `n` alone. When the printout looks wrong, you've found the bug.

### Read what's there, not what you meant

Beginners (and pros, honestly) reread their own code and *see what they meant to write*, not what's actually there. The trick is to read each line as if a stranger wrote it:

- "What does this line literally do?"
- "What's in each variable when this line runs?"
- "Is that what I expected?"

`console.log` is how you turn the second question from a guess into a fact.

### The four practice exercises

The exercises in the Practice tab each contain a small bug. They're modeled on the four most common bug shapes — one per exercise. You don't need to know which is which up front; just read the failing test, run the code, drop in a `console.log`, and watch what happens. By the time you finish all four, the patterns will start jumping out at you.

## Hints

1. The bug in `findMax` is the line that initializes `max`. What if every number in the array is smaller than the initial value?
2. Initialize `max` to `numbers[0]` instead of a hardcoded value.
3. `let max = numbers[0];` — now whatever the first element is, that's the starting point, and the loop lifts it from there.
