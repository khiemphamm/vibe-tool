# Build stage
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# Install Playwright dependencies and Chromium
RUN npx playwright install-deps chromium
RUN npx playwright install chromium

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["npm", "start"]
