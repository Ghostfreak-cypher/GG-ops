# GG-Ops on a server of your own (gg-docs runs it as its "ggops" service, behind its Caddy).
#
# Settings live in .env.production next to this file. The build stage reads it so the NEXT_PUBLIC_* values (Pusher)
# are compiled into the browser code; the final image doesn't contain it, and the server passes the same file to the
# container at runtime instead (env_file).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev --legacy-peer-deps && rm -rf .next/cache

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package.json /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
