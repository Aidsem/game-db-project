#!/bin/bash
# Start the server on Linux/macOS (venv must already exist). First time: chmod +x start_server.sh
cd "$(dirname "$0")"
source venv/bin/activate
python app.py
