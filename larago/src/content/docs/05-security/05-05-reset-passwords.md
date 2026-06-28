---
title: "Reset passwords"
description: "Implementa recuperacion de contrasenas en Go con tokens seguros y envio de email via net/smtp"
order: 5
section: "05-security"
laravel_url: "https://laravel.com/docs/13.x/passwords"
go_packages: ["crypto/rand", "net/smtp", "database/sql", "time"]
---

# Reset passwords

**TL;DR** — Laravel tiene `php artisan make:auth` con reset de contraseñas incluido y notificaciones por email. En Go implementas el flujo completo manualmente: token seguro en DB, email de reset, formulario de cambio.

---

## En Laravel

```php
// Laravel: reset de contraseñas automático
Mail::to($user)->send(new ResetPasswordLink);
// O usando Notifications:
$user->notify(new ResetPasswordNotification);
```

## En Go

### 1. Generar token de reset

```go
package passwordreset

import (
    "crypto/rand"
    "crypto/sha256"
    "database/sql"
    "encoding/base64"
    "encoding/hex"
    "net/http"
    "net/smtp"
    "time"
)

type ResetHandler struct {
    db          *sql.DB
    smtpHost    string
    smtpUser    string
    smtpPass    string
    frontendURL string
}

// GenerateToken crea un token seguro de 32 bytes
func GenerateToken() (string, error) {
    b := make([]byte, 32)
    _, err := rand.Read(b)
    if err != nil {
        return "", err
    }
    return base64.RawURLEncoding.EncodeToString(b), nil
}
```

### 2. Solicitar reset (envía email)

```go
func (h *ResetHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
    var input struct {
        Email string `json:"email"`
    }
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, "JSON inválido", 400)
        return
    }

    // Generar token
    token, err := GenerateToken()
    if err != nil {
        http.Error(w, "Error interno", 500)
        return
    }

    // Hash del token para almacenar (no almacenamos el token plano)
    tokenHash := sha256.Sum256([]byte(token))

    // Guardar en DB con expiración
    _, err = h.db.Exec(
        `INSERT INTO password_resets (email, token_hash, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE
         SET token_hash = $2, expires_at = $3`,
        input.Email,
        hex.EncodeToString(tokenHash[:]),
        time.Now().Add(1*time.Hour),
    )
    if err != nil {
        // No revelar si el email existe o no
        writeJSON(w, 200, map[string]string{
            "message": "Si el email existe, recibirás un enlace de recuperación",
        })
        return
    }

    // Enviar email (si el usuario existe)
    h.sendResetEmail(input.Email, token)

    writeJSON(w, 200, map[string]string{
        "message": "Si el email existe, recibirás un enlace de recuperación",
    })
}
```

### 3. Enviar email con net/smtp

```go
func (h *ResetHandler) sendResetEmail(email, token string) {
    resetLink := h.frontendURL + "/reset-password?token=" + token + "&email=" + email

    subject := "Subject: Recuperación de contraseña\n"
    mime := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"
    body := fmt.Sprintf(`<h1>Recupera tu contraseña</h1>
        <p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
        <a href="%s">Restablecer contraseña</a>
        <p>Este enlace expira en 1 hora.</p>`, resetLink)
    msg := []byte(subject + mime + body)

    auth := smtp.PlainAuth("", h.smtpUser, h.smtpPass, h.smtpHost)
    smtp.SendMail(h.smtpHost+":587", auth, h.smtpUser, []string{email}, msg)
}
```

### 4. Resetear contraseña

```go
func (h *ResetHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
    var input struct {
        Email       string `json:"email"`
        Token       string `json:"token"`
        Password    string `json:"password"`
    }
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, "JSON inválido", 400)
        return
    }

    // Hash del token recibido
    tokenHash := sha256.Sum256([]byte(input.Token))

    // Buscar en DB
    var expiresAt time.Time
    err := h.db.QueryRow(
        `SELECT expires_at FROM password_resets
         WHERE email = $1 AND token_hash = $2 AND expires_at > NOW()`,
        input.Email, hex.EncodeToString(tokenHash[:]),
    ).Scan(&expiresAt)

    if err != nil {
        http.Error(w, "Token inválido o expirado", 400)
        return
    }

    // Hashear nueva contraseña
    hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), 12)
    if err != nil {
        http.Error(w, "Error interno", 500)
        return
    }

    // Actualizar contraseña
    _, err = h.db.Exec("UPDATE users SET password_hash = $1 WHERE email = $2",
        string(hash), input.Email)
    if err != nil {
        http.Error(w, "Error al actualizar contraseña", 500)
        return
    }

    // Eliminar token usado
    h.db.Exec("DELETE FROM password_resets WHERE email = $1", input.Email)

    writeJSON(w, 200, map[string]string{"message": "Contraseña actualizada exitosamente"})
}
```

### Esquema SQL

```sql
CREATE TABLE password_resets (
    email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (email)
);
```

## Comparativa: Reset passwords

| Paso | Laravel | Go |
|------|---------|-----|
| **Token** | Automático, almacenado en DB | `crypto/rand` + hash SHA256 |
| **Email** | `Mail::send()` o Notification | `net/smtp.SendMail()` |
| **Vista/Form** | Blade incluido | Tú renderizas el formulario |
| **Expiración** | Configurable (default 60 min) | Tú controlas en la inserción |
| **Notificación** | Notificación por defecto | Email manual o librería de emails |
| **Seguridad** | Token hasheado en DB | Token hasheado (SHA256) en DB |

## Errores comunes

1. **No hashear el token en DB** — Nunca almacenes el token plano en DB. Almacena `SHA256(token)`. Si alguien accede a la DB, no puede usar los tokens.
2. **Revelar si el email existe** — Siempre responde con el mismo mensaje ("Si el email existe...") tanto si existe como si no.
3. **Token sin expiración** — Los tokens deben expirar (1 hora es estándar).
4. **No invalidar token después de usarlo** — Después de resetear la contraseña, elimina el token para que no pueda reutilizarse.

## Buenas prácticas

- Hashea el token con SHA256 antes de guardarlo en DB (token es efímero, SHA256 es suficiente).
- Expira los tokens después de 1 hora.
- El email de reset debe ser HTML con un enlace clickeable.
- Después del reset exitoso, invalida todos los tokens de ese usuario.
- Rate limiting: máximo 3 solicitudes de reset por hora por email.

## Ejercicio sugerido

> Implementa los endpoints POST /forgot-password (recibe email, envía enlace de reset) y POST /reset-password (recibe token + nueva contraseña, la actualiza). El token se almacena hasheado en DB con expiración de 1 hora.

## Siguientes pasos

- [Conectando a DB](/database/conectando-a-db/)
