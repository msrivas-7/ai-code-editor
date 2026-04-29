// findMax(numbers) is supposed to return the largest number in an array.
// It passes most tests but fails when ALL the numbers are negative.
//
// Bug-finding move: add a console.log inside the loop and call findMax
// on [-5, -2, -10]. What does max show on each iteration? Why?

function findMax(numbers) {
  let max = 0;  // ← think about this for a second
  for (const n of numbers) {
    if (n > max) max = n;
  }
  return max;
}
