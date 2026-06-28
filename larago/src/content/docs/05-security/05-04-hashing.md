---
title: "Hashing de contraseñas"
description: "Hashea y verifica contrasenas en Go con bcrypt usando golang.org/x/crypto/bcrypt"
order: 4
section: "05-security"
laravel_url: "https://laravel.com/docs/13.x/hashing"
go_packages: ["golang.org/x/crypto/bcrypt"]
---

# Hashing de contraseñas

**TL;DR** — Laravel hashea con `Hash::make()` usando bcrypt. En Go usas `bcrypt.GenerateFromPassword()` del paquete `golang.org/x/crypto/bcrypt`.

---

## En Laravel

```php
// Laravel: hashing automático
$hash = Hash::make('contraseña');          // Hashear
Hash::check('contraseña', $hash);          // Verificar
Hash::needsRehash($hash);                  // ¿Necesita rehash?
```

## En Go

```go
package main

import (
    "fmt"
    "golang.org/x/crypto/bcrypt"
)

const bcryptCost = 12 // ~250ms por hash

// HashPassword genera un hash bcrypt de la contraseña
func HashPassword(password string) (string, error) {
    bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
    return string(bytes), err
}

// CheckPassword verifica una contraseña contra su hash
func CheckPassword(password, hash string) bool {
    err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
    return err == nil
}

func main() {
    hash, _ := HashPassword("mi-contraseña-segura")
    fmt.Println("Hash:", hash)

    ok := CheckPassword("mi-contraseña-segura", hash)
    fmt.Println("Válida:", ok) // true

    ok = CheckPassword("otra-contraseña", hash)
    fmt.Println("Válida:", ok) // false
}
```

### En un handler HTTP

```go
func registerHandler(w http.ResponseWriter, r *http.Request) {
    var input struct {
        Password string `json:"password"`
    }
    json.NewDecoder(r.Body).Decode(&input)

    // Validar fortaleza
    if len(input.Password) < 8 {
        http.Error(w, "La contraseña debe tener al menos 8 caracteres", 400)
        return
    }

    // Hashear
    hash, err := HashPassword(input.Password)
    if err != nil {
        http.Error(w, "Error al hashear contraseña", 500)
        return
    }

    // Guardar en DB (hash, no texto plano)
    db.Exec("INSERT INTO users (password_hash) VALUES ($1)", hash)
}
```

### Verificación con rehash

```go
func loginHandler(w http.ResponseWriter, r *http.Request) {
    var input struct {
        Password string `json:"password"`
    }

    // Obtener hash de la DB
    var hash string
    db.QueryRow("SELECT password_hash FROM users WHERE email = $1", input.Email).Scan(&hash)

    // Verificar contraseña
    if !CheckPassword(input.Password, hash) {
        http.Error(w, "Credenciales inválidas", 401)
        return
    }

    // Verificar si necesita rehash (cuando cambias el coste)
    if needsRehash(hash) {
        newHash, _ := HashPassword(input.Password)
        db.Exec("UPDATE users SET password_hash = $1 WHERE email = $2", newHash, input.Email)
    }

    // Generar token...
}

func needsRehash(hash string) bool {
    cost, err := bcrypt.Cost([]byte(hash))
    if err != nil {
        return true
    }
    return cost < bcryptCost // si el coste actual es menor que el deseado
}
```

### Argon2 (alternativa más segura)

```go
import "golang.org/x/crypto/argon2"

func HashArgon2(password string, salt []byte) []byte {
    // Argon2id es la variante recomendada
    hash := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
    return hash
}
```

## Comparativa: Hashing

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Algoritmo por defecto** | bcrypt | bcrypt (vía x/crypto) |
| **Coste** | 10 (configurable) | Tú eliges (10-14) |
| **Hashear** | `Hash::make($pw)` | `bcrypt.GenerateFromPassword()` |
| **Verificar** | `Hash::check($pw, $hash)` | `bcrypt.CompareHashAndPassword()` |
| **Rehash** | `Hash::needsRehash($hash)` | `bcrypt.Cost() < desired` |
| **Argon2** | No por defecto | `golang.org/x/crypto/argon2` |
| **Dependencia** | Ninguna (incluido) | `golang.org/x/crypto` (oficial) |

## Errores comunes

1. **Coste demasiado bajo** — Coste < 10 es muy rápido para ataques de fuerza bruta. Usa 10-12 para producción.
2. **Coste demasiado alto** — Coste > 14 hace el registro muy lento (>1s). Balancea seguridad con UX.
3. **No verificar si necesita rehash** — Cuando aumentes el coste bcrypt, los hashes antiguos siguen siendo válidos pero con coste bajo. Rehash en login.
4. **Usar SHA256 para contraseñas** — SHA no está diseñado para contraseñas. Siempre usa bcrypt, scrypt o argon2.

## Buenas prácticas

- Usa bcrypt con coste 12 como mínimo.
- Si necesitas máxima seguridad, usa Argon2id.
- Nunca almacenes contraseñas en texto plano.
- Siempre valida fortaleza de contraseña antes de hashear (mín 8 chars, mayúscula, número, etc.).
- Rehashing en login permite migrar a algoritmos más fuertes gradualmente.

## Ejercicio sugerido

> Implementa un endpoint GET /hash-check que reciba un query param `hash` y devuelva el coste bcrypt de ese hash (usa `bcrypt.Cost()`). Luego implementa rehash automático si el hash tiene coste < 12.

## Siguientes pasos

- [Reset passwords](/security/reset-passwords/)
