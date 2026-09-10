#!/usr/bin/env bash
# Snapshot the working tree as an immutable git ref, without touching the index or `git status`.
#
#   snap.sh baseline <task>      -> creates refs/pair/<run>/baseline, prints "<run> <ref> <sha>"
#   snap.sh baseline <task> --run <id>  -> same, with <id> as the run instead of a fresh stamp: a task spanning
#                                  several repositories takes its baseline in each of them under one run id
#   snap.sh <run> <item>-r<N>    -> creates refs/pair/<run>/<item>-r<N>, prints "<ref> <sha>"; refuses if it exists
#   snap.sh list <run>           -> every ref of the run with its sha
#   snap.sh clean <run>          -> deletes the run's refs
#   snap.sh runs                 -> every run that has a baseline in this repository
#   snap.sh state <run>          -> the path of the run's state file (does not create it)
#
# <run> is <task>-<YYYYMMDD-HHMMSS>[-n], chosen at baseline so a second run of the same task cannot overwrite the first.
# The snapshot is a commit whose tree is the whole working tree: tracked files (including tracked files that match
# .gitignore), untracked files that are not ignored, deletions. It has HEAD as parent when HEAD exists.
# The state file lives under ~/.cache/claude-pair/<repo basename>-<12 hex of the repository path>/<run>.md.
# `clean` is not part of finishing a task: the closing report cites the refs by name and the baseline is
# sometimes the only copy of a file that has since gone, so it runs when the user asks for it.
set -euo pipefail

die() { echo "snap: $*" >&2; exit "${2:-1}"; }
valid_name() { [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; }   # no globs, no slashes, no spaces
need_run() { valid_name "$1" || die "'$1' is not a run id (letters, digits, . _ - only)" 2
             git show-ref --verify --quiet "refs/pair/$1/baseline" || die "run '$1' has no baseline; start with: snap.sh baseline <task>" 2; }

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not inside a git work tree" 2
top=$(git rev-parse --show-toplevel); cd "$top"

cmd=${1:-}; arg=${2:-}
usage="usage: snap.sh baseline <task> [--run <id>] | <run> <item>-r<N> | list <run> | clean <run> | runs | state <run>"
[ -n "$cmd" ] || die "$usage" 2

case "$cmd" in
  runs)  git for-each-ref 'refs/pair/*/baseline' --format='%(refname)' | awk -F/ '{print $3}'; exit 0 ;;
  list)  need_run "$arg"; git for-each-ref "refs/pair/$arg/" --format='%(refname) %(objectname:short)'; exit 0 ;;
  clean) need_run "$arg"; git for-each-ref "refs/pair/$arg/" --format='%(refname)' | while read -r r; do git update-ref -d "$r"; done; exit 0 ;;
  state) need_run "$arg"
         hash=$(printf '%s' "$top" | sha1sum | cut -c1-12)
         echo "${XDG_CACHE_HOME:-$HOME/.cache}/claude-pair/$(basename "$top")-$hash/$arg.md"; exit 0 ;;
  baseline)
     [ -n "$arg" ] || die "$usage" 2
     valid_name "$arg" || die "'$arg' is not a task id (letters, digits, . _ - only)" 2
     name=baseline
     if [ "${3:-}" = --run ]; then
       run=${4:-}; [ -n "$run" ] || die "--run needs a run id" 2
       valid_name "$run" || die "'$run' is not a run id (letters, digits, . _ - only)" 2
     else
       [ -z "${3:-}" ] || die "$usage" 2
       stamp="$arg-$(date +%Y%m%d-%H%M%S)"; run=$stamp; n=1
       while git show-ref --verify --quiet "refs/pair/$run/baseline"; do n=$((n+1)); run="$stamp-$n"; done
     fi ;;
  *) [ -n "$arg" ] || die "$usage" 2
     run=$cmd; name=$arg; need_run "$run"
     valid_name "$name" || die "bad snapshot name '$name' (letters, digits, . _ - only)" 2 ;;
esac

ref="refs/pair/$run/$name"
git show-ref --verify --quiet "$ref" && die "$ref already exists; a revision is never overwritten, bump the number" 3

idx=$(mktemp "${TMPDIR:-/tmp}/pair-snap.XXXXXX")
trap 'rm -f "$idx"' EXIT
rm -f "$idx"   # git wants to create the index file itself

parent=()
if head=$(git rev-parse --verify --quiet HEAD); then
  GIT_INDEX_FILE=$idx git read-tree "$head"        # keeps tracked files, even those matching .gitignore
  parent=(-p "$head")
fi
GIT_INDEX_FILE=$idx git add -A >/dev/null           # adds new files, updates tracked ones, drops deleted ones
tree=$(GIT_INDEX_FILE=$idx git write-tree)
sha=$(git commit-tree "$tree" "${parent[@]}" -m "pair snapshot $run/$name")
zero=0000000000000000000000000000000000000000
git update-ref "$ref" "$sha" "$zero" || die "$ref appeared meanwhile; not overwritten" 3

if [ "$name" = baseline ]; then echo "$run $ref $(git rev-parse --short "$sha")"; else echo "$ref $(git rev-parse --short "$sha")"; fi
