const { wordFrequency, topN } = require("./frequency.js");

const text = `
  the quick brown fox jumps over the lazy dog
  the dog barks and the fox runs away
  the quick fox is quick and the dog is lazy
`;

const freq = wordFrequency(text);
const top = topN(freq, 5);

console.log("top 5 words:");
for (const [word, count] of top) {
  console.log(`  ${word.padEnd(10)} ${count}`);
}
