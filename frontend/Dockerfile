# syntax=docker/dockerfile:1.7
# Image frontend ReadQuest (Next.js standalone). Build dari root repo:
#   docker build -t readquest-frontend --build-arg API_PROXY_TARGET=http://backend:8000 frontend
# API_PROXY_TARGET dibaca saat build (rewrites /api & /ws ikut tersimpan di hasil build).
# Jaringan dengan proxy TLS korporat: tambahkan --secret id=ca,src=/path/ca.crt (tidak masuk image).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=ca,required=false \
    --mount=type=cache,target=/root/.npm \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    npm ci --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
ARG API_PROXY_TARGET=http://backend:8000
ENV API_PROXY_TARGET=$API_PROXY_TARGET \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 10001 nextjs && adduser -S -u 10001 -G nextjs nextjs
WORKDIR /app
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["wget", "-q", "--spider", "http://127.0.0.1:3000/offline"]
CMD ["node", "server.js"]
