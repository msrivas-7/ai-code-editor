function countEvens(numbers) {
  let count = 0;
  for (const n of numbers) {
    if (n % 2 === 0) count++;
  }
  return count;
}
