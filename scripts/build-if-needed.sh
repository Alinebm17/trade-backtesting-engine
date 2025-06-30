#!/bin/bash

# Smart build script for @gainium/backtester
# Only builds if source files are newer than dist or if dist doesn't exist

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"
SRC_DIR="$PROJECT_DIR"
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

# Function to get file modification time (cross-platform)
get_mtime() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        stat -f %m "$1" 2>/dev/null || echo 0
    else
        # Linux
        stat -c %Y "$1" 2>/dev/null || echo 0
    fi
}

# Check if any TypeScript source files are newer than build marker
NEEDS_BUILD=false

# Find all TypeScript files and check if any are newer than build marker
BUILD_TIME=$(get_mtime "$BUILD_MARKER")
while IFS= read -r -d '' file; do
    FILE_TIME=$(get_mtime "$file")
    if [ "$FILE_TIME" -gt "$BUILD_TIME" ]; then
        NEEDS_BUILD=true
        break
    fi
done < <(find "$SRC_DIR" -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" -type f -print0)

if [ "$NEEDS_BUILD" = true ]; then
    echo "📦 Building @gainium/backtester: source files newer than build"
    npm run build
    touch "$BUILD_MARKER"
    exit 0
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
