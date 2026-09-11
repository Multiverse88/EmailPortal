# Multi-stage Dockerfile for Backend
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat fontconfig ttf-dejavu

# Copy package configurations
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package-lock.json* ./backend/
COPY prisma ./prisma

# Install dependencies
RUN npm install && npm install --prefix backend

# Generate Prisma Client
RUN npx prisma generate --schema=./prisma/schema.prisma && \
    rm -rf backend/node_modules/@prisma

# Copy backend source & bundled fonts
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src
COPY backend/fonts ./backend/fonts

# Compile backend TypeScript
RUN cd backend && npm run build

# Runtime Stage
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat wget fontconfig ttf-dejavu

ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL="file:/app/data/prod.db"
ENV STORAGE_DIR="/app/storage"
ENV PRISMA_CLI_BINARY_TARGETS="linux-musl-openssl-3.0.x"

# Copy package files & prisma schema
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package-lock.json* ./backend/
COPY prisma ./prisma

# Install production dependencies & CLI tools, then generate Prisma client directly in runner
RUN npm install --omit=dev && \
    npm install --prefix backend --omit=dev && \
    npm install -g prisma@5.22.0 tsx && \
    npx prisma generate --schema=./prisma/schema.prisma && \
    rm -rf backend/node_modules/@prisma

# Copy compiled dist, src, and bundled fonts
COPY --from=builder /app/backend/dist ./backend/dist
COPY backend/src ./backend/src
COPY backend/fonts ./backend/fonts

# Copy entrypoint script
COPY backend/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Volumes mount points
RUN mkdir -p /app/data /app/storage

EXPOSE 4000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "backend/dist/index.js"]
