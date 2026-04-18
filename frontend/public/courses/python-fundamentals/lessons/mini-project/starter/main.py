# Mini Project: Student Grade Book
# Combine everything you've learned into a complete program.

import sys

# TODO: Define letter_grade(score) function
# 90+ = A, 80-89 = B, 70-79 = C, 60-69 = D, below 60 = F

# TODO (optional): add helper functions like parse_grades(lines),
# class_average(book), etc. You don't have to — it's your project to design.

# The block below only runs when you click Run — the grader tests your
# letter_grade function directly, so it skips this part.
if __name__ == "__main__":
    # Read student data from stdin
    lines = sys.stdin.read().strip().splitlines()

    # TODO: Parse each line into a dictionary of {name: score}

    # TODO: Print the grade book header and each student's info
    # Format: "Name:    score (grade)"

    # TODO: Calculate and print class statistics
    # - Class average
    # - Highest scoring student
    # - Lowest scoring student
    # - Number passing (D or above) out of total
