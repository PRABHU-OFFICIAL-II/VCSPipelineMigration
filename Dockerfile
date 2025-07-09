# Stage 1: Build the React application
# We use a Node.js base image to compile the React app
FROM node:20-alpine as builder

# Set the working directory inside the container for this stage
WORKDIR /app

# Copy package.json and package-lock.json first
# This allows Docker to cache the npm install step if these files don't change
COPY package.json ./
COPY package-lock.json ./

# Install project dependencies
RUN npm install

# Copy the rest of your application source code into the container
COPY . .

# Build the React application for production
# This command executes the "build" script defined in your package.json
# It will generate optimized static assets in a 'build' folder
RUN npm run build

# Stage 2: Serve the React application with Nginx
# We use a lightweight Nginx base image for serving static files
FROM nginx:alpine

# Copy the compiled React application from the 'builder' stage
# The '/app/build' directory from the first stage contains your static files
# These files are copied to Nginx's default web root directory
COPY --from=builder /app/build /usr/share/nginx/html

# Remove the default Nginx configuration file
RUN rm /etc/nginx/conf.d/default.conf

# Copy your custom Nginx configuration file (which you'll create next)
# This custom config will handle client-side routing for your React app
COPY nginx.conf /etc/nginx/conf.d/

# Expose port 80, which Nginx will be listening on inside the container
EXPOSE 80

# Command to run Nginx when the container starts
# 'daemon off;' keeps Nginx running in the foreground, essential for Docker containers
CMD ["nginx", "-g", "daemon off;"]