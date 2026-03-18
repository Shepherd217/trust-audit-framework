# Simple TAP Agent Example
FROM node:20-alpine

WORKDIR /app

# Install dependencies
RUN npm install node-fetch@2

# Copy agent code
COPY simple-agent.js ./

# Run as non-root
USER node

# Start the agent
CMD ["node", "simple-agent.js"]
