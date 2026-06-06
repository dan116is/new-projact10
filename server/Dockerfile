# Production image for the API.
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies only (leverages layer caching).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

# Persist the JSON data store on a volume so it survives container restarts.
# (For horizontal scaling, point the app at Postgres instead — see README.)
RUN mkdir -p /app/data && chown -R node:node /app
VOLUME ["/app/data"]

# Run as the unprivileged built-in `node` user.
USER node

EXPOSE 4000

# Container-level health check against the API.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
