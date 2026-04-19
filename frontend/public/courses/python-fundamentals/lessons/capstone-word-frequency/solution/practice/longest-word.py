def longest(words):
    best = words[0]
    for w in words[1:]:
        if len(w) > len(best):
            best = w
    return best
