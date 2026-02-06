#!/bin/bash
# Deploy EveryRow app to Make.com
# Loads credentials from .env file

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env file if it exists
if [ -f "$PROJECT_DIR/.env" ]; then
    echo "Loading credentials from .env..."
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
elif [ -f "$PROJECT_DIR/.env.local" ]; then
    echo "Loading credentials from .env.local..."
    export $(grep -v '^#' "$PROJECT_DIR/.env.local" | xargs)
else
    echo "Error: No .env or .env.local file found"
    echo "Copy .env.example to .env and fill in your credentials:"
    echo "  cp .env.example .env"
    exit 1
fi

# Validate required variables
if [ -z "$MAKE_API_KEY" ]; then
    echo "Error: MAKE_API_KEY not set in .env file"
    exit 1
fi

if [ -z "$MAKE_APP_ID" ]; then
    echo "Error: MAKE_APP_ID not set in .env file"
    exit 1
fi

# Run the deploy script
cd "$PROJECT_DIR"
npx ts-node scripts/deploy.ts
