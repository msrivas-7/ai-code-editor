#!/usr/bin/env bash
#
# start.sh — one-command launcher for AI Code Editor.
# Ensures Docker is reachable, brings up the stack, waits for it to be ready,
# and opens the UI in your browser.

set -euo pipefail

cd "$(dirname "$0")"

c_green="\033[32m"
c_cyan="\033[36m"
c_dim="\033[2m"
c_red="\033[31m"
c_reset="\033[0m"

log()   { printf "${c_cyan}▸${c_reset} %s\n" "$*"; }
ok()    { printf "  ${c_green}✔${c_reset} %s\n" "$*"; }
warn()  { printf "  ${c_red}✖${c_reset} %s\n" "$*"; }

log "Checking Docker daemon…"
if ! docker info >/dev/null 2>&1; then
  if command -v colima >/dev/null 2>&1; then
    log "Docker daemon not reachable — starting Colima…"
    colima start
    ok "Colima started"
  else
    warn "No Docker daemon and Colima not installed."
    warn "Install one of: Docker Desktop, Colima (brew install colima), or OrbStack."
    exit 1
  fi
else
  ok "Docker daemon reachable"
fi

log "Building + starting AI Code Editor (this is fast after the first run)…"
docker compose up --build -d

log "Waiting for backend on :4000…"
for i in {1..45}; do
  if curl -sf http://localhost:4000/api/health >/dev/null 2>&1; then
    ok "backend ready"
    break
  fi
  sleep 1
  [[ $i -eq 45 ]] && warn "backend didn't respond in 45s — check: docker compose logs backend"
done

log "Waiting for frontend on :5173…"
for i in {1..30}; do
  if curl -sf http://localhost:5173 >/dev/null 2>&1; then
    ok "frontend ready"
    break
  fi
  sleep 1
  [[ $i -eq 30 ]] && warn "frontend didn't respond in 30s — check: docker compose logs frontend"
done

open_log_terminals_macos() {
  local root="$PWD"
  # AppleScript: spawn three Terminal.app windows, each tailing one stream.
  # Capture each window's id so stop.sh can close exactly the windows we opened.
  local ids
  ids=$(/usr/bin/osascript <<APPLESCRIPT 2>/dev/null
tell application "Terminal"
  do script "cd " & quoted form of "$root" & " && echo '═══ BACKEND LOGS ═══' && docker compose logs -f backend"
  set w1 to id of front window
  do script "cd " & quoted form of "$root" & " && echo '═══ FRONTEND LOGS ═══' && docker compose logs -f frontend"
  set w2 to id of front window
  do script "cd " & quoted form of "$root" & " && ./scripts/watch-sessions.sh"
  set w3 to id of front window
  activate
  return (w1 as string) & "," & (w2 as string) & "," & (w3 as string)
end tell
APPLESCRIPT
) || return 1
  [[ -z "$ids" ]] && return 1
  printf "%s\n" "$ids" > "$root/.ai-code-editor-terminals"
}

if [[ "$(uname)" == "Darwin" ]]; then
  log "Opening log terminals…"
  if open_log_terminals_macos; then
    ok "3 Terminal windows opened: backend / frontend / session runners"
  else
    warn "Couldn't open Terminal windows automatically. Tail manually:"
    printf "${c_dim}    docker compose logs -f backend${c_reset}\n"
    printf "${c_dim}    docker compose logs -f frontend${c_reset}\n"
    printf "${c_dim}    ./scripts/watch-sessions.sh${c_reset}\n"
  fi
fi

echo ""
printf "${c_green}──────────────────────────────────────────────${c_reset}\n"
printf "  AI Code Editor is running\n"
printf "  ${c_cyan}UI      ${c_reset}  http://localhost:5173\n"
printf "  ${c_cyan}Backend ${c_reset}  http://localhost:4000\n"
printf "${c_green}──────────────────────────────────────────────${c_reset}\n"
echo ""
printf "${c_dim}  Logs stream in the 3 Terminal windows that just opened.${c_reset}\n"
printf "${c_dim}  Stop the stack:   ./stop.sh${c_reset}\n"
printf "${c_dim}  Closing log windows does NOT stop the stack — use ./stop.sh${c_reset}\n"
echo ""

# Open the UI. macOS uses `open`; Linux/WSL uses xdg-open if present.
if command -v open >/dev/null 2>&1; then
  open http://localhost:5173 >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:5173 >/dev/null 2>&1 || true
fi
