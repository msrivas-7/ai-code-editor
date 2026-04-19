def class_average(book):
    total = 0
    count = 0
    for grades in book.values():
        total += sum(grades)
        count += len(grades)
    return round(total / count, 1)
