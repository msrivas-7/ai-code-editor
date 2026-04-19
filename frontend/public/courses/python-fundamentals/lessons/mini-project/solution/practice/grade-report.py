book = {
    "Alice": [80, 85, 90],
    "Bob": [95, 92, 98],
    "Cara": [70, 75, 80],
}

grades = book["Alice"]
avg = sum(grades) / len(grades)
print(f"Alice: avg={avg}, min={min(grades)}, max={max(grades)}")
