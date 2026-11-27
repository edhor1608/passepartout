#!/usr/bin/env bash
# Model-checks BatchQueue.tla with TLC. The current code must keep every property except the
# known findings, each known finding must still break, and each fixed bug must break the property
# that guards it. `check.sh <run>` checks one run and prints its counterexample.
set -euo pipefail

readonly TLA_VERSION=1.7.4
readonly TLA_SHA256=936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88
readonly BOUNDS='MaxAdds = 2 MaxRequests = 3'
readonly INVARIANTS='TypeOK ReleasedWhenIdle BackgroundTimeWhileAwaiting LastReportComplete ForegroundLoadsInForeground'
readonly ACTION_PROPERTIES='PauseHolds StopHolds RetryableKept'
readonly KNOWN_FINDINGS=''

# run|Bug constant|property the run must break, empty when it must pass|commit that fixed it
readonly RUNS=(
  "current|none||"
  "ExpiryKeepsRunning|ExpiryKeepsRunning|PauseHolds|b7392d6"
  "ActivationLiftsPause|ActivationLiftsPause|PauseHolds|61c4a18"
  "AwaitingUnheld|AwaitingUnheld|BackgroundTimeWhileAwaiting|e660a2a"
  "AwaitingNeverCleared|AwaitingNeverCleared|ReleasedWhenIdle|e660a2a"
  "ReportAfterRelease|ReportAfterRelease|LastReportComplete|8cb42e4"
  "ForegroundLoadInBackground|ForegroundLoadInBackground|ForegroundLoadsInForeground|70e6b9a"
  "AddDropsRetryable|AddDropsRetryable|RetryableKept|b4d191a"
  "PauseNeedsRunner|PauseNeedsRunner|StopHolds|d7f437d"
  "ReleasedStopDropped|ReleasedStopDropped|StopHolds|78f8f6f"
  "LastReleasedOnly|LastReleasedOnly|StopHolds|ae17711"
)

here=$(cd "$(dirname "$0")" && pwd)
jar=${XDG_CACHE_HOME:-$HOME/.cache}/tla2tools/$TLA_VERSION/tla2tools.jar
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }

if [[ ! -f $jar || $(sha256 "$jar") != "$TLA_SHA256" ]]; then
  mkdir -p "$(dirname "$jar")"
  curl -fsSL --retry 5 -C - -o "$work/tla2tools.jar" \
    "https://github.com/tlaplus/tlaplus/releases/download/v$TLA_VERSION/tla2tools.jar"
  if [[ $(sha256 "$work/tla2tools.jar") != "$TLA_SHA256" ]]; then
    echo "error: tla2tools.jar v$TLA_VERSION does not match its pinned sha256" >&2
    exit 1
  fi
  mv "$work/tla2tools.jar" "$jar"
fi
cp "$here/BatchQueue.tla" "$work/"

write_cfg() {
  local name=$1 bug=$2 property
  shift 2
  {
    echo 'SPECIFICATION Spec'
    echo "CONSTANTS $BOUNDS Bug = \"$bug\""
    for property in "$@"; do
      if [[ " $INVARIANTS " == *" $property "* ]]; then echo "INVARIANT $property"; else echo "PROPERTY $property"; fi
    done
  } >"$work/$name.cfg"
}

# Prints a TLC counterexample as one line per step: the action and the variables it changed.
print_trace() {
  awk '
    function flush(   i, k, line) {
      if (!have) return
      line = sprintf("  %2d %-20s", num, action)
      for (i = 1; i <= count; i++) {
        k = order[i]
        if (num > 1 && prev[k] != cur[k]) line = line " " k "=" cur[k]
        prev[k] = cur[k]
      }
      print line
      have = 0
    }
    /^State [0-9]+:/ { flush(); have = 1; num = $2 + 0; action = $3; gsub(/[<>]/, "", action); count = 0; next }
    have && /^\/\\ / { name = $2; order[++count] = name; value = $0; sub(/^\/\\ [^ ]+ = /, "", value); cur[name] = value; next }
    have && /^[ \t]+[^ \t]/ { line = $0; sub(/^[ \t]+/, "", line); cur[order[count]] = cur[order[count]] " " line; next }
    have && /^$/ { next }
    { flush() }
    END { flush() }
  ' "$1"
}

check() {
  local name=$1 bug=$2 expected=$3 fixed=$4 out status=0 states seconds properties=()
  if [[ -z $expected ]]; then
    for property in $INVARIANTS $ACTION_PROPERTIES; do
      [[ " $KNOWN_FINDINGS " == *" $property "* ]] || properties+=("$property")
    done
  else
    properties=(TypeOK "$expected")
  fi
  write_cfg "$name" "$bug" "${properties[@]}"
  out="$work/$name.out"
  # TLC unpacks Naturals.tla and friends into java.io.tmpdir, which concurrent checks would share.
  mkdir -p "$work/tmp-$name"
  (cd "$work" && java -XX:+UseParallelGC -Djava.io.tmpdir="$work/tmp-$name" -cp "$jar" tlc2.TLC \
    -workers 1 -metadir "$work/states-$name" -config "$name.cfg" BatchQueue.tla) >"$out" 2>&1 || status=$?
  states=$(sed -n 's/.* \([0-9]*\) distinct states found.*/\1/p' "$out" | tail -1)
  seconds=$(sed -n 's/^Finished in \([^ ]*\) .*/\1/p' "$out")
  if [[ -z $expected ]]; then
    if [[ $status -eq 0 ]] && grep -q 'No error has been found' "$out"; then
      printf 'ok    %-27s all properties hold        %8s states %5s\n' "$name" "$states" "$seconds"
      return 0
    fi
  elif grep -Eq "^Error: (Invariant|Action property) $expected is violated" "$out"; then
    printf 'ok    %-27s breaks %-27s %4s steps %5s  (%s)\n' "$name" "$expected" \
      "$(grep -c '^State [0-9]*:' "$out")" "$seconds" "$fixed"
    [[ -n ${VERBOSE:-} ]] && print_trace "$out"
    return 0
  fi
  if [[ -n $expected ]] && grep -q 'No error has been found' "$out"; then
    if [[ $fixed == 'open finding' ]]; then
      printf 'FAIL  %-27s %s holds now: drop this run and %s from KNOWN_FINDINGS\n' "$name" "$expected" "$expected"
    else
      printf 'FAIL  %-27s Bug = "%s" keeps %s: the model no longer catches the bug %s fixed\n' \
        "$name" "$bug" "$expected" "$fixed"
    fi
    return 1
  fi
  printf 'FAIL  %-27s expected %s\n' "$name" "${expected:-every property to hold}"
  if grep -q '^State [0-9]*:' "$out"; then
    grep -E '^Error: (Invariant|Action property) ' "$out" | head -1
    print_trace "$out"
  else
    tail -15 "$out"
  fi
  return 1
}

failed=0
if [[ $# -gt 0 ]]; then
  for run in "${RUNS[@]}"; do
    IFS='|' read -r name bug expected fixed <<<"$run"
    if [[ $name == "$1" ]]; then VERBOSE=1 check "$name" "$bug" "$expected" "$fixed" || failed=1; exit $failed; fi
  done
  echo "error: unknown run $1; runs: $(printf '%s ' "${RUNS[@]%%|*}")" >&2
  exit 2
fi
for run in "${RUNS[@]}"; do
  IFS='|' read -r name bug expected fixed <<<"$run"
  check "$name" "$bug" "$expected" "$fixed" || failed=1
done
exit $failed
