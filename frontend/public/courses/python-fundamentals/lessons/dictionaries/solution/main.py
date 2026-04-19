def count_words(words):
    counts = {}
    for w in words:
        counts[w] = counts.get(w, 0) + 1
    return counts


def most_frequent(counts):
    best_word = None
    best_count = -1
    for word, count in counts.items():
        if count > best_count or (count == best_count and word < best_word):
            best_word = word
            best_count = count
    return best_word


if __name__ == "__main__":
    text = input("Enter words separated by spaces: ")
    words = text.split()
    counts = count_words(words)
    for word in sorted(counts):
        print(f"{word}: {counts[word]}")
    top = most_frequent(counts)
    print(f"Most frequent: {top} ({counts[top]} times)")
