# -----------------------------------------------------------------------------
# Frontend Dockerfile — DEVELOPMENT image, runs Vite's dev server with hot
# module reload so editing files on your host still live-reloads in the
# browser. For a production build, see Dockerfile.prod (builds static files
# and serves them with nginx — used by the "docker compose --profile prod" setup).
# -----------------------------------------------------------------------------

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# --host 0.0.0.0 is required so the dev server is reachable from outside the
# container (Vite binds to localhost only by default).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
