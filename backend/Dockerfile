# -----------------------------------------------------------------------------
# Backend Dockerfile — Node.js API server.
# Multi-stage isn't needed here (no build step for plain Node/Express), so
# this is a single simple stage optimized for layer caching: dependencies
# are installed before the rest of the source is copied in, so `docker
# compose build` only re-installs npm packages when package.json changes.
# -----------------------------------------------------------------------------

FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better Docker layer caching).
COPY package*.json ./
RUN npm install --omit=dev

# Now copy the rest of the source.
COPY . .

EXPOSE 5000

CMD ["node", "src/server.js"]
