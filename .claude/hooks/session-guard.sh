#!/usr/bin/env bash
# Claude Code SessionStart / SessionEnd hook — writes/prunes this session's
# lock so the pre-commit gate and other sessions can detect parallel use of
# the shared main working tree.
#
# stdin (from Claude Code): JSON containing session_id, hook_event_name, ...
# Usage (via .claude/settings.json):
#   SessionStart -> session-guard.sh start
#   SessionEnd   -> session-guard.sh end

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=session-lib.sh
source "$SCRIPT_DIR/session-lib.sh"

REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOCKDIR="$REPO_ROOT/.claude/active-sessions"
mkdir -p "$LOCKDIR" 2>/dev/null

mode="${1:-}"
input="$(cat)"

session_id=$(printf '%s' "$input" \
  | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
[ -n "$session_id" ] || session_id="unknown-$$"

lockfile="$LOCKDIR/$session_id.json"

if [ "$mode" = "end" ]; then
  rm -f "$lockfile"
  exit 0
fi

# --- SessionStart ---
prune_stale_locks "$LOCKDIR"

pids="$(ancestor_pids)"
ts="$(date +%s)"

if [ -n "$pids" ]; then
  printf '{"session_id":"%s","pids":[%s],"ts":%s}\n' \
    "$session_id" "$pids" "$ts" > "$lockfile.tmp" \
    && mv -f "$lockfile.tmp" "$lockfile"
else
  printf '{"session_id":"%s","ts":%s}\n' "$session_id" "$ts" \
    > "$lockfile.tmp" && mv -f "$lockfile.tmp" "$lockfile"
fi

if [ -f "$REPO_ROOT/.git" ]; then
  exit 0
fi
others=0
for f in "$LOCKDIR"/*.json; do
  [ -f "$f" ] || continue
  [ "$f" = "$lockfile" ] && continue
  if lock_is_alive "$f"; then others=$((others + 1)); fi
done
if [ "$others" -ge 1 ]; then
  echo "PARALLEL-SESSION WARNING: $others other live session(s) are using this main working tree."
  echo "Before committing anything here, either coordinate or run:"
  echo "  bash scripts/parallel-session.sh <your-task-name>"
  echo "and work inside .claude/worktrees/<your-task-name> (own git index, own branch)."
fi
exit 0
