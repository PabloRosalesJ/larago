---
title: "Validación sin Validator"
description: "Valida datos de entrada en Go manualmente, sin unValidator magico como Laravel, con funciones claras y reutilizables"
order: 9
section: "04-the-basics"
laravel_url: "https://laravel.com/docs/13.x/validation"
go_packages: ["net/http", "encoding/json", "fmt", "strings"]
---

# Validación sin Validator

**TL;DR** — Laravel valida con `$request->validate(['field' => 'required|email'])`. En Go validas con funciones manuales o librerías como `go-playground/validator`.

---

## En Laravel

```php
$request->validate([
    'name'  => 'required|string|max:255',
    'email' => 'required|email|unique:users',
    'age'   => 'required|integer|min:18',
]);
```

## En Go

### Validación manual

```go
type CreateUserInput struct {
    Name  string `json:"name"`
    Email string `json:"email"`
    Age   int    `json:"age"`
}

type ValidationErrors struct {
    Field string `json:"field"`
    Error string `json:"error"`
}

func validateCreateUser(input CreateUserInput) []ValidationErrors {
    var errs []ValidationErrors

    if strings.TrimSpace(input.Name) == "" {
        errs = append(errs, ValidationErrors{"name", "El nombre es requerido"})
    } else if len(input.Name) > 255 {
        errs = append(errs, ValidationErrors{"name", "El nombre no debe exceder 255 caracteres"})
    }

    if strings.TrimSpace(input.Email) == "" {
        errs = append(errs, ValidationErrors{"email", "El email es requerido"})
    } else if !strings.Contains(input.Email, "@") {
        errs = append(errs, ValidationErrors{"email", "Email inválido"})
    }

    if input.Age < 18 {
        errs = append(errs, ValidationErrors{"age", "Debes ser mayor de 18 años"})
    }

    return errs
}

func createUserHandler(w http.ResponseWriter, r *http.Request) {
    var input CreateUserInput
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        writeJSON(w, http.StatusBadRequest, map[string]string{"error": "JSON inválido"})
        return
    }

    if errs := validateCreateUser(input); len(errs) > 0 {
        writeJSON(w, http.StatusUnprocessableEntity, map[string]any{
            "errors": errs,
        })
        return
    }

    // Procesar...
    writeJSON(w, http.StatusCreated, map[string]string{"status": "ok"})
}
```

### Usando go-playground/validator (opcional)

```bash
go get github.com/go-playground/validator/v10
```

```go
import "github.com/go-playground/validator/v10"

type CreateUserInput struct {
    Name  string `json:"name"  validate:"required,max=255"`
    Email string `json:"email" validate:"required,email"`
    Age   int    `json:"age"   validate:"required,min=18"`
}

var validate = validator.New()

func validateStruct(input any) []ValidationErrors {
    var errs []ValidationErrors
    err := validate.Struct(input)
    if err == nil {
        return nil
    }
    for _, err := range err.(validator.ValidationErrors) {
        errs = append(errs, ValidationErrors{
            Field: err.Field(),
            Error: fmt.Sprintf("%s: %s", err.Tag(), err.Param()),
        })
    }
    return errs
}
```

### Validación de query params

```go
func listUsersHandler(w http.ResponseWriter, r *http.Request) {
    page := r.URL.Query().Get("page")
    perPage := r.URL.Query().Get("per_page")

    var errs []string

    if page != "" {
        n, err := strconv.Atoi(page)
        if err != nil || n < 1 {
            errs = append(errs, "page debe ser un entero positivo")
        }
    }

    if perPage != "" {
        n, err := strconv.Atoi(perPage)
        if err != nil || n < 1 || n > 100 {
            errs = append(errs, "per_page debe ser entre 1 y 100")
        }
    }

    if len(errs) > 0 {
        writeJSON(w, http.StatusBadRequest, map[string]any{"errors": errs})
        return
    }
}
```

### Validación de path params

```go
func showUserHandler(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id")
    n, err := strconv.Atoi(id)
    if err != nil || n < 1 {
        writeJSON(w, http.StatusBadRequest, map[string]string{
            "error": "ID inválido",
        })
        return
    }
    // n es un int válido
}
```

## Comparativa: Validación

| Aspecto | Laravel | Go (manual) | Go (validator) |
|---------|---------|-------------|-----------------|
| **Declaración** | Array asociativo | Struct + funciones | Struct tags |
| **Mensajes** | Automáticos | Manual | Automáticos (inglés) |
| **FormRequest** | Clase separada | Función validateXxx | `validate.Struct()` |
| **Reglas custom** | `Rule::unique(...)` | `if` en función | Tags personalizados |
| **Traducción** | `lang/` | Manual | Manual |
| **Dependencia** | Ninguna (incluido) | Ninguna | Validator package |
| **Complejidad** | Baja | Media (muchos ifs) | Media-baja |

## Errores comunes

1. **Validar solo en el handler** — Separa la validación en funciones reutilizables: `validateCreateUser(input)`, `validateUpdateUser(input)`.
2. **No sanear espacios** — Llama `strings.TrimSpace()` antes de validar.
3. **Devolver errores genéricos** — Devuelve errores específicos por campo para que el cliente pueda mostrar cada error en su campo correspondiente.
4. **Olvidar validar path params** — `r.PathValue("id")` devuelve string. Siempre parsea y valida.

## Buenas prácticas

- Separa la validación en funciones independientes del handler.
- Devuelve errores estructurados: `{ "errors": [{ "field": "name", "message": "..." }] }`.
- Para proyectos pequeños, validación manual (if) es suficiente y evita dependencias.
- Para proyectos grandes, usa `go-playground/validator` que es el estándar de facto.

## Ejercicio sugerido

> Crea un handler POST /users que reciba JSON con `name`, `email`, `age`. Implementa validación manual: name requerido (max 100), email requerido (debe contener @), age requerido (min 13). Devuelve errores por campo en formato JSON.

## Siguientes pasos

- [Errores como valores](/the-basics/errores-como-valores/)
