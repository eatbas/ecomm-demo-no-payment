# Playwright 1.61.0 on Ubuntu 24.04. The package version in package.json must match.
FROM mcr.microsoft.com/playwright:v1.61.0-noble@sha256:57b65fdc9ceabe0ef613124c7bbe2babcf9362c4d85e382fe3b03604e84b428a

WORKDIR /audit

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY tests/browser-audit.mjs ./tests/browser-audit.mjs

USER pwuser

ENTRYPOINT ["node", "tests/browser-audit.mjs"]
