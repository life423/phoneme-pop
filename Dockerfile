# Build the static site (tests must pass first)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test && npm run build

# Serve it
FROM nginx:stable-alpine
ARG APP_VERSION=dev
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN echo "$APP_VERSION" > /usr/share/nginx/html/version.txt
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
