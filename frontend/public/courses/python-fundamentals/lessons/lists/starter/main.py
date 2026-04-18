# Lists — Clean and Summarize

# TODO: Write clean(numbers) that returns a NEW list:
#   - with 0 appended to the end
#   - with any negative numbers removed
# Don't modify the input list.
def clean(numbers):
    pass


# TODO: Write average(numbers) that returns the mean (sum divided by length).
# Assume the list has at least one number.
def average(numbers):
    pass


# The block below only runs when you click Run — the grader tests your
# functions directly, so it skips this part.
if __name__ == "__main__":
    raw = input("Enter comma-separated numbers: ")
    parts = raw.split(",")
    numbers = [int(x.strip()) for x in parts]

    print(f"Original: {numbers}")
    cleaned = clean(numbers)
    print(f"Cleaned: {cleaned}")
    print(f"Sum: {sum(cleaned)}")
    print(f"Average: {average(cleaned)}")
