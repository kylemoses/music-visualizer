#!/bin/bash
# Music Visualizer - Run locally (macOS/Linux)
# Prerequisites: Node.js 18+, Python 3.9+
# Run from repo root: ./run-local.sh

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check prerequisites
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Install from https://nodejs.org/${NC}"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 not found. Install Python 3.9+${NC}"
    exit 1
fi

# Backend setup
SERVER_DIR="$ROOT/server"
VENV="$SERVER_DIR/venv"

if [ ! -d "$VENV" ]; then
    echo -e "${CYAN}Creating Python venv in server/...${NC}"
    python3 -m venv "$VENV"
fi

source "$VENV/bin/activate"

if [ ! -f "$VENV/bin/uvicorn" ]; then
    echo -e "${CYAN}Installing backend dependencies (this may take several minutes for torch/demucs)...${NC}"
    pip install -r "$SERVER_DIR/requirements.txt"
fi

# Frontend setup
CLIENT_DIR="$ROOT/client"

if [ ! -d "$CLIENT_DIR/node_modules" ]; then
    echo -e "${CYAN}Installing frontend dependencies...${NC}"
    cd "$CLIENT_DIR"
    npm install
    cd "$ROOT"
fi

# Kill any existing processes on our ports
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Start backend in background
echo -e "${GREEN}Starting backend on http://localhost:8000 ...${NC}"
cd "$SERVER_DIR"
source "$VENV/bin/activate"
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
echo -e "${GREEN}Starting frontend on http://localhost:5173 ...${NC}"
cd "$CLIENT_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Music Visualizer is running!${NC}"
echo -e "${GREEN}  Frontend: http://localhost:5173${NC}"
echo -e "${GREEN}  Backend:  http://localhost:8000${NC}"
echo -e "${GREEN}  Press Ctrl+C to stop${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Handle Ctrl+C to kill both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

# Wait for either process to exit
wait
