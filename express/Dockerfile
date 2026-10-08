FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3004

EXPOSE 3004

CMD ["node", "src/server.js"]
