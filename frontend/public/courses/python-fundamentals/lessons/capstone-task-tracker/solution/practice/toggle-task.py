def toggle(tasks, task_id):
    for t in tasks:
        if t["id"] == task_id:
            t["done"] = not t["done"]
            return
