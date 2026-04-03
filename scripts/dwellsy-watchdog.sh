#!/bin/bash
# Dwellsy ETL watchdog - checks process health and progress every 60s
while true; do
  PROCS=$(ps aux | grep "etl-dwellsy" | grep node | grep -v grep | wc -l | tr -d ' ')
  P1_MATCHED=$(grep -c "matched" /tmp/dwellsy_p1.log 2>/dev/null || echo 0)
  P2_MATCHED=$(grep -c "matched" /tmp/dwellsy_p2.log 2>/dev/null || echo 0)
  P1_LATEST=$(grep "matched" /tmp/dwellsy_p1.log 2>/dev/null | tail -1)
  P2_LATEST=$(grep "matched" /tmp/dwellsy_p2.log 2>/dev/null | tail -1)
  CREATED=$(grep -c "fallback created\|Creating" /tmp/dwellsy_p1.log /tmp/dwellsy_p2.log 2>/dev/null | tail -1)
  
  echo "[$(date +%H:%M:%S)] Procs: $PROCS | P1 files done: $P1_MATCHED | P2 files done: $P2_MATCHED"
  echo "  P1 latest: $P1_LATEST"
  echo "  P2 latest: $P2_LATEST"
  
  if [ "$PROCS" -eq 0 ]; then
    echo "[$(date +%H:%M:%S)] ALL PROCESSES COMPLETE!"
    echo "=== FINAL P1 ===" && tail -5 /tmp/dwellsy_p1.log
    echo "=== FINAL P2 ===" && tail -5 /tmp/dwellsy_p2.log
    break
  fi
  sleep 60
done
