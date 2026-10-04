FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN WHM_BUILD=1 npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache curl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ARG SOURCE_COMMIT=local
ENV RELEASE_SHA=$SOURCE_COMMIT
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Payload CLI and source are needed for schema migrations at deployment.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/start.sh ./start.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s CMD curl --fail --silent http://127.0.0.1:3000/api/ready > /dev/null || exit 1
CMD ["sh", "start.sh"]
