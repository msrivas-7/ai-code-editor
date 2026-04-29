function completedFraction(todos) {
  if (todos.length === 0) return 0;
  return todos.filter((t) => t.done).length / todos.length;
}
