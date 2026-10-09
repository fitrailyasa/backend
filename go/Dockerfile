FROM golang:1.23-bookworm AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server

FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /out/server /app/server
COPY openapi.json /app/openapi.json

ENV APP_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8090
ENV DB_SYNC=false

EXPOSE 8090

CMD ["/app/server"]
