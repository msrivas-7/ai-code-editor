def max_of_three(a, b, c):
    if a >= b and a >= c:
        return a
    if b >= c:
        return b
    return c
