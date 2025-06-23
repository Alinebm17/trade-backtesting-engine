#!/bin/bash

# Smart build script for @gainium/backtester
# Only builds if source files are newer than dist or if dist doesn't exist

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"
SRC_DIR="$PROJECT_DIR/src"
BUILD_MARKER="$DIST_DIR/.build-marker"

# Check if dist directory exists
if [ ! -d "$DIST_DIR" ]; then
    echo "📦 Building @gainium/backtester: dist directory doesn't exist"
    npm run build
    touch "$BUILD_MARKER"
    exit 0
fi

# Check if build marker exists
if [ ! -f "$BUILD_MARKER" ]; then
    echo "📦 Building @gainium/backtester: build marker missing"
    npm run build
    touch "$BUILD_MARKER"
    exit 0
fi

# Find the newest source file
if [ -d "$SRC_DIR" ]; then
    NEWEST_SRC=$(find "$SRC_DIR" -name "*.ts" -type f -exec stat -f %m {} \; | sort -n | tail -1)
    BUILD_TIME=$(stat -f %m "$BUILD_MARKER" 2>/dev/null || echo 0)
    
    if [ "$NEWEST_SRC" -gt "$BUILD_TIME" ]; then
        echo "📦 Building @gainium/backtester: source files newer than build"
        npm run build
        touch "$BUILD_MARKER"
        exit 0
    fi
fi

# Check if tsconfig.json is newer
if [ -f "$PROJECT_DIR/tsconfig.json" ]; then
    TSCONFIG_TIME=$(stat -f %m "$PROJECT_DIR/tsconfig.json")
    BUILD_TIME=$(stat -f %m "$BUILD_MARKER" 2>/dev/null || echo 0)
    
    if [ "$TSCONFIG_TIME" -gt "$BUILD_TIME" ]; then
        echo "📦 Building @gainium/backtester: tsconfig.json updated"
        npm run build
        touch "$BUILD_MARKER"
        exit 0
    fi
fi

echo "✅ @gainium/backtester: dist is up to date"
exit 0
