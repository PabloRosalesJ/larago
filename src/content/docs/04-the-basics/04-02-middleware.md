---
title: "Middleware pattern"
description: "Implementa middleware HTTP en Go usando el patron http.Handler wrapper, sin clases ni decoradores"
order: 2
section: "04-the-basics"
laravel_url: "https://laravel.com/docs/13.x/middleware"
go_packages: ["net/http", "log", "time"]
---

# Middleware pattern

**TL;DR** — En Laravel los middleware son clases que se ejecutan en un pipeline. En Go son funciones que envuelven un `http.Handler` y devuelven otro `http.Handler`.

---

## En Laravel

```php
// Laravel: middleware como clase
class LogMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        Log::info('Request: ' . $request->url());
        return $next($request);
    }
}

// Registro en Kernel
protected $middleware = [LogMiddleware::class];
```

## En Go

En Go, un middleware es una **función que recibe un Handler y devuelve un Handler**:

```go
package main

import (
    "log"
    "net/http"
    "time"
)

// Definición: Middleware recibe http.Handler, devuelve http.Handler
type Middleware func(http.Handler) http.Handler

// Middleware concreto: logging
func LoggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        log.Printf("→ %s %s", r.Method, r.URL.Path)

        next.ServeHTTP(w, r) // Pasa al siguiente handler

        log.Printf("← %s %s (%v)", r.Method, r.URL.Path, time.Since(start))
    })
}

// Middleware: autenticación
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("Authorization")
        if token == "" || !isValidToken(token) {
            http.Error(w, "No autorizado", http.StatusUnauthorized)
            return
        }
        next.ServeHTTP(w, r)
    })
}

// Uso: wrapping manual
func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /public", publicHandler)
    mux.HandleFunc("GET /private", privateHandler)

    // Envuelve el mux completo con middleware
    handler := LoggingMiddleware(mux)
    handler = AuthMiddleware(handler) // Solo rutas /private?

    log.Fatal(http.ListenAndServe(":8080", handler))
}
```

### Encadenar middlewares

```go
// Composición manual
handler := Middleware1(Middleware2(Middleware3(mux)))

// Helper para componer
func Chain(handler http.Handler, middlewares ...Middleware) http.Handler {
    for i := len(middlewares) - 1; i >= 0; i-- {
        handler = middlewares[i](handler)
    }
    return handler
}

// Uso
handler := Chain(mux, LoggingMiddleware, RecoveryMiddleware, CORSMiddleware)
```

### Middleware selectivo (como en Laravel)

```go
// Aplica middleware SOLO a ciertas rutas
func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /public", publicHandler)

    // Grupo admin con middleware de auth
    admin := http.NewServeMux()
    admin.HandleFunc("GET /dashboard", adminDashboard)
    mux.Handle("/admin/", http.StripPrefix("/admin", AuthMiddleware(admin)))
}
```

### Middleware con contexto

```go
// Inyectar datos en el contexto del request
type contextKey string
const userKey contextKey = "user"

func AuthContextMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        user := extractUserFromToken(r)
        ctx := context.WithValue(r.Context(), userKey, user)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// En el handler:
func dashboard(w http.ResponseWriter, r *http.Request) {
    user := r.Context().Value(userKey).(User)
    // ...
}
```

## Comparativa: Middleware

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Definición** | Clase con método `handle()` | Función `func(http.Handler) http.Handler` |
| **Pipeline** | Array en Kernel, ordenado por prioridad | Composición manual (Chain helper) |
| **Selectivo** | Asignación en `routes/web.php` | Submux con wrapping |
| **Parámetros** | `$middleware->handle($request, $next)` | `next.ServeHTTP(w, r)` |
| **Contexto** | Compartido en `$request` | `r.Context()` con valores |
| **Antes/después** | Código antes y después de `$next()` | Código antes y después de `next.ServeHTTP()` |
| **Terminable** | Método `terminate()` | No hay equivalente (usa defer) |

## Errores comunes

1. **Olvidar llamar `next.ServeHTTP(w, r)`** — Si no llamas al siguiente handler, la cadena se rompe. El middleware debe decidir si continúa o no.
2. **Modificar `w` o `r` después de llamar a `next`** — El siguiente handler ya pudo haber escrito la respuesta. Setup antes, teardown después.
3. **Confundir orden de wrapping** — `Logger(Auth(handler))` ejecuta Logger primero, Auth después. El orden importa.

## Buenas prácticas

- Cada middleware hace una sola cosa (logging, auth, CORS, recovery).
- Para compartir datos entre middleware y handler, usa `r.Context()` con claves tipadas.
- Para recovery de panics, pon el middleware Recovery al inicio de la cadena.
- Los middleware no deben depender del handler que envuelven.

## Ejercicio sugerido

> Crea tres middleware: `Logging`, `Auth` (que verifica header `X-API-Key`), y `Recovery` (que captura panics). Compónlos con `Chain`. Crea una ruta pública y otra privada. Verifica que la privada requiere API key.

## Siguientes pasos

- [CSRF desde cero](/the-basics/csrf/)
