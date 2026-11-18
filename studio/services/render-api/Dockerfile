# nooi Studio render service — FFmpeg + Node 22. Build from the studio folder:  docker build -f services/render-api/Dockerfile .
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/* \
 && corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/editor-core packages/editor-core
COPY services/render-api services/render-api
RUN pnpm install --frozen-lockfile --filter "@nooi/render-api..." && cd services/render-api && pnpm exec prisma generate \
 && mkdir -p /data/uploads /data/renders && chown -R node:node /data
USER node
WORKDIR /app/services/render-api
ENV NODE_ENV=production RENDER_HOST=0.0.0.0 RENDER_PORT=8790 MEDIA_DIR=/media UPLOAD_DIR=/data/uploads RENDER_DIR=/data/renders
EXPOSE 8790
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8790/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# the API applies the database migrations first; the worker (command: pnpm worker) only renders
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm start"]
