# Multi-stage build for the RASAD frontend
# Stage 1: build the static bundle
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Allow build-time injection of the FastAPI backend URL
ARG VITE_RASAD_API_URL=http://localhost:8000/api/v1
ENV VITE_RASAD_API_URL=$VITE_RASAD_API_URL

RUN npm run build

# Stage 2: tiny nginx image to serve the static build
FROM nginx:1.27-alpine

# Drop default config, install ours
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/rasad.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
