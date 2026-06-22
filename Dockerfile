FROM oven/bun:1.3.14-alpine AS build
WORKDIR /app

COPY package.json bun.lock tsconfig.json bunfig.toml biome.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN bun install --frozen-lockfile
RUN bun run typecheck && bun test && bun run build

FROM oven/bun:1.3.14-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    BANTUIN_HOST=0.0.0.0 \
    BANTUIN_PORT=4310 \
    DATABASE_URL=file:/data/bantuin.sqlite \
    BANTUIN_PROVIDER=mock

RUN addgroup -S bantuin && adduser -S bantuin -G bantuin && mkdir -p /data && chown bantuin:bantuin /data
COPY --from=build --chown=bantuin:bantuin /app/dist/api/index.js ./index.js
COPY --from=build --chown=bantuin:bantuin /app/dist/web ./dist/web

USER bantuin
EXPOSE 4310
VOLUME ["/data"]
CMD ["bun", "run", "index.js"]
