#!/usr/bin/env bash
# Create or remove a per-task git worktree so parallel Claude Code sessions
# never share one .git/index. Each worktree has its own index, branch, and
# working copy under .claude/worktrees/<name> (gitignored).
#
# Usage:
#   bash scripts/parallel-session.sh <task-name> [--fresh]
#   bash scripts/parallel-session.sh --remove <task-name>
#   bash scripts/parallel-session.sh --list

set -eu

REPO_ROOT="$(git rev-parse --show-toplevel)"
WT_ROOT="$REPO_ROOT/.claude/worktrees"
LOCKDIR="$REPO_ROOT/.claude/active-sessions"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/parallel-session.sh <task-name> [--fresh]
  bash scripts/parallel-session.sh --remove <task-name>
  bash scripts/parallel-session.sh --list

Notes:
  - <task-name> becomes the branch name: work/<task-name>
  - Working copy: .claude/worktrees/<task-name>
  - node_modules is junction-linked to the main tree (instant, zero install).
    Use --fresh to do a real install in the worktree instead.
EOF
}

list_worktrees() {
  git -C "$REPO_ROOT" worktree list
  echo "---"
  if [ -d "$WT_ROOT" ]; then
    for d in "$WT_ROOT"/*; do
      [ -d "$d" ] || continue
      name="$(basename "$d")"
      branch="$(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
      printf "  %s  branch=%s  path=%s\n" "$name" "$branch" "$d"
    done
  else
    echo "  (no worktrees)"
  fi
}

ensure_node_modules_link() {
  local wt_path="$1" main_nm="$REPO_ROOT/node_modules" wt_nm="$wt_path/node_modules"
  if [ ! -d "$main_nm" ]; then
    echo "  (no main node_modules yet — run 'npm install' in the worktree after this)"
    return 0
  fi
  if [ -e "$wt_nm" ]; then
    if [ -L "$wt_nm" ] || [ -d "$wt_nm" ]; then
      echo "  node_modules already present in worktree (skipping link)"
      return 0
    fi
  fi
  if cmd //c mklink //J "$(cygpath -w "$wt_nm")" "$(cygpath -w "$main_nm")" >/dev/null 2>&1; then
    echo "  node_modules junction created (fast — shares main tree's install)"
    return 0
  fi
  echo "  WARNING: junction failed. Run 'npm install' inside the worktree manually."
}

create_worktree() {
  local name="$1" fresh=0
  if [ "${2:-}" = "--fresh" ]; then fresh=1; fi

  if ! [[ "$name" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    echo "ERROR: task name must match [a-zA-Z0-9._-]+ (got: $name)" >&2
    exit 2
  fi
  local branch="work/$name"
  local wt_path="$WT_ROOT/$name"

  if [ -d "$wt_path" ]; then
    echo "ERROR: worktree path already exists: $wt_path" >&2
    exit 2
  fi
  if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
    echo "ERROR: branch already exists: $branch (pick a different name, or --remove first)" >&2
    exit 2
  fi

  mkdir -p "$WT_ROOT"
  echo "Creating worktree at $wt_path on branch $branch ..."
  git -C "$REPO_ROOT" worktree add "$wt_path" -b "$branch"

  echo "Linking node_modules ..."
  if [ "$fresh" = "1" ]; then
    echo "  (--fresh) running 'npm install' in the worktree ..."
    ( cd "$wt_path" && npm install )
  else
    ensure_node_modules_link "$wt_path"
  fi

  cat <<EOF

Worktree ready.

  path:    $wt_path
  branch:  $branch
  hooksPath: $(git -C "$REPO_ROOT" config --get core.hooksPath || echo '(inherited)')

Next steps (worktree side):
  cd "$wt_path"
  # ...edit, add, commit with explicit pathspecs...
  git push -u origin $branch
  gh pr create --base main --head $branch   # or merge by hand

Cleanup when the branch is merged:
  bash scripts/parallel-session.sh --remove $name
EOF
}

remove_worktree() {
  local name="$1"
  local wt_path="$WT_ROOT/$name"
  if [ ! -d "$wt_path" ]; then
    echo "No worktree at $wt_path" >&2
    exit 2
  fi
  echo "Removing worktree $wt_path ..."
  git -C "$REPO_ROOT" worktree remove --force "$wt_path" || {
    echo "  force-rm fallback (worktree may be dirty) ..."
    rm -rf "$wt_path"
    git -C "$REPO_ROOT" worktree prune
  }
  # Best-effort: if a node_modules junction lived inside, `git worktree remove`
  # does not always clear it. Detect a reparse point and unlink.
  local wt_nm="$wt_path/node_modules"
  if [ -L "$wt_nm" ] || ([ -d "$wt_nm" ] && [ -d "$wt_nm/_nmsl" ]); then
    rm -rf "$wt_nm" 2>/dev/null || cmd //c rmdir "$(cygpath -w "$wt_nm")" 2>/dev/null || true
  fi
  echo "Done."
}

case "${1:-}" in
  "")        usage; exit 0 ;;
  --help|-h) usage; exit 0 ;;
  --list)    list_worktrees; exit 0 ;;
  --remove)
    [ "${2:-}" ] || { echo "ERROR: --remove needs a name" >&2; exit 2; }
    remove_worktree "$2"; exit 0 ;;
  --*)
    echo "ERROR: unknown option: $1" >&2; usage; exit 2 ;;
  *)
    create_worktree "$1" "${2:-}"; exit 0 ;;
esac
