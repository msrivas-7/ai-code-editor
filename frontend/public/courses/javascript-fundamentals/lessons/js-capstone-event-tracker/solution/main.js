const events = [
  { title: "Standup", date: "2025-01-15", attendees: ["Ada", "Babbage"] },
  { title: "Demo",    date: "2025-01-15", attendees: ["Ada", "Curie"] },
  { title: "1-on-1",  date: "2025-01-16", attendees: ["Babbage"] },
];

function eventsOn(events, date) {
  return events.filter((e) => e.date === date);
}

function attendeesOn(events, date) {
  const matching = eventsOn(events, date);
  const all = matching.flatMap((e) => e.attendees);
  return [...new Set(all)].sort();
}

function summarize(events, date) {
  const e = eventsOn(events, date);
  const p = attendeesOn(events, date);
  const eventWord = e.length === 1 ? "event" : "events";
  const peopleWord = p.length === 1 ? "person" : "people";
  return `${date}: ${e.length} ${eventWord}, ${p.length} ${peopleWord}`;
}

console.log(summarize(events, "2025-01-15"));
