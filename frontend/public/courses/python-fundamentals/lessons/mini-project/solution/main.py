import sys


def letter_grade(score):
    if score >= 90:
        return "A"
    elif score >= 80:
        return "B"
    elif score >= 70:
        return "C"
    elif score >= 60:
        return "D"
    else:
        return "F"


def parse_book(lines):
    book = {}
    for line in lines:
        if not line.strip():
            continue
        name, score = line.split(":", 1)
        book[name.strip()] = int(score.strip())
    return book


if __name__ == "__main__":
    lines = sys.stdin.read().strip().splitlines()
    book = parse_book(lines)

    print("Grade Book")
    print("-" * 20)
    for name, score in book.items():
        print(f"{name:<10} {score} ({letter_grade(score)})")

    if book:
        avg = sum(book.values()) / len(book)
        top = max(book, key=book.get)
        low = min(book, key=book.get)
        passing = sum(1 for s in book.values() if s >= 60)
        print("-" * 20)
        print(f"Class average: {avg:.1f}")
        print(f"Highest: {top} ({book[top]})")
        print(f"Lowest: {low} ({book[low]})")
        print(f"Passing: {passing}/{len(book)}")
