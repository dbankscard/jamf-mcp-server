#!/bin/bash
set -e

MAX_ITERATIONS=${1:-10}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting Ralph - Autonomous Agent Loop"
echo "Max iterations: $MAX_ITERATIONS"
echo "Working directory: $SCRIPT_DIR"
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "=== Iteration $i of $MAX_ITERATIONS ==="

  # Pipe prompt to Claude Code with permissions disabled
  OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" \
    | claude --dangerously-skip-permissions 2>&1 \
    | tee /dev/stderr) || true

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<ralph>COMPLETE</ralph>"; then
    echo ""
    echo "All stories complete!"
    exit 0
  fi

  # Brief pause between iterations
  sleep 2
done

echo ""
echo "Max iterations ($MAX_ITERATIONS) reached"
echo "Check scripts/ralph/prd.json for remaining stories"
exit 1
