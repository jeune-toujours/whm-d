FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ARG VITE_DEMO_MODE=false
ARG SOURCE_COMMIT=local
ARG VITE_RELEASE_SHA=$SOURCE_COMMIT
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE
ENV VITE_RELEASE_SHA=$VITE_RELEASE_SHA
RUN npm run build
RUN node -e "require('fs').writeFileSync('dist/release.json', JSON.stringify({service: 'whm-client', release: process.env.VITE_RELEASE_SHA}))"

FROM nginx:alpine
COPY infra/coolify/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
