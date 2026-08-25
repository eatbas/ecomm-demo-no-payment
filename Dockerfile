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

# nginx-unprivileged 1.28.2 on Alpine Linux 3.23 runs as UID/GID 101.
FROM nginxinc/nginx-unprivileged:1.28.2-alpine3.23@sha256:7377697a821c131a924a7105fafbe7414db4e9fcc77a6f08f776f33f141ec3f8 AS runtime

COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=101:101 /app/dist/ /usr/share/nginx/html/

USER 101:101
EXPOSE 8080

# The image's templating entrypoint is unnecessary and attempts read-only edits.
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["wget", "--quiet", "--spider", "http://127.0.0.1:8080/healthz"]

STOPSIGNAL SIGQUIT
