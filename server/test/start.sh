#!/bin/sh
set -e

# Dynamically find libfaketime
FAKETIME_LIB=$(find /usr/lib -name 'libfaketime.so.1' 2>/dev/null | head -1)

if [ -z "$FAKETIME_LIB" ]; then
  echo "❌ libfaketime not found! Running with real time."
else
  # Ensure FAKETIME starts with @, otherwise the clock stays frozen
  export LD_PRELOAD="$FAKETIME_LIB"
  export FAKETIME_NO_CACHE=1
  export FAKETIME_DONT_FAKE_MONOTONIC=1
  echo ""
  echo "FAKETIME is set to:      ${FAKETIME:-(unset)}"
  echo "Current (faked) date:    $(date)"
  echo "====================================================="
  echo ""
fi

# Run v1
cd /app/v1
exec node index.js
