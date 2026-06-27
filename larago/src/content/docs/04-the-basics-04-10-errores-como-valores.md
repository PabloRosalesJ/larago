---
title: "Errores como valores"
description: "Maneja errores en Go con el patron 'errores como valores', sin excepciones ni try/catch"
order: 10
section: "04-the-basics"
laravel_url: "https://laravel.com/docs/13.x/errors"
go_packages: ["errors", "fmt", "log"]
---

# Errores como valores

**TL;DR** — Laravel lanza excepciones con `throw` y las captura con `try/catch`. Go trata los errores como **valores de retorno** que debes revisar explícitamente. No hay excepciones.

---

## En Laravel

```php
// Laravel: excepciones
try {
    $user = User::findOrFail($id);
    $user->update($request->all());
} catch (ModelNotFoundException $e) {
    return response()->json(['error' => 'No encontrado'], 404);
} catch (ValidationException $e) {
    return response()->json(['errors' => $e->errors()], 422);
}
```

Laravel también tiene un handler global de excepciones en `App\Exceptions\Handler`.

## En Go

```go
package main

import (
    "errors"
    "fmt"
    "log"
    "net/http"
)

// Función que puede fallar: devuelve (resultado, error)
func findUser(id int) (*User, error) {
    if id <= 0 {
        return nil, errors.New("ID inválido")
    }
    // ... buscar en DB ...
    return nil, fmt.Errorf("usuario %d no encontrado", id)
}

// En el handler, manejas el error donde ocurre
func showUserHandler(w http.ResponseWriter, r *http.Request) {
    id, _ := strconv.Atoi(r.PathValue("id"))

    user, err := findUser(id)
    if err != nil {
        // Manejas el error AQUÍ, no en un catch lejano
        http.Error(w, err.Error(), http.StatusNotFound)
        return // ← importante: nunca olvides el return
    }

    writeJSON(w, user)
}
```

### Patrón: sentinel errors

```go
var (
    ErrNotFound     = errors.New("recurso no encontrado")
    ErrUnauthorized = errors.New("no autorizado")
    ErrValidation   = errors.New("error de validación")
)

func getUser(id int) (*User, error) {
    // ...
    return nil, ErrNotFound
}

// En el handler:
if errors.Is(err, ErrNotFound) {
    http.Error(w, "Usuario no encontrado", 404)
} else if errors.Is(err, ErrUnauthorized) {
    http.Error(w, "No autorizado", 401)
}
```

### Patrón: wrapping errors (error con contexto)

```go
import "fmt"

func processUser(id int) error {
    user, err := db.FindUser(id)
    if err != nil {
        // Envuelve el error con contexto adicional
        return fmt.Errorf("procesando usuario %d: %w", id, err)
    }
    return nil
}

// %w permite usar errors.Is() y errors.As() para desempaquetar
```

### Patrón: error struct personalizado

```go
type AppError struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
    Err     error  `json:"-"`
}

func (e *AppError) Error() string {
    return e.Message
}

func (e *AppError) Unwrap() error {
    return e.Err
}

// Uso
func createUser(name string) (*User, *AppError) {
    if name == "" {
        return nil, &AppError{
            Code:    422,
            Message: "El nombre es requerido",
        }
    }
    // ...
    return &User{Name: name}, nil
}
```

### Múltiples errores (validación)

```go
type ValidationError struct {
    Field   string `json:"field"`
    Message string `json:"message"`
}

type ValidationErrors []ValidationError

func (ve ValidationErrors) Error() string {
    var msgs []string
    for _, e := range ve {
        msgs = append(msgs, fmt.Sprintf("%s: %s", e.Field, e.Message))
    }
    return strings.Join(msgs, "; ")
}

// Uso en handler
if errs := validateUser(input); len(errs) > 0 {
    writeJSON(w, http.StatusUnprocessableEntity, map[string]any{
        "errors": errs,
    })
    return
}
```

### Panic (solo para casos excepcionales)

```go
// En Go, panic es como throw, pero casi nunca se usa
func initServer() {
    tmpl := template.Must(template.ParseGlob("templates/*.html"))
    // template.Must hace panic si hay error
    // Esto es aceptable solo en inicialización
}
```

```go
// Recuperación de panic con defer
func RecoveryMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if rec := recover(); rec != nil {
                log.Printf("PANIC: %v", rec)
                http.Error(w, "Error interno del servidor", 500)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

## Comparativa: Errores

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Mecanismo** | Excepciones (throw/catch) | Valores de retorno (err != nil) |
| **Flujo** | El stack se desenrolla automáticamente | Debes propagar el error explícitamente |
| **Contexto** | Stack trace automático | `fmt.Errorf("...%w", err)` manual |
| **Tipos** | Clases de excepción | `var ErrXxx = errors.New(...)` |
| **Múltiples** | Catch por tipo | `errors.Is()`, `errors.As()` |
| **Panic** | `throw` para todo | `panic()` solo para casos excepcionales |
| **Handler global** | `App\Exceptions\Handler` | Middleware Recovery |
| **Stack trace** | Automático | `debug.Stack()` o paquetes como `pkg/errors` |

## Errores comunes

1. **No revisar `err != nil`** — El error más común en Go. Si una función devuelve error, revísalo SIEMPRE.
2. **Usar `panic` como si fuera `throw`** — `panic` es para bugs, no para errores esperados. Un input inválido no es un panic.
3. **Ignorar errores con `_`** — `db.QueryRow(...)` sin revisar error es una bomba de tiempo. Al menos loggea el error.
4. **No cerrar recursos** — Usa `defer file.Close()` después de abrir archivos, conexiones, etc.

## Buenas prácticas

- Siempre revisa `err != nil`. Es parte del lenguaje, no es opcional.
- Usa `fmt.Errorf("contexto: %w", err)` para agregar contexto sin perder el error original.
- Define errores centinela (`var ErrXxx = errors.New(...)`) para errores que el handler deba distinguir.
- No uses `_` para ignorar errores. Si realmente no te importa, coméntalo.
- Implementa un middleware de Recovery para capturar panics no esperados.

## Ejercicio sugerido

> Escribe una función `Divide(a, b int) (int, error)` que devuelva error si b es 0. Luego escribe un handler HTTP que reciba a y b como query params y devuelva el resultado o un error. Maneja el error explícitamente sin excepciones.

## Siguientes pasos

- [Logging estructurado](/the-basics/logging/)
