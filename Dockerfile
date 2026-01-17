# n8n Backup Manager v1.3.5


# Build Frontend
FROM node:18-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Setup Backend
FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --production
COPY server/ ./

# Copy built frontend
COPY --from=client-build /app/client/dist ./public

# Create directories
RUN mkdir -p backups data

# Environment variables
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "index.js"]
