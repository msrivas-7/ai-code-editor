#!/usr/bin/env bash
# watch-sessions.sh — live feed of per-session runner container lifecycle.
#
# Note: stdout/stderr from user code runs does NOT appear here. It streams
# through `docker exec` back to the backend — look in the backend terminal.
# This window is for seeing WHEN containers are spawned/destroyed per session.

c_cyan="\033[36m"
c_dim="\033[2m"
c_green="\033[32m"
c_red="\033[31m"
c_yellow="\033[33m"
c_magenta="\033[35m"
c_reset="\033[0m"

PREFIX="ai-code-editor-session-"

color_event() {
  case "$1" in
    start)   printf "${c_green}%-8s${c_reset}" "$1" ;;
    create)  printf "${c_cyan}%-8s${c_reset}" "$1" ;;
    die)     printf "${c_yellow}%-8s${c_reset}" "$1" ;;
    destroy) printf "${c_red}%-8s${c_reset}" "$1" ;;
    kill)    printf "${c_magenta}%-8s${c_reset}" "$1" ;;
    *)       printf "%-8s" "$1" ;;
  esac
}

print_header() {
  printf "${c_cyan}═══ SESSION RUNNERS ═══${c_reset}\n"
  printf "${c_dim}Shows per-session container lifecycle (create/start/die/destroy/kill).${c_reset}\n"
  printf "${c_dim}User-code output from Run streams through the backend terminal, not here.${c_reset}\n"
  echo ""
}

print_current_snapshot() {
  printf "${c_cyan}current session containers:${c_reset}\n"
  local listing
  listing=$(docker ps --filter "name=^${PREFIX}" --format '  {{.Names}}  {{.Status}}' 2>/dev/null)
  if [[ -z "$listing" ]]; then
    printf "  ${c_dim}(none — start a session in the UI)${c_reset}\n"
  else
    echo "$listing"
  fi
  echo ""
}

# Graceful Ctrl-C: kill the event stream and exit cleanly.
child_pid=""
cleanup() {
  [[ -n "$child_pid" ]] && kill "$child_pid" 2>/dev/null
  printf "\n${c_dim}watcher stopped.${c_reset}\n"
  exit 0
}
trap cleanup INT TERM

print_header
print_current_snapshot
printf "${c_cyan}─── live events (Ctrl-C to exit) ───${c_reset}\n"

# Infinite retry — if `docker events` exits (daemon restart, pipe error,
# Docker Desktop pause), print a note and reconnect.
while true; do
  # Process substitution keeps the while-body in the current shell (not a
  # subshell), so `child_pid` is visible to the trap. `--format` fields:
  # Time (unix seconds), Status (event name), Actor.Attributes.name.
  exec 3< <(docker events \
              --filter 'type=container' \
              --filter 'event=create' \
              --filter 'event=start' \
              --filter 'event=die' \
              --filter 'event=destroy' \
              --filter 'event=kill' \
              --format '{{.Time}}|{{.Action}}|{{.Actor.Attributes.name}}' 2>/dev/null)
  child_pid=$!

  printf "${c_dim}[listening for events…]${c_reset}\n"

  while IFS='|' read -r ts status name <&3; do
    [[ "$name" != ${PREFIX}* ]] && continue
    human_ts=$(date -r "$ts" "+%H:%M:%S" 2>/dev/null || echo "$ts")
    short_name="${name#$PREFIX}"
    printf "[%s] " "$human_ts"
    color_event "$status"
    printf "  ${c_dim}%s${c_reset}%s\n" "$PREFIX" "$short_name"
  done

  exec 3<&-
  child_pid=""

  # `docker events` exited — daemon probably paused or restarted. Back off
  # briefly and reconnect so the window stays useful across stop/start cycles.
  printf "${c_yellow}[event stream dropped — reconnecting in 2s]${c_reset}\n"
  sleep 2
done
