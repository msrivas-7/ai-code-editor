function greetEveryone(names) {
  let greeting = "";
  for (const name of names) {
    greeting += "Hello, " + name + "! ";
  }
  return greeting.trim();
}
