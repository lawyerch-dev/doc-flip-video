FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fonts-noto-cjk \
    fonts-wqy-zenhei \
    fonts-wqy-microhei \
    libfontconfig1 \
    libfreetype6 \
    libpng16-16 \
    libjpeg62-turbo \
    libpango1.0-0 \
    libcairo2 \
    libgif7 \
    librsvg2-2 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm ci --production

# Copy source code
COPY . .

# Download fonts
RUN chmod +x scripts/download-fonts.sh && bash scripts/download-fonts.sh

# Create output directory
RUN mkdir -p output

# Expose port for API
EXPOSE 3000

# Start command
CMD ["node", "src/server.mjs"]
