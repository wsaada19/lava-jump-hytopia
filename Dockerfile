# Use an official Node.js runtime as a parent image
FROM oven/bun:latest

# Set the working directory in the container
WORKDIR /usr/src/app

# Install cloudflared
RUN apt-get update && \
    apt-get install -y wget && \
    wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -O /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

# Copy package.json and bun.lockb (if it exists)
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on
EXPOSE 8080

# Create a shell script to run the application and cloudflared
RUN echo '#!/bin/bash\n\
# Start the game server\n\
NODE_ENV=production bun --watch index.ts &\n\
\n\
# Wait a moment to ensure the server is up\n\
sleep 5\n\
\n\
# Start cloudflared tunnel\n\
cloudflared tunnel --url http://localhost:8080\n\
' > /usr/src/app/start.sh && \
chmod +x /usr/src/app/start.sh

# Set the entrypoint to our start script
ENTRYPOINT ["/usr/src/app/start.sh"]