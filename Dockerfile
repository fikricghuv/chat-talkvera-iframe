# ==== STAGE 1: Build the app ====
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files & install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build for production
RUN npm run build


# ==== STAGE 2: Serve with Nginx ====
FROM nginx:stable-alpine

# Hapus default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy hasil build dari stage sebelumnya
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config yang baru
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Jalankan nginx
CMD ["nginx", "-g", "daemon off;"]