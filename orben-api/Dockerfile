# Orben API Dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:8080/v1/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

EXPOSE 8080

CMD ["node", "index.js"]
