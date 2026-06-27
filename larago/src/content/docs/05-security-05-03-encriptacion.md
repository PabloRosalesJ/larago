---
title: "Encriptación"
description: "Encripta y desencripta datos en Go con crypto/aes y crypto/cipher de la stdlib"
order: 3
section: "05-security"
laravel_url: "https://laravel.com/docs/13.x/encryption"
go_packages: ["crypto/aes", "crypto/cipher", "crypto/rand", "encoding/base64"]
---

# Encriptación

**TL;DR** — Laravel encripta con `Crypt::encrypt()` usando AES-256-CBC. En Go usas `crypto/aes` + `crypto/cipher` para AES-GCM, más seguro y autenticado.

---

## En Laravel

```php
$encrypted = Crypt::encryptString('Texto secreto');
$decrypted = Crypt::decryptString($encrypted);
```

## En Go

### AES-GCM (recomendado)

```go
package encryption

import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "encoding/base64"
    "errors"
    "io"
)

// Encrypt encripta texto plano con AES-256-GCM
func Encrypt(plaintext []byte, key []byte) (string, error) {
    block, err := aes.NewCipher(key)
    if err != nil {
        return "", err
    }

    aesGCM, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }

    nonce := make([]byte, aesGCM.NonceSize())
    if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
        return "", err
    }

    // GCM encripta y agrega autenticación
    ciphertext := aesGCM.Seal(nonce, nonce, plaintext, nil)

    return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt desencripta datos encriptados con Encrypt
func Decrypt(encrypted string, key []byte) ([]byte, error) {
    ciphertext, err := base64.StdEncoding.DecodeString(encrypted)
    if err != nil {
        return nil, err
    }

    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, err
    }

    aesGCM, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }

    nonceSize := aesGCM.NonceSize()
    if len(ciphertext) < nonceSize {
        return nil, errors.New("ciphertext demasiado corto")
    }

    nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
    plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return nil, errors.New("fallo al desencriptar (datos corruptos o key inválida)")
    }

    return plaintext, nil
}
```

### Uso

```go
func main() {
    // Key de 32 bytes para AES-256
    key := []byte("32-bytes-llave-secreta-para-aes-256!!")

    encrypted, _ := Encrypt([]byte("Mensaje secreto"), key)
    fmt.Println("Encriptado:", encrypted)

    decrypted, _ := Decrypt(encrypted, key)
    fmt.Println("Desencriptado:", string(decrypted))
}
```

### Encriptación de cookies

```go
// Encriptar cookies de sesión para不能ser manipuladas por el cliente
func encryptCookie(value string, key []byte) (string, error) {
    return Encrypt([]byte(value), key)
}

func decryptCookie(encrypted string, key []byte) (string, error) {
    data, err := Decrypt(encrypted, key)
    return string(data), err
}
```

## Comparativa: Encriptación

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Algoritmo** | AES-256-CBC | AES-256-GCM (superior) |
| **Autenticación** | MAC aparte (hash_hmac) | GCM incluye autenticación |
| **Uso** | `Crypt::encrypt()` / `decrypt()` | `Encrypt()` / `Decrypt()` manual |
| **Key** | `APP_KEY` en .env (32 bytes) | Tú provees key de 32 bytes |
| **Nonce/IV** | Automático | `crypto/rand` manual |
| **Rotación** | Automática | Debes implementarla |

## Errores comunes

1. **No usar GCM** — CBC + MAC es inseguro si no se implementa correctamente. GCM es AEAD (encriptación autenticada) y es más seguro.
2. **Key incorrecta** — AES-256 requiere exactamente 32 bytes. Usar menos bytes falla silenciosamente.
3. **Reusar nonce** — Nunca uses el mismo nonce/IV con la misma key. `crypto/rand` garantiza unicidad.
4. **Guardar key en el código** — La key debe venir de una variable de entorno, no hardcodeada.

## Buenas prácticas

- Siempre usa AES-256-GCM (no CBC).
- La key debe ser de 32 bytes, generada con `crypto/rand`.
- La key va en variable de entorno, no en el código.
- Si necesitas rotación de keys, usa prefijo en los datos encriptados para identificar qué key usar.
- GCM ya incluye autenticación, no necesitas un HMAC adicional.

## Ejercicio sugerido

> Implementa una función `EncryptCookie(value string, key []byte) string` que encripte y codifique en base64 un valor. Implementa `DecryptCookie` inversa. Úsala para encriptar el session ID antes de ponerlo en la cookie.

## Siguientes pasos

- [Hashing de contraseñas](/security/hashing/)
