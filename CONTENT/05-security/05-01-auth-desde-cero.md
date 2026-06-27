---
title: "Auth desde cero"
description: "Implementa autenticacion de usuarios desde cero con la stdlib de Go: registro, login, sesiones y contrasenas hasheadas"
order: 1
section: "05-security"
laravel_url: "https://laravel.com/docs/13.x/authentication"
go_packages: ["crypto/rand", "golang.org/x/crypto/bcrypt", "net/http", "database/sql"]
---

# Auth desde cero

**TL;DR** — Laravel tiene `php artisan make:auth` y guards configurables. En Go implementas registro y login manualmente con bcrypt para contraseñas y sesiones o JWT para estado.

---

## En Laravel

```php
// Laravel: auth completo con guards, providers, y middlewares
Auth::attempt(['email' => $email, 'password' => $password]);
Auth::user();
Auth::logout();

// php artisan make:auth genera todo: login, registro, logout
```

## En Go

### Registro de usuario

```go
package auth

import (
    "database/sql"
    "net/http"
    "golang.org/x/crypto/bcrypt"
)

type User struct {
    ID       int    `json:"id"`
    Email    string `json:"email"`
    Password string `json:"-"` // nunca se serializa a JSON
}

type AuthHandler struct {
    db       *sql.DB
    jwtSecret []byte
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
    var input struct {
        Email    string `json:"email"`
        Password string `json:"password"`
    }
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, "JSON inválido", 400)
        return
    }

    // Hash de la contraseña (coste 12 = ~250ms)
    hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), 12)
    if err != nil {
        http.Error(w, "Error interno", 500)
        return
    }

    // Guardar en DB
    var id int
    err = h.db.QueryRow(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        input.Email, string(hash),
    ).Scan(&id)
    if err != nil {
        http.Error(w, "Email ya registrado", 409)
        return
    }

    writeJSON(w, 201, map[string]any{"id": id, "email": input.Email})
}
```

### Login con contraseña

```go
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
    var input struct {
        Email    string `json:"email"`
        Password string `json:"password"`
    }
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, "JSON inválido", 400)
        return
    }

    // Buscar usuario por email
    var user User
    var hash string
    err := h.db.QueryRow(
        "SELECT id, email, password_hash FROM users WHERE email = $1",
        input.Email,
    ).Scan(&user.ID, &user.Email, &hash)
    if err == sql.ErrNoRows {
        http.Error(w, "Credenciales inválidas", 401)
        return
    }

    // Comparar contraseña con bcrypt
    if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(input.Password)); err != nil {
        http.Error(w, "Credenciales inválidas", 401)
        return
    }

    // Generar token JWT o crear sesión
    token := generateJWT(user.ID, h.jwtSecret)

    writeJSON(w, 200, map[string]string{"token": token})
}
```

### Middleware de autenticación

```go
func (h *AuthHandler) AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := extractToken(r)
        if token == "" {
            http.Error(w, "Token requerido", 401)
            return
        }

        userID, err := validateJWT(token, h.jwtSecret)
        if err != nil {
            http.Error(w, "Token inválido", 401)
            return
        }

        // Pasar userID en el contexto
        ctx := context.WithValue(r.Context(), "user_id", userID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### JWT simple (sin librerías externas)

```go
import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/base64"
    "encoding/json"
    "strings"
    "time"
)

type JWTClaims struct {
    UserID int   `json:"user_id"`
    Exp    int64 `json:"exp"`
}

func generateJWT(userID int, secret []byte) string {
    header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))

    claims := JWTClaims{UserID: userID, Exp: time.Now().Add(24 * time.Hour).Unix()}
    claimsJSON, _ := json.Marshal(claims)
    payload := base64.RawURLEncoding.EncodeToString(claimsJSON)

    // Firmar
    mac := hmac.New(sha256.New, secret)
    mac.Write([]byte(header + "." + payload))
    sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

    return header + "." + payload + "." + sig
}
```

## Comparativa: Auth

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Setup** | `php artisan make:auth` | Manual |
| **Hash** | Bcrypt (configurable) | `golang.org/x/crypto/bcrypt` |
| **Sesión** | Session guard automático | Cookie + store manual |
| **JWT** | Paquete externo (tymon/jwt-auth) | Manual o `golang-jwt/jwt` |
| **Guards** | web, api, custom | Tú defines (cookie, JWT, API key) |
| **Middleware** | `auth:api` | `AuthMiddleware` personalizado |
| **Rate limit login** | `RateLimiter::for('login')` | Middleware manual |
| **Email verify** | `mustVerifyEmail` trait | Manual |

## Errores comunes

1. **No usar bcrypt** — MD5, SHA1, SHA256 no son para contraseñas. Siempre bcrypt, scrypt o argon2.
2. **Hashear del lado del cliente** — El hash debe hacerse del lado del servidor. El cliente envía la contraseña en texto plano por HTTPS.
3. **Token JWT sin expiración** — Siempre pon `exp` en el JWT. Los tokens deben expirar.
4. **Contraseñas en logs** — Nunca loggees la contraseña recibida ni el hash generado.

## Buenas prácticas

- Usa coste 10-12 para bcrypt (balance entre seguridad y velocidad).
- Los JWT deben ser short-lived (15 min a 24 horas) con refresh tokens.
- Siempre HTTPS en producción.
- Las contraseñas deben tener mínimo 8 caracteres con validación de complejidad.
- Implementa rate limiting en el endpoint de login.

## Ejercicio sugerido

> Implementa registro (POST /register con email+password) y login (POST /login que devuelve JWT). Usa bcrypt para el hash. Implementa un middleware que valide el JWT en rutas protegidas (GET /me).

## Siguientes pasos

- [Autorización explícita](/security/autorizacion-explicita/)
