# Build the client, then run every test (the web server tests need the build)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm test

# One small Node server: static files plus the whiteboard's /ws endpoint.
# It binds port 80 as root, then drops to the unprivileged node user.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=80
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/dist ./dist
ARG APP_VERSION=dev
RUN echo "$APP_VERSION" > dist/version.txt
EXPOSE 80
CMD ["node", "server/index.js"]
