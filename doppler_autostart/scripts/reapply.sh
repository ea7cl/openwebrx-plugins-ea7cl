#!/bin/sh
set -e
ROOT="/usr/lib/python3/dist-packages/htdocs/plugins/receiver"
python3 "$ROOT/doppler_autostart/patch.py"
