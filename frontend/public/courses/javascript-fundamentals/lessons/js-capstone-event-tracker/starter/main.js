// Capstone: Event Tracker
//
// You'll write three functions and a one-line driver below.
//
// The data shape — an array of event objects:
const events = [
  { title: "Standup", date: "2025-01-15", attendees: ["Ada", "Babbage"] },
  { title: "Demo",    date: "2025-01-15", attendees: ["Ada", "Curie"] },
  { title: "1-on-1",  date: "2025-01-16", attendees: ["Babbage"] },
];

// 1) eventsOn — return the events on the given date.
function eventsOn(events, date) {
  // TODO
}

// 2) attendeesOn — return a SORTED, DEDUPED array of attendee names
//    across all events on that date.
function attendeesOn(events, date) {
  // TODO
}

// 3) summarize — return a one-line string:
//    "<date>: <N> event[s], <M> person/people"
//    Singular/plural matters. 0 → "0 events, 0 people".
function summarize(events, date) {
  // TODO
}

// Driver — after your functions are correct, this prints to the output:
//   2025-01-15: 2 events, 3 people
console.log(summarize(events, "2025-01-15"));
