#!/usr/bin/env bash
# stop.sh — tear down the AI Code Editor stack and close the log terminals
# that start.sh opened.

set -euo pipefail

cd "$(dirname "$0")"

c_cyan="\033[36m"
c_green="\033[32m"
c_dim="\033[2m"
c_reset="\033[0m"

close_log_terminals_macos() {
  local file=".ai-code-editor-terminals"
  [[ ! -f "$file" ]] && return 0
  local ids
  ids=$(cat "$file")
  rm -f "$file"
  [[ -z "$ids" ]] && return 0

  local script='tell application "Terminal"'
  local IFS=','
  for id in $ids; do
    # Trim whitespace from osascript's comma-separated output.
    id="${id// /}"
    [[ -z "$id" ]] && continue
    script+=$'\n'"  try"
    script+=$'\n'"    close (every window whose id is $id) saving no"
    script+=$'\n'"  end try"
  done
  script+=$'\nend tell'
  /usr/bin/osascript -e "$script" >/dev/null 2>&1 || true
}

printf "${c_cyan}▸${c_reset} Stopping AI Code Editor…\n"
docker compose down --remove-orphans

if [[ "$(uname)" == "Darwin" ]]; then
  printf "${c_cyan}▸${c_reset} Closing log terminals…\n"
  close_log_terminals_macos
fi

printf "${c_green}✔${c_reset} Stopped.\n"
