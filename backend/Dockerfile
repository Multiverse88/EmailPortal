# Multi-stage Dockerfile for Backend
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

# Copy package configurations
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package-lock.json* ./backend/
COPY prisma ./prisma

# Install dependencies
RUN npm install && npm install --prefix backend

# Generate Prisma Client
RUN npx prisma generate --schema=./prisma/schema.prisma

# Copy backend source
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src

# Compile backend TypeScript
RUN cd backend && npm run build

# Runtime Stage
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat wget

ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL="file:/app/data/prod.db"
ENV STORAGE_DIR="/app/storage"

# Copy package files & prisma schema
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package-lock.json* ./backend/
COPY prisma ./prisma

# Install production dependencies & CLI tools, then generate Prisma client directly in runner
RUN npm install --omit=dev && \
    npm install --prefix backend --omit=dev && \
    npm install -g prisma tsx && \
    npx prisma generate --schema=./prisma/schema.prisma

# Copy compiled dist and src (needed for tsx seed script)
COPY --from=builder /app/backend/dist ./backend/dist
COPY backend/src ./backend/src

# Copy entrypoint script
COPY backend/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Volumes mount points
RUN mkdir -p /app/data /app/storage

EXPOSE 4000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "backend/dist/index.js"]
