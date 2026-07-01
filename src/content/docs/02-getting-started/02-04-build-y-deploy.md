---
title: "Build y deploy"
description: "Compila tu aplicacion Go para produccion y despliegala con un solo binario, sin dependencias externas"
order: 4
section: "02-getting-started"
laravel_url: "https://laravel.com/docs/13.x/deployment"
go_packages: ["net/http", "os/exec", "embed"]
---

# Build + deploy

**TL;DR** — En Laravel despliegas código fuente PHP que necesita PHP+FPM+Nginx en el servidor. En Go compilas un binario estático y lo copias al servidor. No necesitas runtime, no necesitas intérprete, no necesitas dependencias.

---

## En Laravel

```bash
# Laravel: necesitas PHP, Composer, Nginx, Supervisor (para queues)
# Optimización para producción
composer install --optimize-autoloader --no-dev
php artisan config:cache
php artisan route:cache
php artisan view:cache

# En el servidor necesitas:
# - PHP 8.x + extensiones
# - Nginx o Apache
# - Supervisor (para workers)
# - Redis o MySQL
```

Laravel despliega **código fuente** que necesita un intérprete PHP y una docena de extensiones en el servidor.

## En Go

Go compila a un **binario estático**. Una sola línea:

```bash
# Build para el sistema actual
go build -o mi-app ./cmd/server

# Build para Linux desde macOS (cross-compilation)
GOOS=linux GOARCH=amd64 go build -o mi-app ./cmd/server

# El binario pesa ~15MB y no necesita nada más
```

### Contenido del binario

```go
// Todo esto va DENTRO del binario gracias a //go:embed
package main

import (
    "embed"
    "log"
    "net/http"
)

//go:embed templates/*
var templates embed.FS

//go:embed static/*
var staticFiles embed.FS

func main() {
    // El binario contiene templates, archivos estáticos, migraciones SQL
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

### Dockerfile mínimo

```dockerfile
# Multi-stage build
FROM golang:1.24 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server ./cmd/server

# Imagen final: solo el binario (15MB)
FROM scratch
COPY --from=builder /app/server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
```

### Deploy con systemd (servidor Linux directo)

```ini
# /etc/systemd/system/mi-app.service
[Unit]
Description=Mi App Go
After=network.target

[Service]
ExecStart=/opt/mi-app/server
Environment=PORT=8080
Environment=DB_HOST=localhost
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
# Comandos de deploy
scp mi-app servidor:/opt/mi-app/
ssh servidor "sudo systemctl restart mi-app"
```

### Script de deploy simple

```bash
#!/bin/bash
set -e

APP="mi-app"
SERVER="user@1.2.3.4"
REMOTE_PATH="/opt/$APP"

echo "Compilando para Linux..."
GOOS=linux GOARCH=amd64 go build -o "$APP" ./cmd/server

echo "Subiendo binario..."
scp "$APP" "$SERVER:$REMOTE_PATH/$APP.new"

echo "Reiniciando servicio..."
ssh "$SERVER" "mv $REMOTE_PATH/$APP.new $REMOTE_PATH/$APP && sudo systemctl restart $APP"

echo "Deploy completado."
```

## Comparativa: Build y deploy

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Artefacto** | Código fuente PHP | Binario estático único |
| **Runtime requerido** | PHP 8.x + extensiones | Nada (binario auto-contenido) |
| **Servidor web** | Nginx/Apache + PHP-FPM | Incluido (net/http) |
| **Cross-compile** | No aplica (PHP es interpretado) | `GOOS=linux GOARCH=amd64 go build` |
| **Tamaño del deploy** | ~30MB (vendor + código) | ~15MB (binario único) |
| **Dependencias del SO** | php, php-fpm, nginx, supervisor | Cero (binario estático con CGO_ENABLED=0) |
| **Tiempo de build** | Segundos (solo copia archivos) | Segundos a minutos (compila) |
| **Rollback** | Git pull + posible migración | Copiar binario anterior |
| **Contenedor** | Imagen ~200MB (PHP base) | Imagen ~5MB (scratch) |

## Errores comunes

1. **No compilar para el SO/arquitectura correcta** — Siempre especifica `GOOS` y `GOARCH` cuando compiles para producción.
2. **Depender de CGO** — `CGO_ENABLED=0` produce binarios verdaderamente estáticos que funcionan en cualquier Linux sin glibc.
3. **Olvidar el `embed` para archivos estáticos** — Si tu app sirve HTML/JS/CSS, asegúrate de embeberlos en el binario con `//go:embed`.
4. **Configurar un proxy reverso innecesariamente** — `net/http` puede servir directo en producción. Solo necesitas Nginx si quieres SSL termination, rate limiting avanzado o servir múltiples apps.

## Buenas prácticas

- Usa multi-stage Docker builds para minimizar el tamaño de la imagen final.
- Versiona tus binarios: `go build -ldflags="-X main.version=$(git describe --tags)"`.
- En producción, ejecuta el binario como un servicio (systemd, supervisord, o container).
- Para cero downtime, usa un reverse proxy (Nginx, Caddy) y haz blue-green deployment.

## Ejercicio sugerido

> Compila tu servidor HTTP para Linux desde macOS, súbelo a una VM o contenedor Docker, y haz que responda en el puerto 8080. Luego mide el tamaño del binario.

## Siguientes pasos

- [Ciclo de vida de una request](/architecture/ciclo-de-vida-request/)
