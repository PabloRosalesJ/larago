#!/usr/bin/env bash
# Copy MD files from CONTENT to Astro's content directory flat
set -e

SRC_DIR="/Users/incfile/Desktop/LaraGo/CONTENT"
DST_DIR="/Users/incfile/Desktop/LaraGo/larago/src/content/docs"

mkdir -p "$DST_DIR"

# Copy flat: rename from XX-section/XX-XX-name.md to XX-section-XX-XX-name.md
for dir in "$SRC_DIR"/*/; do
    section=$(basename "$dir")
    for file in "$dir"*.md; do
        [ -f "$file" ] || continue
        basename=$(basename "$file")
        # Skip template.md
        [ "$basename" = "template.md" ] && continue
        # Copy with section prefix
        cp "$file" "$DST_DIR/$section-$basename"
        echo "  Copied: $section/$basename"
    done
done

echo "Done! Files copied to $DST_DIR"
ls "$DST_DIR" | wc -l
