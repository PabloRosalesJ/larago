---
title: "Logging estructurado"
description: "Implementa logging estructurado en Go con log/slog, la libreria oficial desde Go 1.21, muy superior a Log::info de Laravel"
order: 11
section: "04-the-basics"
laravel_url: "https://laravel.com/docs/13.x/logging"
go_packages: ["log/slog", "os", "log"]
---

# Logging estructurado

**TL;DR** — Laravel usa `Log::info()` con stack de canales (single, daily, slack, etc.). Go 1.21+ tiene `log/slog`, un logger estructurado nativo con niveles, atributos y handlers personalizables.

---

## En Laravel

```php
// Laravel: logging por canales
Log::info('Usuario registrado', ['id' => $user->id, 'email' => $user->email]);
Log::error('Error al procesar pago', ['order_id' => $order->id]);

// Configuración en config/logging.php
// Canales: stack, single, daily, slack, syslog, etc.
```

## En Go (log/slog)

```go
package main

import (
    "log/slog"
    "os"
)

func main() {
    // Logger por defecto (texto, nivel info)
    slog.Info("Servidor iniciado", "puerto", 8080)

    // Logger JSON (para producción)
    logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelDebug,
    }))
    slog.SetDefault(logger)

    // Diferentes niveles
    slog.Debug("Depurando conexión", "db", "postgres")
    slog.Info("Usuario registrado", "id", 42, "email", "user@go.dev")
    slog.Warn("Alerta de rate limit", "ip", "192.168.1.1")
    slog.Error("Error de base de datos", "err", err, "query", "SELECT ...")

    // Con atributos reutilizables
    logger = logger.With("service", "api", "version", "1.0")
    logger.Info("Request procesada", "method", "GET", "path", "/users")
}
```

### Salida JSON

```json
{"time":"2026-06-27T10:30:00Z","level":"INFO","msg":"Servidor iniciado","puerto":8080}
{"time":"2026-06-27T10:30:01Z","level":"INFO","msg":"Usuario registrado","id":42,"email":"user@go.dev"}
{"time":"2026-06-27T10:30:02Z","level":"ERROR","msg":"Error de base de datos","err":"connection refused","query":"SELECT ..."}
```

### Handler personalizado

```go
// Handler que envía errores a un servicio externo
type ErrorHandler struct {
    next slog.Handler
}

func (h *ErrorHandler) Enabled(ctx context.Context, level slog.Level) bool {
    return h.next.Enabled(ctx, level)
}

func (h *ErrorHandler) Handle(ctx context.Context, r slog.Record) error {
    if r.Level >= slog.LevelError {
        go sendToSentry(r) // Enviar a Sentry en background
    }
    return h.next.Handle(ctx, r)
}

func (h *ErrorHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
    return &ErrorHandler{next: h.next.WithAttrs(attrs)}
}

func (h *ErrorHandler) WithGroup(name string) slog.Handler {
    return &ErrorHandler{next: h.next.WithGroup(name)}
}
```

### Logger en handlers

```go
// Pasar logger como dependencia
type UserHandler struct {
    log *slog.Logger
    svc *UserService
}

func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
    h.log.Info("Creando usuario", "ip", r.RemoteAddr)

    err := h.svc.CreateUser(input)
    if err != nil {
        h.log.Error("Error creando usuario", "err", err)
        http.Error(w, "Error interno", 500)
        return
    }

    h.log.Info("Usuario creado exitosamente")
    writeJSON(w, http.StatusCreated, result)
}
```

### Logger con contexto de request

```go
// Incluir request ID en cada log
func RequestIDMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        reqID := r.Header.Get("X-Request-ID")
        if reqID == "" {
            reqID = generateID()
        }

        // Crear logger con request ID
        log := slog.Default().With("request_id", reqID)
        ctx := context.WithValue(r.Context(), "log", log)

        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// En el handler:
func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
    log := r.Context().Value("log").(*slog.Logger)
    log.Info("Listando usuarios")
}
```

### Logging del servidor HTTP

```go
srv := &http.Server{
    Addr:    ":8080",
    Handler: handler,
    ErrorLog: slog.NewLogLogger(slog.Default().Handler(), slog.LevelError),
}
```

## Comparativa: Logging

| Aspecto | Laravel | Go (log/slog) |
|---------|---------|---------------|
| **Niveles** | emergency, alert, critical, error, warning, notice, info, debug | Debug, Info, Warn, Error |
| **Formato** | Texto (por defecto) | Texto o JSON |
| **Canales** | stack, single, daily, slack, syslog... | Handler personalizable (archivo, JSON, HTTP) |
| **Contexto** | Array contextual | Atributos tipados |
| **Múltiples destinos** | Stack de canales | Handler wrapping (múltiples handlers) |
| **Logger por request** | `Log::withContext([...])` | `slog.With("req_id", id)` |
| **Formato fechas** | Configurable | RFC3339 por defecto |
| **Rendimiento** | Bueno | Excelente (diseñado para alto rendimiento) |

## Errores comunes

1. **Usar `log.Println` en lugar de `slog`** — `log.Println` es plano, sin niveles ni estructura. Usa `slog` incluso en proyectos pequeños.
2. **Pasar errores como string** — En lugar de `slog.Info("error: " + err.Error())`, usa `slog.Error("mensaje", "err", err)`.
3. **No usar atributos** — En lugar de `slog.Info(fmt.Sprintf("user %d logged in", id))`, usa `slog.Info("user logged in", "id", id)`. Los atributos se estructuran para búsqueda posterior.
4. **Loggear en producción sin formato JSON** — El formato JSON es parseable por herramientas como Loki, Datadog, CloudWatch.

## Buenas prácticas

- Siempre usa `slog` (no `log`) en proyectos nuevos.
- En producción, usa JSON handler para integración con sistemas de log.
- Incluye un `request_id` en cada log para tracking de requests.
- Define niveles apropiadamente: Debug para desarrollo, Info para operación normal, Warn para condiciones anómalas, Error para fallos.
- Loggea errores con el error como atributo, no como string concatenado.

## Ejercicio sugerido

> Configura un logger JSON con nivel Info por defecto. Crea un middleware que agregue `request_id` a cada log. En un handler, loggea tres eventos: "request iniciada" (Debug), "usuario encontrado" (Info), y si falla algo, "error al buscar usuario" (Error). Observa la salida JSON estructurada.

## Siguientes pasos

- [Auth desde cero](/security/auth-desde-cero/)
