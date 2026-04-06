# ---- Stage 1: build the React frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /app

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend/ ./frontend/
RUN cd frontend && npm run build


# ---- Stage 2: production image ----
FROM node:20-alpine
WORKDIR /app

# Install backend production dependencies only
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source and database migrations
COPY backend/src ./src
COPY backend/drizzle ./drizzle

# Copy the compiled frontend into public/ so Express can serve it
COPY --from=frontend-build /app/frontend/dist ./public

# SQLite data lives on a mounted volume so it survives container restarts
VOLUME ["/data"]

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001
# Override DATABASE_URL at runtime to point at your mounted volume, e.g.:
#   -e DATABASE_URL=file:/data/production.sqlite
ENV DATABASE_URL=file:/data/production.sqlite

CMD ["node", "src/index.js"]
