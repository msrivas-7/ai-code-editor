def clean(numbers):
    result = [n for n in numbers if n >= 0]
    result.append(0)
    return result


def average(numbers):
    return sum(numbers) / len(numbers)


if __name__ == "__main__":
    raw = input("Enter comma-separated numbers: ")
    parts = raw.split(",")
    numbers = [int(x.strip()) for x in parts]

    print(f"Original: {numbers}")
    cleaned = clean(numbers)
    print(f"Cleaned: {cleaned}")
    print(f"Sum: {sum(cleaned)}")
    print(f"Average: {average(cleaned)}")
