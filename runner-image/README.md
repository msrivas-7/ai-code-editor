# Runner Image

Polyglot execution container used by the backend, one per active editor session.

Included toolchains:
- Python 3 (`python3`)
- Node.js (`node`)
- GCC (`gcc`)
- G++ (`g++`, C++17)
- JDK (`javac`, `java`)

The container is intentionally dumb: it starts with `sleep infinity` and waits for the
backend to drive it via `docker exec`. The backend is responsible for:

- starting / stopping the container
- syncing the project snapshot into `/workspace` (bind mount)
- running compile/run commands
- enforcing resource & network limits

Build locally:

```bash
docker build -t codetutor-ai-runner ./runner-image
```
