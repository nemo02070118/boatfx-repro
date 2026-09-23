#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python -m pip install -q -r requirements.txt
python repro.py
python reproduce_headline.py
echo "OK: verify passed"
