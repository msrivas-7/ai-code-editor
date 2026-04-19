def pending(tasks):
    return sum(1 for t in tasks if not t["done"])
