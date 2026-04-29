# Capstone: Event Tracker

Real programs don't just compute — they organize *data* and answer *questions* about it. In this capstone you'll model a tiny calendar and write functions that answer questions like "what's on this day?" and "who's attending?". The concepts here aren't all new — but the *pattern* is: arrays of objects, queried with array methods. Once you see it, you'll see it everywhere.

## What you'll learn

- Model real data as an **array of objects** (each object is one event)
- Use array methods (`filter`, `map`, `sort`, etc.) for the questions you ask of it
- Compose smaller functions into a bigger one — the way real code grows

## Instructions

You'll write three functions, then a one-line driver that prints a summary:

```javascript
const events = [
  { title: "Standup", date: "2025-01-15", attendees: ["Ada", "Babbage"] },
  { title: "Demo",    date: "2025-01-15", attendees: ["Ada", "Curie"] },
  { title: "1-on-1",  date: "2025-01-16", attendees: ["Babbage"] },
];
```

### 1. `eventsOn(events, date)`

Return an array of events whose `date` matches the given date. Same shape as `events` — just filtered.

```javascript
eventsOn(events, "2025-01-15");
// → [{title:"Standup", date:"2025-01-15", attendees:["Ada","Babbage"]},
//    {title:"Demo",    date:"2025-01-15", attendees:["Ada","Curie"]}]
```

### 2. `attendeesOn(events, date)`

Return a **sorted, deduplicated** array of attendee names on that date. (Same person at two events should appear once.)

```javascript
attendeesOn(events, "2025-01-15");
// → ["Ada", "Babbage", "Curie"]
```

### 3. `summarize(events, date)`

Return a one-line string like:

```
"2025-01-15: 2 events, 3 people"
```

Pluralization matters: `1 event` and `1 person`, but `2 events` and `2 people`. The empty case reads `"2099-01-01: 0 events, 0 people"` — note the plural defaults.

### Driver

At the bottom of `main.js`, after your function definitions, add:

```javascript
console.log(summarize(events, "2025-01-15"));
```

That should print `2025-01-15: 2 events, 3 people` to the output.

## Key concepts

### Array of objects = the everyday data shape

Every real-world dataset you'll work with — users, orders, lessons, posts — is some version of "list of records." The pattern is:

```javascript
const items = [
  { /* record 1 */ },
  { /* record 2 */ },
  ...
];
```

Each record (object) groups related fields. The array gives you all the methods (`filter`, `map`, etc.) for asking questions about the collection.

### Filter, map, then format

Most queries split cleanly into three moves:

1. **Filter** — narrow to the records you care about (`events.filter(e => e.date === date)`).
2. **Map** — pull out just the field(s) you want (`.map(e => e.attendees)`).
3. **Format** — join, sort, count, etc. (`.flat()`, `.sort()`, `.length`).

`attendeesOn` will use all three in a single chain.

### `flatMap` — map then flatten

`map` over an array of events gives you an array of arrays (each event has a list of attendees). To get a single flat list of names, you'd `.map(...).flat()`. There's a shortcut for the combo: `flatMap`.

```javascript
const events = [
  { attendees: ["Ada", "Babbage"] },
  { attendees: ["Ada", "Curie"] },
];

events.map((e) => e.attendees);
// → [["Ada", "Babbage"], ["Ada", "Curie"]]    (array of arrays)

events.flatMap((e) => e.attendees);
// → ["Ada", "Babbage", "Ada", "Curie"]        (one flat array)
```

You'll want `flatMap` for `attendeesOn` — the natural shape is "for each event give me its attendees, all in one list."

### Dedup with Set

To get unique values from an array:

```javascript
const everyone = ["Ada", "Babbage", "Ada"];
const unique = [...new Set(everyone)];
// ["Ada", "Babbage"]
```

`new Set(arr)` builds a Set (no duplicates). Spreading it back with `[...set]` turns it back into an array. You'll want this for `attendeesOn`.

### Composing functions

`summarize` doesn't need to compute counts from scratch — it can call the two functions you already wrote:

```javascript
function summarize(events, date) {
  const matching = eventsOn(events, date);
  const people = attendeesOn(events, date);
  // ...format the string using matching.length and people.length
}
```

This is the heart of programming: build small, single-purpose functions, then call them from each other.

## Hints

1. `eventsOn` is one line: `events.filter(e => e.date === date)`.
2. For `attendeesOn`, the chain is: `eventsOn` → `flatMap(e => e.attendees)` → `[...new Set(...)]` → `sort()`.
3. For pluralization, a one-liner: `n === 1 ? "person" : "people"`. Same for "event" / "events".
