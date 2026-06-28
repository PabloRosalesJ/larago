---
title: "Ciclo de vida de una request"
description: "Entiende como Go procesa una peticion HTTP desde que llega al puerto hasta que se envia la respuesta"
order: 1
section: "03-architecture"
laravel_url: "https://laravel.com/docs/13.x/lifecycle"
go_packages: ["net/http", "log", "context"]
---

# Ciclo de vida de una request

**TL;DR** — En Laravel la request pasa por un pipeline mágico (middleware → controller → response). En Go el ciclo es explícito: el `http.Server` recibe la conexión, llama al handler registrado, y tú controlas cada paso.

---

## En Laravel

```
Request → public/index.php → Kernel → Middleware → Controller → Response
```

Laravel tiene un ciclo de vida fijo que no puedes modificar: carga el autoloader, inicia la app, lee config, enruta la request, pasa por el stack de middleware, ejecuta el controller, devuelve la response.

## En Go

En Go, el ciclo de vida es un bucle simple en el `http.Server`:

```go
package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"
)

func main() {
    mux := http.NewServeMux()

    mux.HandleFunc("GET /hello", func(w http.ResponseWriter, r *http.Request) {
        // 1. r es la request entrante
        // 2. Tú procesas la lógica
        // 3. Escribes en w la respuesta
        w.Write([]byte("Hola, mundo"))
    })

    // Server con control explícito
    srv := &http.Server{
        Addr:    ":8080",
        Handler: mux,
    }

    // Graceful shutdown
    go func() {
        sigCh := make(chan os.Signal, 1)
        signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
        <-sigCh

        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()
        srv.Shutdown(ctx)
    }()

    log.Fatal(srv.ListenAndServe())
}
```

### El flujo explícito

```go
// Cada handler recibe el control COMPLETO del request y response
func miHandler(w http.ResponseWriter, r *http.Request) {
    // 1. Parsear la request
    ctx := r.Context()           // context.Context del request
    method := r.Method            // GET, POST, etc.
    path := r.URL.Path            // /hello
    query := r.URL.Query()        // ?name=Juan

    // 2. Validar / autenticar (tú decides)
    if !isAuthenticated(r) {
        http.Error(w, "No autorizado", http.StatusUnauthorized)
        return
    }

    // 3. Procesar (tú decides el orden)
    result, err := process(ctx, query)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    // 4. Escribir la respuesta (tú decides el formato)
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    w.Write(result)
}
```

### Middleware como wrapping explícito

```go
// En Go, el middleware envuelve handlers, no es un pipeline mágico
func loggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        log.Printf("→ %s %s", r.Method, r.URL.Path)

        next.ServeHTTP(w, r) // Llama al siguiente handler

        log.Printf("← %s %s (%v)", r.Method, r.URL.Path, time.Since(start))
    })
}

// Uso: envuelves el mux con middleware
srv.Handler = loggingMiddleware(mux)
```

## Comparativa: Ciclo de vida

| Fase | Laravel | Go |
|------|---------|-----|
| **Entry point** | `public/index.php` (fijo) | `main()` (tú lo escribes) |
| **Autoload** | Composer autoload (automático) | `go mod` + imports explícitos |
| **Config** | `config/*.php` + `.env` (carga automática) | Struct Config (carga explícita en main) |
| **Routing** | Route ServiceProvider (automático) | `mux.HandleFunc("METHOD /path", fn)` |
| **Middleware** | Pipeline fijo (global, grupos, rutas) | Wrapping de handlers (http.Handler) |
| **Controller** | Clase que extiende Controller | Función o método de struct |
| **Response** | `return response()->json(...)` | `w.Write(...)`, `json.NewEncoder(w)` |
| **Shutdown** | Apache/PHP-FPM maneja pooling | `signal.Notify` + `srv.Shutdown()` |

## Errores comunes

1. **No cerrar el servidor correctamente** — Sin graceful shutdown, las conexiones activas se pierden al matar el proceso. Implementa `signal.Notify` + `Shutdown`.
2. **No usar `r.Context()`** — Cuando lanzas gorutinas dentro de un handler, debes pasar el `r.Context()` para que se cancelen si el cliente se desconecta.
3. **Escribir la respuesta después de setear el status code** — En Go, primero estableces headers, luego `WriteHeader()`, luego el body. Si escribes el body primero, Go automáticamente escribe 200 OK.

## Buenas prácticas

- Cada request maneja su propio contexto. Usa `r.Context()` para propagar cancelación.
- El ciclo de vida de un handler debe ser rápido. Si necesitas trabajo pesado, lánzalo en una gorutina con el contexto.
- Implementa siempre graceful shutdown en producción.

## Ejercicio sugerido

> Crea un handler que simule trabajo pesado (time.Sleep de 2 segundos). Agrega un middleware que logee el tiempo de cada request. Implementa graceful shutdown con signal.Notify. Verifica que al hacer Ctrl+C, el servidor espera a que termine la request activa.

## Siguientes pasos

- [DI sin contenedor mágico](/architecture/di-sin-contenedor/)
