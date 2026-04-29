# Capstone: Todo List

You've now seen most of the JavaScript fundamentals. This capstone takes them somewhere most beginners don't reach until much later: **immutable updates**. Instead of changing data in place, you'll write functions that return *new* versions of the list. That sounds like extra work, but it's the trick that makes real-world apps debuggable. (It's also how every React app updates state.)

## What you'll learn

- How to add to a list without mutating it: `[...arr, newItem]`
- How to change one field of an object without mutating it: `{ ...obj, field: newValue }`
- How `reduce` collapses a list down to a single answer

## Instructions

You'll write four functions and a one-line driver:

### 1. `addTodo(todos, text)`

Returns a NEW array containing all the existing todos plus a new one at the end. The new todo is `{ id, text, done: false }` where `id` is one greater than the largest id currently in the list (or `1` if the list is empty).

```javascript
addTodo([], "first")
// → [{ id: 1, text: "first", done: false }]

addTodo([{ id: 1, text: "a", done: true }], "b")
// → [{ id: 1, text: "a", done: true }, { id: 2, text: "b", done: false }]
```

### 2. `toggleTodo(todos, id)`

Returns a NEW array. The matching todo has `done` flipped; other todos are unchanged. If no todo matches, returns the list as-is.

### 3. `activeTodos(todos)`

Returns the todos that are NOT done.

### 4. `stats(todos)`

Returns an object: `{ total, active, completed }` — three counts.

```javascript
stats([{...done:true}, {...done:false}, {...done:false}])
// → { total: 3, active: 2, completed: 1 }
```

### Driver

After your functions are correct, this should print `Total: 3, Active: 2, Completed: 1`:

```javascript
let todos = [];
todos = addTodo(todos, "Buy groceries");
todos = addTodo(todos, "Finish report");
todos = addTodo(todos, "Call dentist");
todos = toggleTodo(todos, 2);

const s = stats(todos);
console.log(`Total: ${s.total}, Active: ${s.active}, Completed: ${s.completed}`);
```

## Key concepts

### The spread operator: copy with edits

In an array:

```javascript
const a = [1, 2, 3];
const b = [...a, 4];   // b is [1, 2, 3, 4]; a is still [1, 2, 3]
```

`...a` "spreads" the elements of `a` into the new array. You can also spread at the start (`[0, ...a]`) or in the middle.

In an object:

```javascript
const todo = { id: 1, text: "buy milk", done: false };
const updated = { ...todo, done: true };
// updated is { id: 1, text: "buy milk", done: true }
// todo is unchanged
```

`...todo` copies all the existing fields into the new object. Then `done: true` overrides one. The original is untouched.

This pattern — spread-then-override — is how you "change" data without mutating it.

### Why immutable?

Imagine you have:

```javascript
const todos = [{ id: 1, done: false }];

function showStatus(t) {
  console.log("done:", t.done);
}

showStatus(todos[0]);   // "done: false"  ← what you'd expect

// Some other code somewhere mutates the same object:
todos[0].done = true;

showStatus(todos[0]);   // "done: true"   ← surprise!
```

If `done` had been a NEW object instead of a mutated one, no one's reference would change unexpectedly. That's the immutability rule: don't change what other code might still be reading. You'll see this pattern in React, Redux, and most modern JS — once you internalize it, you stop fighting it.

### `reduce` — fold a list to one value

`filter` returns a smaller array. `map` returns a same-size array. `reduce` returns ONE thing (a number, an object, anything).

```javascript
const sum = [1, 2, 3, 4].reduce((acc, n) => acc + n, 0);
// 10
```

The arguments:
- `acc` — the running result so far. Starts as the **second** argument (`0` here).
- `n` — the current array element.
- The callback returns the **new** running result, which becomes `acc` next time.

For `stats`, you can build the counts object in one pass:

```javascript
function stats(todos) {
  return todos.reduce(
    (acc, t) => {
      acc.total++;
      t.done ? acc.completed++ : acc.active++;
      return acc;
    },
    { total: 0, active: 0, completed: 0 }
  );
}
```

Wait — we just said don't mutate. Why is `acc.total++` OK?

It's a fair question. The accumulator inside `reduce` is *private* — nothing outside the reduce can see it until reduce returns. The "no mutation" rule is really "don't change values other code is holding." A local accumulator nobody else sees is fine to mutate as you build it. We just have to return one final, complete object at the end.

If reduce feels weird at first, three filter calls also work:

```javascript
function stats(todos) {
  return {
    total: todos.length,
    active: todos.filter(t => !t.done).length,
    completed: todos.filter(t => t.done).length,
  };
}
```

Both are correct. The reduce version walks the list once; the filter version walks it three times. For tiny lists it doesn't matter. For huge lists, reduce wins.

## Hints

1. For `addTodo`, the next id is one more than the largest id you've seen so far. The cleanest approach: walk the list with `reduce` to find the max id, then add 1. Special-case empty: return id 1.
2. For `toggleTodo`, you've seen this shape before: `todos.map(t => t.id === id ? { ...t, done: !t.done } : t)`.
3. For `stats`, either `reduce` or three `filter`s — pick whichever reads cleaner to you.

> One small note for the tests: a few of them set up scenarios using a pattern like `(() => { ... })()` — that's an arrow function created and called immediately, so the test can declare local variables. You don't need to write any of those — they're test-only.
