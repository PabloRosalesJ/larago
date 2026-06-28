---
title: "Testing HTTP con httptest"
description: "Prueba handlers HTTP en Go con httptest.NewRecorder y httptest.NewServer"
order: 2
section: "11-testing"
laravel_url: "https://laravel.com/docs/13.x/http-tests"
go_packages: ["net/http/httptest", "net/http", "testing"]
---

# Testing HTTP con httptest

**TL;DR** — Laravel tiene `$this->get('/users')->assertStatus(200)`. Go tiene `net/http/httptest`: graba responses con `NewRecorder` o levanta servidores temporales con `NewServer`.

---

## En Laravel

```php
class UserTest extends TestCase
{
    public function test_list_users(): void
    {
        $response = $this->get('/api/users');
        $response->assertStatus(200);
        $response->assertJsonCount(3);
        $response->assertJsonStructure([['id', 'name', 'email']]);
    }
}
```

## En Go

El paquete `net/http/httptest` ofrece dos modos:

### 1. `httptest.NewRecorder` (test unitario del handler)

Ideal para probar un handler directamente sin levantar un servidor.

```go
package main

import (
    "net/http"
    "net/http/httptest"
    "testing"
)

func TestListUsersHandler(t *testing.T) {
    req := httptest.NewRequest("GET", "/api/users", nil)
    rec := httptest.NewRecorder()

    // Llamas al handler directamente
    listUsersHandler(rec, req)

    resp := rec.Result()
    if resp.StatusCode != http.StatusOK {
        t.Errorf("status = %d, want %d", resp.StatusCode, http.StatusOK)
    }
}
```

### 2. `httptest.NewServer` (test de integración)

Levanta un servidor HTTP real en un puerto efímero.

```go
func TestListUsersIntegration(t *testing.T) {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /api/users", listUsersHandler)

    server := httptest.NewServer(mux)
    defer server.Close()

    resp, err := http.Get(server.URL + "/api/users")
    if err != nil {
        t.Fatal(err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != 200 {
        t.Errorf("status = %d, want 200", resp.StatusCode)
    }
}
```

### Probando múltiples métodos

```go
func TestUserEndpoints(t *testing.T) {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /api/users", listUsersHandler)
    mux.HandleFunc("POST /api/users", createUserHandler)
    mux.HandleFunc("GET /api/users/{id}", showUserHandler)

    server := httptest.NewServer(mux)
    defer server.Close()

    t.Run("GET /api/users", func(t *testing.T) {
        resp, _ := http.Get(server.URL + "/api/users")
        if resp.StatusCode != 200 {
            t.Error("expected 200")
        }
    })

    t.Run("POST /api/users", func(t *testing.T) {
        body := strings.NewReader(`{"name":"Alice"}`)
        resp, _ := http.Post(server.URL+"/api/users", "application/json", body)
        if resp.StatusCode != 201 {
            t.Error("expected 201")
        }
    })
}
```

### Verificando el body de respuesta

```go
func TestListUsersBody(t *testing.T) {
    req := httptest.NewRequest("GET", "/api/users", nil)
    rec := httptest.NewRecorder()

    listUsersHandler(rec, req)

    // Leer body
    body, _ := io.ReadAll(rec.Result().Body)
    var users []User
    json.Unmarshal(body, &users)

    if len(users) != 3 {
        t.Errorf("got %d users, want 3", len(users))
    }
}
```

### Test con middleware

```go
func authMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.Header.Get("Authorization") == "" {
            http.Error(w, "unauthorized", http.StatusUnauthorized)
            return
        }
        next.ServeHTTP(w, r)
    })
}

func TestAuthMiddleware(t *testing.T) {
    handler := authMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    }))

    t.Run("sin token", func(t *testing.T) {
        req := httptest.NewRequest("GET", "/", nil)
        rec := httptest.NewRecorder()
        handler.ServeHTTP(rec, req)
        if rec.Result().StatusCode != 401 {
            t.Error("expected 401")
        }
    })

    t.Run("con token", func(t *testing.T) {
        req := httptest.NewRequest("GET", "/", nil)
        req.Header.Set("Authorization", "Bearer token123")
        rec := httptest.NewRecorder()
        handler.ServeHTTP(rec, req)
        if rec.Result().StatusCode != 200 {
            t.Error("expected 200")
        }
    })
}
```

## Comparativa: HTTP Tests

| Concepto | Laravel | Go (httptest) |
|----------|---------|---------------|
| **GET request** | `$this->get('/url')` | `httptest.NewRequest("GET", "/url", nil)` |
| **POST con body** | `$this->post('/url', [...])` | `httptest.NewRequest("POST", "/url", body)` |
| **Assert status** | `->assertStatus(200)` | `if got != want { t.Error(...) }` |
| **Assert JSON** | `->assertJson([...])` | `json.Unmarshal` + aserciones manuales |
| **Con headers** | `->withHeaders([...])` | `req.Header.Set("Key", "val")` |
| **Test completo** | `$this->get(...)` y Laravel levanta la app | `httptest.NewServer(mux)` |
| **Solo handler** | No hay equivalente directo | `httptest.NewRecorder()` |
| **Middleware** | Aislado o en ruta | Llama al handler envuelto |

## Errores comunes al migrar

1. **No cerrar el body de la respuesta** — Siempre llama `resp.Body.Close()` (o usa `defer`). Si no, fugas de conexiones.
2. **Comparar HTTP 200 con `== 200` en lugar de constantes** — Usa `http.StatusOK`, `http.StatusNotFound`, etc. Código más legible.
3. **Olvidar `server.Close()`** — Usa `defer server.Close()` justo después de crear el server.

## Buenas prácticas

- Usa `httptest.NewRecorder` para tests unitarios (rápidos, sin red).
- Usa `httptest.NewServer` para tests de integración (incluye serialización HTTP real).
- Construye helpers de aserción para evitar repetir `if got != want` en cada test.
- Ejecuta tests HTTP con `-race` para detectar condiciones de carrera.

## Ejercicio sugerido

> Escribe un handler `GET /greet?name=Alice` que responda `{"message": "Hello, Alice!"}`. Prueba: status 200, JSON correcto, y caso sin parámetro `name`.

## Siguientes pasos

- [Testing con base de datos](/testing/testing-con-db/)
- [Mocks](/testing/mocks/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
