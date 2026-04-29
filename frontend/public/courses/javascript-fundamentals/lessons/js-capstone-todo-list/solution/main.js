function addTodo(todos, text) {
  const maxId = todos.reduce((max, t) => (t.id > max ? t.id : max), 0);
  return [...todos, { id: maxId + 1, text, done: false }];
}

function toggleTodo(todos, id) {
  return todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

function activeTodos(todos) {
  return todos.filter((t) => !t.done);
}

function stats(todos) {
  return todos.reduce(
    (acc, t) => {
      acc.total++;
      if (t.done) acc.completed++;
      else acc.active++;
      return acc;
    },
    { total: 0, active: 0, completed: 0 },
  );
}

let todos = [];
todos = addTodo(todos, "Buy groceries");
todos = addTodo(todos, "Finish report");
todos = addTodo(todos, "Call dentist");
todos = toggleTodo(todos, 2);

const s = stats(todos);
console.log(`Total: ${s.total}, Active: ${s.active}, Completed: ${s.completed}`);
