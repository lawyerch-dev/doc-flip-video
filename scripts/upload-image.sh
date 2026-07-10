npm run dev #!/bin/bash

# Upload image to GitHub repository and get raw URL
# Usage: ./scripts/upload-image.sh <image-path> [repo-name]

set -e

IMAGE_PATH="$1"
REPO_NAME="${2:-BluerAngala/doc-flip-video}"

if [ -z "$IMAGE_PATH" ]; then
    echo "Usage: $0 <image-path> [repo-name]"
    echo "Example: $0 ./my-image.png BluerAngala/doc-flip-video"
    exit 1
fi

if [ ! -f "$IMAGE_PATH" ]; then
    echo "Error: File not found: $IMAGE_PATH"
    exit 1
fi

# Get filename
FILENAME=$(basename "$IMAGE_PATH")

# Upload to GitHub using gh CLI
echo "Uploading $FILENAME to $REPO_NAME..."

# Create a temporary directory for the upload
TEMP_DIR=$(mktemp -d)
cp "$IMAGE_PATH" "$TEMP_DIR/$FILENAME"

# Upload using gh api
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO_NAME/contents/assets/$FILENAME" \
  -f message="Add $FILENAME" \
  -f content="$(base64 < "$TEMP_DIR/$FILENAME")"

# Clean up
rm -rf "$TEMP_DIR"

# Generate raw URL
RAW_URL="https://raw.githubusercontent.com/$REPO_NAME/main/assets/$FILENAME"

echo ""
echo "✅ Upload successful!"
echo "📄 Raw URL: $RAW_URL"
echo ""
echo "You can now use this URL in your template.json:"
echo "\"src\": \"$RAW_URL\""