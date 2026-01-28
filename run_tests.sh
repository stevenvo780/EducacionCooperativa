#!/bin/bash
# Script to run all tests locally

set -e

echo "================================"
echo "Running Test Suite"
echo "================================"

# Create documentos directory if it doesn't exist
mkdir -p documentos

echo ""
echo "1. Running Unit Tests..."
echo "================================"
pytest tests/unit/ -v --cov=. --cov-report=term-missing --cov-report=html

echo ""
echo "2. Installing Playwright browsers (if needed)..."
echo "================================"
playwright install chromium 2>/dev/null || echo "Playwright browsers already installed"

echo ""
echo "3. Starting server for E2E tests..."
echo "================================"
# Start server in background
python servidor.py > /tmp/test_server.log 2>&1 &
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"

# Wait for server to be ready
echo "Waiting for server to be ready..."
if command -v timeout > /dev/null 2>&1; then
    timeout 30 bash -c 'until curl -f http://localhost:8888/ > /dev/null 2>&1; do sleep 1; done' || {
        echo "Server failed to start. Last 20 lines of log:"
        tail -20 /tmp/test_server.log
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    }
elif command -v gtimeout > /dev/null 2>&1; then
    gtimeout 30 bash -c 'until curl -f http://localhost:8888/ > /dev/null 2>&1; do sleep 1; done' || {
        echo "Server failed to start. Last 20 lines of log:"
        tail -20 /tmp/test_server.log
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    }
else
    # Fallback without timeout command
    for i in {1..30}; do
        if curl -f http://localhost:8888/ > /dev/null 2>&1; then
            break
        fi
        if [ $i -eq 30 ]; then
            echo "Server failed to start. Last 20 lines of log:"
            tail -20 /tmp/test_server.log
            kill $SERVER_PID 2>/dev/null || true
            exit 1
        fi
        sleep 1
    done
fi

echo ""
echo "4. Running E2E Tests..."
echo "================================"
pytest tests/e2e/ -v --tb=short || TEST_FAILED=1

# Stop server
echo ""
echo "5. Cleaning up..."
echo "================================"
kill $SERVER_PID 2>/dev/null || true
echo "Server stopped"

if [ -n "$TEST_FAILED" ]; then
    echo ""
    echo "❌ Some tests failed"
    exit 1
fi

echo ""
echo "================================"
echo "✅ All tests passed!"
echo "================================"
echo ""
echo "Coverage report available at: htmlcov/index.html"
