function findMax(numbers) {
  let max = numbers[0];
  for (const n of numbers) {
    if (n > max) max = n;
  }
  return max;
}
