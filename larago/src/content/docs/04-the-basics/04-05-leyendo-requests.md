---
title: "Leyendo requests"
description: "Extrae datos de requests HTTP en Go: formularios, JSON, query params y archivos usando la stdlib"
order: 5
section: "04-the-basics"
laravel_url: "https://laravel.com/docs/13.x/requests"
go_packages: ["net/http", "encoding/json", "fmt", "io"]
---

# Leyendo requests

**TL;DR** — En Laravel inyectas `Request $request` y accedes a `$request->input('name')`. En Go usas `*http.Request` directamente: `r.FormValue("name")`, `r.URL.Query().Get("page")`, `json.NewDecoder(r.Body)`.

---

## En Laravel

```php
use Illuminate\Http\Request;

public function store(Request $request)
{
    $name  = $request->input('name');
    $email = $request->input('email');
    $page  = $request->query('page', 1);
    $file  = $request->file('avatar');

    $request->validate([
        'name' => 'required|string',
        'email' => 'required|email',
    ]);
}
```

## En Go

```go
package main

import (
    "encoding/json"
    "fmt"
    "io"
    "log"
    "net/http"
)

type CreateUserInput struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}

func createUserHandler(w http.ResponseWriter, r *http.Request) {
    // 1. Query params (GET /users?page=2&role=admin)
    page := r.URL.Query().Get("page")   // "2"
    role := r.URL.Query().Get("role")   // "admin"

    // 2. Form values (POST con application/x-www-form-urlencoded)
    name := r.FormValue("name")         // de query o body
    email := r.PostFormValue("email")   // solo del body (POST)

    // 3. JSON body (POST con application/json)
    var input CreateUserInput
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, "JSON inválido", http.StatusBadRequest)
        return
    }

    // 4. Headers
    apiKey := r.Header.Get("X-API-Key")
    contentType := r.Header.Get("Content-Type")

    // 5. Path params (Go 1.22+)
    userID := r.PathValue("id")         // de /users/{id}

    fmt.Fprintf(w, "Procesado: %+v", input)
}
```

### Leyendo archivos

```go
func uploadHandler(w http.ResponseWriter, r *http.Request) {
    // Límite de 10MB
    r.ParseMultipartForm(10 << 20)

    file, header, err := r.FormFile("avatar")
    if err != nil {
        http.Error(w, "Archivo requerido", http.StatusBadRequest)
        return
    }
    defer file.Close()

    log.Printf("Archivo recibido: %s (%d bytes)", header.Filename, header.Size)

    // Guardar archivo
    dst, _ := os.Create("uploads/" + header.Filename)
    defer dst.Close()
    io.Copy(dst, file)
}
```

### Path values (Go 1.22+)

```go
mux.HandleFunc("GET /users/{id}/posts/{postId}", func(w http.ResponseWriter, r *http.Request) {
    userID := r.PathValue("id")       // "42"
    postID := r.PathValue("postId")   // "7"
})
```

### Request context

```go
func handler(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Verificar si el cliente se desconectó
    select {
    case <-ctx.Done():
        log.Println("Cliente desconectado")
        return
    default:
    }

    // Obtener valores del contexto (seteados por middleware)
    userID := ctx.Value("user_id").(string)
}
```

### Binding a struct (como FormRequest)

No hay un FormRequest como Laravel, pero puedes hacer binding manual:

```go
type UserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
    Age   int    `json:"age"`
}

func parseAndValidate(r *http.Request) (UserRequest, error) {
    var req UserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        return req, fmt.Errorf("JSON inválido: %w", err)
    }
    if req.Name == "" {
        return req, fmt.Errorf("name es requerido")
    }
    if req.Email == "" {
        return req, fmt.Errorf("email es requerido")
    }
    return req, nil
}
```

## Comparativa: Requests

| Operación | Laravel | Go |
|-----------|---------|-----|
| **Input** | `$request->input('name')` | `r.FormValue("name")` |
| **Query param** | `$request->query('page')` | `r.URL.Query().Get("page")` |
| **JSON** | `$request->json('key')` | `json.NewDecoder(r.Body).Decode(&v)` |
| **Header** | `$request->header('X-Key')` | `r.Header.Get("X-Key")` |
| **Path param** | `{id}` en ruta | `r.PathValue("id")` |
| **File** | `$request->file('avatar')` | `r.FormFile("avatar")` |
| **Validate** | `$request->validate([...])` | Manual (if checks) |
| **Context** | `$request->user()` | `r.Context().Value(key)` |

## Errores comunes

1. **Olvidar `r.Body.Close()`** — No es necesario en Go 1.24+, pero la buena práctica es siempre cerrar el body.
2. **Leer `r.Body` dos veces** — El body solo se puede leer una vez. Si necesitas leerlo dos veces, usa `io.NopCloser` con un buffer.
3. **Parsear JSON sin verificar Content-Type** — Siempre verifica que `r.Header.Get("Content-Type")` sea `application/json` antes de parsear.

## Buenas prácticas

- Decodifica JSON directamente con `json.NewDecoder(r.Body).Decode(&v)` en lugar de leer a bytes y luego unmarshal.
- Usa `r.ParseMultipartForm()` para formularios con archivos, `r.ParseForm()` para formularios simples.
- Define structs tipados para cada request body.
- Para validación, escribe funciones `validate(req) error` separadas.

## Ejercicio sugerido

> Crea un handler POST que reciba JSON con `{ "title": "...", "content": "..." }`, lo valide (title requerido, content máximo 1000 chars), y responda con el objeto creado más un ID generado.

## Siguientes pasos

- [Construyendo responses](/the-basics/construyendo-responses/)
