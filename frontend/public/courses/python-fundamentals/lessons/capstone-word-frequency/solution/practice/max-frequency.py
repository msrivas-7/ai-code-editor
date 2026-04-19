def most_frequent(words):
    counts = {}
    for w in words:
        counts[w] = counts.get(w, 0) + 1
    best_word = None
    best_count = -1
    for word, count in counts.items():
        if count > best_count or (count == best_count and word < best_word):
            best_word = word
            best_count = count
    return (best_word, best_count)
