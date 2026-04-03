#!/bin/bash
# Watchdog: restarts paraphrase-reviews.mjs if it crashes
# Exits when there are no more reviews to process

cd "/Users/jesselafauci/Library/Mobile Documents/com~apple~CloudDocs/Desktop/lucid-rents"
LOG="scripts/paraphrase-reviews.log"

while true; do
  echo "[watchdog] Starting paraphrase-reviews.mjs at $(date)" >> "$LOG"
  node scripts/paraphrase-reviews.mjs >> "$LOG" 2>&1
  EXIT_CODE=$?

  # Check if it finished naturally (no more reviews)
  if tail -3 "$LOG" | grep -q "No more reviews to process"; then
    echo "[watchdog] All reviews processed. Exiting at $(date)" >> "$LOG"
    exit 0
  fi

  if [ $EXIT_CODE -eq 0 ]; then
    echo "[watchdog] Script exited cleanly. Exiting at $(date)" >> "$LOG"
    exit 0
  fi

  echo "[watchdog] Script crashed (exit $EXIT_CODE). Restarting in 10s... $(date)" >> "$LOG"
  sleep 10
done
