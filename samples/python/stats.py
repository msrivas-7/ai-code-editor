def mean(values):
    return sum(values) / len(values)


def median(values):
    s = sorted(values)
    n = len(s)
    mid = n // 2
    if n % 2 == 0:
        return (s[mid - 1] + s[mid]) / 2
    return s[mid]


def variance(values):
    mu = mean(values)
    return sum((x - mu) ** 2 for x in values) / len(values)
