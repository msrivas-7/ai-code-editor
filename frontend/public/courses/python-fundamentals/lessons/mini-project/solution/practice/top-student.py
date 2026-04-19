def top_student(book):
    best_name = None
    best_avg = -1.0
    for name, grades in book.items():
        avg = sum(grades) / len(grades)
        if avg > best_avg:
            best_avg = avg
            best_name = name
    return best_name
