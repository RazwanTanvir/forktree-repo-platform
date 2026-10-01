# Production Dockerfile for BlockchainForkTree Platform
FROM node:20-alpine AS base

# Install security updates
RUN apk update && apk add --no-cache python3 make g++

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Ensure storage directories exist
RUN mkdir -p storage/vault config

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000 8545 8546 8547 8548 8549 8550 8551

CMD ["node", "server.js"]
