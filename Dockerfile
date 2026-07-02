# The Haiku Keepers — zero-dependency game server (Node >= 22.5)
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY codec ./codec
COPY server ./server
COPY web ./web
ENV PORT=8090 \
    DB_FILE=/data/haiku.db
VOLUME /data
EXPOSE 8090
USER node
CMD ["node", "server/index.js"]
