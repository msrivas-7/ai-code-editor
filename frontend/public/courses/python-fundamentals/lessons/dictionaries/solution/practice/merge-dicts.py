def merge(a, b):
    merged = {}
    for k, v in a.items():
        merged[k] = v
    for k, v in b.items():
        merged[k] = v
    return merged
