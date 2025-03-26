
# This Dockerfile is for building the Electron app, not for running it
# It creates distributable packages that can be downloaded and installed by users

FROM node:22-bullseye

# Install required dependencies for Electron
RUN apt-get update && apt-get install -y \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxtst6 \
    libxss1 \
    libgconf-2-4 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libnss3 \
    libxss1 \
    fonts-liberation \
    libappindicator3-1 \
    xvfb \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies (including dev dependencies for building)
RUN pnpm install

# Copy the rest of the application
COPY . .

# Build the application
RUN pnpm build

# Use electron-builder to create packages for different platforms
# Adjust the command depending on your target platforms
CMD ["pnpm", "electron-builder", "--linux", "--win", "--mac"]
