#!/bin/bash

# Smart build script for @gainium/backtester
# Only builds if source files are newer than dist or if dist doesn't exist

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"
SRC_DIR="$PROJECT_DIR/src"
BUILD_MARKER="$DIST_DIR/.build-marker"

# Function to get file modification time (cross-platform)
get_mtime() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        stat -f %m "$1" 2>/dev/null || echo 0
    else
        # Linux and others
        stat -c %Y "$1" 2>/dev/null || echo 0
    fi
}

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
    NEWEST_SRC=0
    while IFS= read -r -d '' file; do
        file_time=$(get_mtime "$file")
        if [ "$file_time" -gt "$NEWEST_SRC" ]; then
            NEWEST_SRC="$file_time"
        fi
    done < <(find "$SRC_DIR" -name "*.ts" -type f -print0)
    
    BUILD_TIME=$(get_mtime "$BUILD_MARKER")
    
    if [ "$NEWEST_SRC" -gt "$BUILD_TIME" ]; then
        echo "📦 Building @gainium/backtester: source files newer than build"
        npm run build
        touch "$BUILD_MARKER"
        exit 0
    fi
fi

# Check if tsconfig.json is newer
if [ -f "$PROJECT_DIR/tsconfig.json" ]; then
    TSCONFIG_TIME=$(get_mtime "$PROJECT_DIR/tsconfig.json")
    BUILD_TIME=$(get_mtime "$BUILD_MARKER")
    
    if [ "$TSCONFIG_TIME" -gt "$BUILD_TIME" ]; then
        echo "📦 Building @gainium/backtester: tsconfig.json updated"
        npm run build
        touch "$BUILD_MARKER"
        exit 0
    fi
fi

echo "✅ @gainium/backtester: dist is up to date"
exit 0
