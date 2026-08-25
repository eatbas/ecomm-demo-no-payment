# syntax=docker/dockerfile:1

# Node.js 22.22.2 on Alpine Linux 3.23. The digest makes the build input immutable.
FROM node:22.22.2-alpine3.23@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

FROM deps AS checks

COPY . .
RUN npm run lint \
    && npm run typecheck \
    && npm run test \
    && npm run check:payment-boundary

FROM checks AS build

RUN npm run build

FROM deps AS production-dependencies

RUN npm prune --omit=dev

# The same immutable Node.js input runs the compiled API and static storefront.
FROM node:22.22.2-alpine3.23@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    ORDER_DB_PATH=/data/orders.sqlite

USER root
COPY --from=production-dependencies --chown=node:node /app/node_modules/ ./node_modules/
COPY --chown=node:node package.json package-lock.json ./
COPY --from=build --chown=node:node /app/dist/ ./dist/
COPY --from=build --chown=node:node /app/dist-server/ ./dist-server/
COPY --from=build --chown=node:node /app/server/db/migrations/ ./dist-server/server/db/migrations/
RUN mkdir /data && chown node:node /data

USER node
EXPOSE 8080

CMD ["node", "dist-server/server/start.js"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["wget", "--quiet", "--spider", "http://127.0.0.1:8080/healthz"]

STOPSIGNAL SIGTERM
