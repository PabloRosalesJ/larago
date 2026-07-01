---
title: "Sessions con cookies"
description: "Maneja sesiones de usuario en Go usando cookies HttpOnly y la stdlib, sin session drivers ni middlewares magicos"
order: 8
section: "04-the-basics"
laravel_url: "https://laravel.com/docs/13.x/session"
go_packages: ["net/http", "crypto/rand", "encoding/hex", "sync"]
---

# Sessions con cookies

**TL;DR** — Laravel tiene un sistema de sesiones completo con múltiples drivers (file, cookie, database, redis) y `session()` helper. En Go implementas sesiones manualmente con cookies + un mapa en memoria, o usas el paquete `gorilla/sessions`.

---

## En Laravel

```php
// Laravel: session automática
session(['user_id' => $user->id]);
$id = session('user_id');
session()->forget('user_id');
```

## En Go

```go
package main

import (
    "crypto/rand"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "net/http"
    "sync"
    "time"
)

// Session store en memoria
type SessionStore struct {
    mu       sync.RWMutex
    sessions map[string]map[string]any
}

func NewSessionStore() *SessionStore {
    return &SessionStore{
        sessions: make(map[string]map[string]any),
    }
}

func (s *SessionStore) Get(sid string) (map[string]any, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    data, ok := s.sessions[sid]
    return data, ok
}

func (s *SessionStore) Set(sid string, data map[string]any) {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.sessions[sid] = data
}

func (s *SessionStore) Delete(sid string) {
    s.mu.Lock()
    defer s.mu.Unlock()
    delete(s.sessions, sid)
}

// Generar ID de sesión seguro
func generateSessionID() string {
    b := make([]byte, 32)
    rand.Read(b)
    return hex.EncodeToString(b)
}

// Middleware de sesión
func SessionMiddleware(store *SessionStore) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            var sid string

            // Leer cookie existente
            cookie, err := r.Cookie("session_id")
            if err != nil || cookie.Value == "" {
                // Crear nueva sesión
                sid = generateSessionID()
                store.Set(sid, make(map[string]any))
                http.SetCookie(w, &http.Cookie{
                    Name:     "session_id",
                    Value:    sid,
                    Path:     "/",
                    HttpOnly: true,
                    Secure:   true,
                    SameSite: http.SameSiteLaxMode,
                    MaxAge:   86400 * 7, // 7 días
                })
            } else {
                sid = cookie.Value
                // Verificar que la sesión existe
                if _, ok := store.Get(sid); !ok {
                    store.Set(sid, make(map[string]any))
                }
            }

            // Pasar sesión en el contexto
            ctx := context.WithValue(r.Context(), "session_id", sid)
            ctx = context.WithValue(ctx, "session_store", store)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

### Uso en handlers

```go
func loginHandler(w http.ResponseWriter, r *http.Request) {
    // ... validar credenciales ...

    sid := r.Context().Value("session_id").(string)
    store := r.Context().Value("session_store").(*SessionStore)

    // Guardar datos en sesión
    data, _ := store.Get(sid)
    data["user_id"] = 42
    data["role"] = "admin"
    store.Set(sid, data)
}

func dashboardHandler(w http.ResponseWriter, r *http.Request) {
    sid := r.Context().Value("session_id").(string)
    store := r.Context().Value("session_store").(*SessionStore)

    data, _ := store.Get(sid)
    userID, _ := data["user_id"].(int)

    if userID == 0 {
        http.Redirect(w, r, "/login", http.StatusFound)
        return
    }

    fmt.Fprintf(w, "Bienvenido usuario %d", userID)
}

func logoutHandler(w http.ResponseWriter, r *http.Request) {
    sid := r.Context().Value("session_id").(string)
    store := r.Context().Value("session_store").(*SessionStore)
    store.Delete(sid)

    http.SetCookie(w, &http.Cookie{
        Name: "session_id", Value: "",
        Path: "/", MaxAge: -1, // Eliminar cookie
    })
    http.Redirect(w, r, "/", http.StatusFound)
}
```

### Sesiones con gorilla/sessions (opcional)

Para no reinventar la rueda, usa `gorilla/sessions`:

```bash
go get github.com/gorilla/sessions
```

```go
import "github.com/gorilla/sessions"

var store = sessions.NewCookieStore([]byte("clave-secreta-32-chars-min"))

func login(w http.ResponseWriter, r *http.Request) {
    session, _ := store.Get(r, "app-session")
    session.Values["user_id"] = 42
    session.Values["role"] = "admin"
    session.Save(r, w)
}

func dashboard(w http.ResponseWriter, r *http.Request) {
    session, _ := store.Get(r, "app-session")
    userID := session.Values["user_id"]
    if userID == nil {
        http.Redirect(w, r, "/login", 302)
        return
    }
    fmt.Fprintf(w, "Usuario: %v", userID)
}
```

## Comparativa: Sessions

| Aspecto | Laravel | Go (stdlib) | Go (gorilla/sessions) |
|---------|---------|-------------|----------------------|
| **Setup** | Automático | Manual | 3 líneas |
| **Store** | Archivo, cookie, DB, Redis | En memoria (sync.Map) | Cookie-based |
| **Driver** | Configurable en config/session.php | Tú implementas | File, Cookie, Redis |
| **Flash data** | `session()->flash('key', val)` | Manual | `session.AddFlash()` |
| **Middleware** | Incluido por defecto | Tú escribes | No requiere |
| **Seguridad** | HttpOnly + Secure por defecto | HttpOnly + Secure manual | HttpOnly + Secure |
| **Expiración** | Configurable | `MaxAge` en cookie | `MaxAge` en cookie |

## Errores comunes

1. **No usar `HttpOnly`** — Sin HttpOnly, JavaScript puede leer la cookie de sesión (XSS).
2. **Guardar datos sensibles en cookies** — Las cookies son visibles para el cliente. Guarda solo el session ID, los datos en el servidor.
3. **No usar `Secure: true`** — Sin Secure, la cookie viaja por HTTP plano.
4. **Olvidar `sync.RWMutex` en store en memoria** — Las sesiones se acceden concurrentemente. Protege el acceso con un mutex.

## Buenas prácticas

- Usa `http.SameSiteLaxMode` para prevenir CSRF en sesiones.
- Siempre `HttpOnly` + `Secure` en cookies de sesión.
- Para producción, usa Redis o DB como session store (no memoria).
- La sesión debe expirar tras un período de inactividad.
- Si usas solo stdlib, crea un paquete `session` reutilizable.

## Ejercicio sugerido

> Implementa login/logout con sesiones: un endpoint POST /login que recibe usuario/contraseña y guarda `user_id` en la sesión; un GET /dashboard que muestra "Bienvenido" si hay sesión activa o redirige a /login; y un POST /logout que destruye la sesión.

## Siguientes pasos

- [Validación sin Validator](/the-basics/validacion/)
