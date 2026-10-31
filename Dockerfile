FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY contracts/package.json contracts/package.json
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
RUN npm run typecheck && npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY contracts/package.json contracts/package.json
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/backend/src ./backend/src
COPY --from=build /app/contracts ./contracts
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/tsconfig.json ./tsconfig.json
RUN mkdir .local && chown -R node:node /app
USER node
EXPOSE 4173
CMD ["npm", "start"]
