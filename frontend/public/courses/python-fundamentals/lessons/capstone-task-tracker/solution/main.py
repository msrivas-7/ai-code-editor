import sys


def add_task(tasks, text):
    next_id = (tasks[-1]["id"] + 1) if tasks else 1
    tasks.append({"id": next_id, "text": text, "done": False})


def done_task(tasks, task_id):
    for t in tasks:
        if t["id"] == task_id:
            t["done"] = True
            return


def list_tasks(tasks):
    for t in tasks:
        mark = "x" if t["done"] else " "
        print(f'{t["id"]}. [{mark}] {t["text"]}')
    done = sum(1 for t in tasks if t["done"])
    print(f"Done: {done}/{len(tasks)}")


if __name__ == "__main__":
    tasks = []
    for line in sys.stdin.read().strip().splitlines():
        parts = line.split(maxsplit=1)
        if not parts:
            continue
        cmd = parts[0]
        arg = parts[1] if len(parts) > 1 else ""
        if cmd == "add":
            add_task(tasks, arg)
        elif cmd == "done":
            done_task(tasks, int(arg))
        elif cmd == "list":
            list_tasks(tasks)
