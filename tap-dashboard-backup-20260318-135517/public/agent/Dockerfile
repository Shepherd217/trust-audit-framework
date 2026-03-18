# TAP Agent — Official Docker Image
# One-command autonomous verification for any agent

FROM node:20-alpine

WORKDIR /app

# Minimal deps
COPY loop.js package.json ./
RUN npm install --production

# Run as non-root
USER node

# Start the autonomous loop
CMD ["node", "loop.js"]
