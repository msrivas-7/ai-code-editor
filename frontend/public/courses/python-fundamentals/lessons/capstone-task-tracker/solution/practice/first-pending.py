def first_pending(tasks):
    for t in tasks:
        if not t["done"]:
            return t["text"]
    return None
