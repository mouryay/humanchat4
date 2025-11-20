# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci

FROM deps AS build
ENV SKIP_WEB_BUILD=1
COPY . .
RUN npm run build

FROM deps AS prod-deps
RUN npm prune --omit=dev

FROM base AS runner
ENV PORT=8080
ENV SKIP_WEB_BUILD=1
WORKDIR /app
COPY package*.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY openapi.yaml ./openapi.yaml

EXPOSE 8080
CMD ["node", "dist/src/server/index.js"]
