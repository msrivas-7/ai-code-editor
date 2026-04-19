import sys


def tokenize(text):
    cleaned = text.lower()
    for ch in ".,!?;:":
        cleaned = cleaned.replace(ch, " ")
    return cleaned.split()


def count_words(words):
    counts = {}
    for w in words:
        counts[w] = counts.get(w, 0) + 1
    return counts


def top_n(counts, n):
    items = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return items[:n]


if __name__ == "__main__":
    text = sys.stdin.read()
    words = tokenize(text)
    counts = count_words(words)

    print(f"Total words: {len(words)}")
    print(f"Unique words: {len(counts)}")
    print("Top 3:")
    for word, count in top_n(counts, 3):
        print(f"{word}: {count}")
