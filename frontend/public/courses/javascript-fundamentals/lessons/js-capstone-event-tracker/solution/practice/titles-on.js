function titlesOn(events, date) {
  return events.filter((e) => e.date === date).map((e) => e.title).sort();
}
