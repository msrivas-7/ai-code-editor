function eventsBetween(events, startDate, endDate) {
  return events.filter((e) => e.date >= startDate && e.date <= endDate);
}
