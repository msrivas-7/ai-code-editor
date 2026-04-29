function renameTodo(todos, id, newText) {
  return todos.map((t) => (t.id === id ? { ...t, text: newText } : t));
}
