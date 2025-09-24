# Use Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache git python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies (using install to update lock file)
RUN npm install --legacy-peer-deps

# Copy project files
COPY . .

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S expo -u 1001 -G nodejs && \
    chown -R expo:nodejs /app

USER expo

# Expose ports for Expo
EXPOSE 3000 19000 19001 19002 19006

# Set environment variables for Expo web
ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
ENV EXPO_USE_NATIVE_PLATFORMS=false

# Start Expo for web
CMD ["npx", "expo", "start", "--web", "--port", "3000"]