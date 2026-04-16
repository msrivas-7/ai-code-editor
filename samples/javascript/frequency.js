function wordFrequency(text) {
  const counts = new Map();
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  for (const w of words) {
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return counts;
}

function topN(freq, n) {
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);
}

module.exports = { wordFrequency, topN };
