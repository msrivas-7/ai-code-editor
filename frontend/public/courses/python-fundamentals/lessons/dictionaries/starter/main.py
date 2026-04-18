# Dictionaries — Word Frequency Counter

# TODO: Write count_words(words) that returns a dict mapping each
# word to the number of times it appears in the list.
# Hint: use counts.get(word, 0) + 1
def count_words(words):
    pass


# TODO: Write most_frequent(counts) that returns the word with the
# highest count. If two words tie, return the one that comes first
# alphabetically. Assume the dict has at least one entry.
def most_frequent(counts):
    pass


# The block below only runs when you click Run — the grader tests your
# functions directly, so it skips this part.
if __name__ == "__main__":
    text = input("Enter words separated by spaces: ")
    words = text.split()

    counts = count_words(words)
    for word in sorted(counts):
        print(f"{word}: {counts[word]}")

    top = most_frequent(counts)
    print(f"Most frequent: {top} ({counts[top]} times)")
