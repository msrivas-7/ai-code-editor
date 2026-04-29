function longestText(todos) {
  return todos.reduce(
    (longest, t) => (t.text.length > longest.length ? t.text : longest),
    "",
  );
}
