FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
COPY --chown=node:node package.json server.mjs ./
COPY --chown=node:node lib ./lib
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 4000
CMD ["node", "server.mjs"]
