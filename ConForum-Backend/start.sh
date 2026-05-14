#!/bin/bash
set -e

echo "Starting conforum-ieee-checker (Flask) on port 6000..."
(cd "conforum-ieee-checker" && python app.py) &

echo "Starting conforum-backend (Node/Express) on port 8080..."
cd "conforum-backend" && node server.js
