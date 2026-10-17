# Node 22 satisfies package.json engines.node (>=18).
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev \
    && mkdir -p logs \
    && chown -R node:node /app

COPY --chown=node:node . .

ENV PORT=49621
EXPOSE 49621

USER node

# Catalog load can take a while on first boot (GitHub ZIPs or Supabase).
HEALTHCHECK --start-period=60s --interval=30s --timeout=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||49621)+'/manifest.json').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
