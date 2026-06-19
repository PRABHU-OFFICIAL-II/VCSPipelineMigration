# Stage 1 — Build the React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2 — Serve with Nginx + run the proxy server side-by-side
FROM node:20-alpine

# Install Nginx
RUN apk add --no-cache nginx

WORKDIR /app

# Copy the compiled React app into Nginx's web root
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy the proxy server and its dependencies
COPY proxy-server.cjs ./
# Copy package files so we can install only the proxy's runtime dep if needed
# (proxy-server.cjs uses only Node built-ins, so no npm install needed)

# Expose port 80 (Nginx)
EXPOSE 80

# Start script: launch proxy in background, then Nginx in foreground
CMD node /app/proxy-server.cjs & nginx -g "daemon off;"
