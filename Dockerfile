# syntax=docker/dockerfile:1

FROM node:22-alpine AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.26-alpine AS backend
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=frontend /src/dist/ ./internal/web/dist/
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/portal-backend .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates && \
    addgroup -S portal && adduser -S portal -G portal
COPY --from=backend /out/portal-backend /usr/local/bin/portal-backend
USER portal
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/portal-backend"]
