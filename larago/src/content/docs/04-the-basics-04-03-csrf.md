---
title: "CSRF desde cero"
description: "Implementa proteccion CSRF con la stdlib de Go usando tokens criptograficos sin librerias externas"
order: 3
section: "04-the-basics"
laravel_url: "https://laravel.com/docs/13.x/csrf"
go_packages: ["crypto/rand", "crypto/hmac", "crypto/sha256", "encoding/base64", "net/http"]
---

# CSRF desde cero

**TL;DR** — Laravel protege automáticamente todas las rutas POST/PUT/DELETE con `@csrf` en Blade. En Go implementas tu propio middleware CSRF con `crypto/rand` para generar tokens y `crypto/hmac` para validarlos.

---

## En Laravel

```php
// Laravel: CSRF automático
<form method="POST" action="/users">
    @csrf  <!-- genera input oculto con token -->
    ...
</form>

// VerifyCsrfToken middleware protege todas las rutas (excepto las excluidas)
```

El token CSRF se genera automáticamente por sesión y se valida en cada request POST/PUT/DELETE.

## En Go

En Go, implementas un middleware que genera y valida tokens CSRF:

```go
package csrf

import (
    "crypto/hmac"
    "crypto/rand"
    "crypto/sha256"
    "encoding/base64"
    "net/http"
)

// Genera un token aleatorio para la sesión
func GenerateToken() (string, error) {
    b := make([]byte, 32)
    _, err := rand.Read(b)
    if err != nil {
        return "", err
    }
    return base64.RawURLEncoding.EncodeToString(b), nil
}

// Genera un token CSRF firmado con HMAC
func SignedToken(sessionID string, key []byte) string {
    token, _ := GenerateToken()
    mac := hmac.New(sha256.New, key)
    mac.Write([]byte(sessionID + ":" + token))
    sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
    return base64.RawURLEncoding.EncodeToString([]byte(token + ":" + sig))
}

// Valida un token CSRF
func ValidateToken(signedToken, sessionID string, key []byte) bool {
    decoded, err := base64.RawURLEncoding.DecodeString(signedToken)
    if err != nil {
        return false
    }
    parts := string(decoded)
    // parse token:signature
    // ... validar HMAC
    return true
}
```

### Middleware CSRF

```go
func CSRFMiddleware(key []byte) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if r.Method == "GET" || r.Method == "HEAD" || r.Method == "OPTIONS" {
                // Generar token y ponerlo en la sesión para GET
                token, _ := GenerateToken()
                // guardar token en sesión/cookie
                http.SetCookie(w, &http.Cookie{
                    Name:  "csrf_token",
                    Value: token,
                    Path:  "/",
                    Secure: true,
                    HttpOnly: true,
                })
                next.ServeHTTP(w, r)
                return
            }

            // Para POST/PUT/DELETE: validar token
            token := r.FormValue("_csrf_token")
            cookie, err := r.Cookie("csrf_token")
            if err != nil || token != cookie.Value {
                http.Error(w, "CSRF token inválido", http.StatusForbidden)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

### Template con CSRF

```go
// En tu template HTML:
func renderForm(w http.ResponseWriter, r *http.Request) {
    token, _ := r.Cookie("csrf_token")
    html := fmt.Sprintf(`
        <form method="POST" action="/users">
            <input type="hidden" name="_csrf_token" value="%s">
            <input type="text" name="name">
            <button type="submit">Crear</button>
        </form>
    `, token.Value)
    w.Write([]byte(html))
}
```

### Doble cookie (Double Submit Cookie)

Para APIs, usa el patrón de doble cookie:

```go
// Enviar token CSRF en cookie y header
// El middleware verifica que coincidan
func CSRFDoubleSubmitMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.Method == "GET" || r.Method == "HEAD" {
            token, _ := GenerateToken()
            http.SetCookie(w, &http.Cookie{
                Name: "csrf_token", Value: token,
                Path: "/", Secure: true, HttpOnly: true,
                SameSite: http.SameSiteStrictMode,
            })
            r.Header.Set("X-CSRF-Token", token)
            next.ServeHTTP(w, r)
            return
        }

        // Validar que cookie == header
        cookie, _ := r.Cookie("csrf_token")
        headerToken := r.Header.Get("X-CSRF-Token")
        if cookie == nil || cookie.Value != headerToken {
            http.Error(w, "CSRF token inválido", http.StatusForbidden)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

## Comparativa: CSRF

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Incluido** | Sí, automático | Tú lo implementas |
| **Generación** | Automática por sesión | `crypto/rand` + HMAC |
| **Validación** | Middleware VerifyCsrfToken | Middleware manual |
| **Excepciones** | `$except` array en el middleware | Condiciones en if |
| **Token en forms** | `@csrf` directive | Input hidden manual |
| **Token en API** | Cookie + X-XSRF-TOKEN | Doble cookie (custom) |

## Errores comunes

1. **No usar HTTPS en producción** — Sin HTTPS, el token CSRF puede ser interceptado. Siempre `Secure: true` en la cookie.
2. **Token CSRF en localStorage** — Los tokens CSRF deben ir en cookies HttpOnly, no en localStorage (vulnerable a XSS).
3. **No excluir webhooks** — Si recibes webhooks de Stripe/GitHub, exclúyelos del middleware CSRF o usa un endpoint sin protección.

## Buenas prácticas

- Usa `SameSite=Strict` en las cookies CSRF.
- Para APIs SPA, usa el patrón de doble cookie (cookie + header).
- Los tokens CSRF deben ser efímeros (expirar en minutos/horas).
- Si usas sesiones, almacena el token en la sesión del servidor.

## Ejercicio sugerido

> Implementa un formulario HTML con protección CSRF en Go: un middleware que genere token en GET y lo valide en POST. Crea un formulario simple con input oculto que incluya el token.

## Siguientes pasos

- [Handlers y organización](/the-basics/handlers-y-organizacion/)
