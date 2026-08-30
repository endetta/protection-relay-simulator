#!/usr/bin/env bash
# Shared helpers for the parallel-session guard.
# Sourced by .claude/hooks/session-guard.sh and .githooks/pre-commit.
# Pure bash + tools bundled with Git for Windows (tasklist, sed, awk).

# A lock with no usable pid info (ancestor walk failed) is trusted only for
# this window, then treated as stale.
LOCK_MAX_AGE_SEC=$((24 * 60 * 60))

# win_pid_alive <pid> -> 0 if a Windows process with this pid is running.
win_pid_alive() {
  local pid="$1"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  tasklist //FI "PID eq $pid" 2>/dev/null \
    | awk -v p="$pid" '$2==p {found=1} END{exit !found}'
}

# Extract the "pids":[...] array contents from a lock file (comma-joined).
_lock_pids() {
  sed -n 's/.*"pids"[[:space:]]*:[[:space:]]*\[\([^]]*\)\].*/\1/p' "$1" | tr -d ' "'
}

# Extract the "ts":<epoch> value from a lock file.
_lock_ts() {
  sed -n 's/.*"ts"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$1"
}

# lock_is_alive <file> -> 0 if the lock belongs to a live session.
lock_is_alive() {
  local f="$1" pids pid ts now alive=0
  [ -f "$f" ] || return 1
  now=$(date +%s)
  ts=$(_lock_ts "$f")
  # Hard cap: any lock older than LOCK_MAX_AGE_SEC is dead, pid or not.
  if [ -n "$ts" ] && [ $((now - ts)) -ge "$LOCK_MAX_AGE_SEC" ]; then
    return 1
  fi
  pids=$(_lock_pids "$f")
  if [ -n "$pids" ]; then
    local IFS=','
    for pid in $pids; do
      if win_pid_alive "$pid"; then alive=1; break; fi
    done
  else
    # No pid info: fall back to the timestamp window.
    if [ -n "$ts" ] && [ $((now - ts)) -lt "$LOCK_MAX_AGE_SEC" ]; then
      alive=1
    fi
  fi
  [ "$alive" = 1 ]
}

# live_lock_count [lockdir] -> prints the number of live session locks.
live_lock_count() {
  local lockdir="${1:-.claude/active-sessions}" f count=0
  [ -d "$lockdir" ] || { echo 0; return 0; }
  for f in "$lockdir"/*.json; do
    [ -f "$f" ] || continue
    if lock_is_alive "$f"; then count=$((count + 1)); fi
  done
  echo "$count"
}

# prune_stale_locks [lockdir] -> remove locks that are no longer alive.
prune_stale_locks() {
  local lockdir="${1:-.claude/active-sessions}" f
  [ -d "$lockdir" ] || return 0
  for f in "$lockdir"/*.json; do
    [ -f "$f" ] || continue
    if ! lock_is_alive "$f"; then rm -f "$f"; fi
  done
}

# ancestor_pids -> comma-joined Windows pids of this process and up to 3
# ancestors (bash -> [cmd wrapper] -> node CLI). The walk stops right after
# the first node.exe ancestor: the Claude CLI dies with the session, while
# longer-lived shells above it must NOT keep the lock alive.
ancestor_pids() {
  local self chain="" p par isnode i
  self=$(ps -W 2>/dev/null | awk -v m="$$" '$1==m {print $4; exit}')
  [ -n "$self" ] || { echo ""; return 0; }
  chain="$self"
  p="$self"
  for i in 1 2 3; do
    par=$(powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter ('ProcessId=' + $p)).ParentProcessId" 2>/dev/null | tr -d '\r\n \t')
    [ -n "$par" ] && [[ "$par" =~ ^[0-9]+$ ]] || break
    chain="$chain,$par"
    isnode=$(tasklist //FI "PID eq $par" 2>/dev/null \
      | awk -v q="$par" 'tolower($1) ~ /^node(\.exe)?$/ && $2==q {found=1} END{exit !found}')
    [ "$isnode" = 1 ] && break
    p="$par"
  done
  echo "$chain"
}
