---
title: "Construyendo responses"
description: "Construye respuestas HTTP en Go: JSON, HTML, binario, errores y redirecciones usando la stdlib"
order: 6
section: "04-the-basics"
laravel_url: "https://laravel.com/docs/13.x/responses"
go_packages: ["net/http", "encoding/json", "html/template", "fmt"]
---

# Construyendo responses

**TL;DR** — En Laravel devuelves `response()->json(...)` o `view('...')`. En Go escribes directamente en `http.ResponseWriter`: `w.Write([]byte(...))`, `json.NewEncoder(w)`, o ejecutas un template.

---

## En Laravel

```php
// Laravel: múltiples tipos de respuesta
return response()->json(['user' => $user], 201);
return view('users.show', ['user' => $user]);
return redirect('/users');
return response()->file($pdfPath);
return response()->download($file);
```

## En Go

### JSON Response

```go
import "encoding/json"

func jsonResponse(w http.ResponseWriter, status int, data any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(data)
}

func userHandler(w http.ResponseWriter, r *http.Request) {
    user := User{ID: 1, Name: "Juan"}
    jsonResponse(w, http.StatusOK, map[string]any{
        "user": user,
        "meta": map[string]int{"total": 1},
    })
}
```

### HTML Template

```go
import "html/template"

var tmpl = template.Must(template.ParseFiles("templates/user.html"))

func userHTML(w http.ResponseWriter, r *http.Request) {
    user := User{ID: 1, Name: "Juan"}
    w.Header().Set("Content-Type", "text/html; charset=utf-8")
    w.WriteHeader(http.StatusOK)
    tmpl.Execute(w, user)
}
```

### Redirección

```go
func redirectHandler(w http.ResponseWriter, r *http.Request) {
    // Redirección 301 (permanente)
    http.Redirect(w, r, "https://ejemplo.com", http.StatusMovedPermanently)

    // Redirección 302 (temporal)
    http.Redirect(w, r, "/login", http.StatusFound)
}
```

### Error

```go
func errorHandler(w http.ResponseWriter, r *http.Request) {
    // Error simple
    http.Error(w, "No encontrado", http.StatusNotFound)

    // Error con JSON
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusBadRequest)
    json.NewEncoder(w).Encode(map[string]string{
        "error":   "validation_error",
        "message": "El campo email es requerido",
    })
}
```

### Envío de archivos

```go
func fileHandler(w http.ResponseWriter, r *http.Request) {
    // Servir archivo (como response()->file())
    w.Header().Set("Content-Type", "application/pdf")
    http.ServeFile(w, r, "files/reporte.pdf")

    // Forzar descarga (como response()->download())
    w.Header().Set("Content-Disposition", `attachment; filename="reporte.pdf"`)
    http.ServeFile(w, r, "files/reporte.pdf")
}
```

### Response raw (cualquier tipo)

```go
func rawResponse(w http.ResponseWriter, r *http.Request) {
    // Texto plano
    w.Write([]byte("Hola, mundo"))

    // XML
    w.Header().Set("Content-Type", "application/xml")
    w.Write([]byte("<user><name>Juan</name></user>"))

    // CSV
    w.Header().Set("Content-Type", "text/csv")
    w.Write([]byte("nombre,email\nJuan,juan@go.dev"))
}
```

### Response stream (chunked)

```go
func streamHandler(w http.ResponseWriter, r *http.Request) {
    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "Streaming no soportado", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "text/plain")
    w.Header().Set("X-Content-Type-Options", "nosniff")

    for i := 0; i < 10; i++ {
        fmt.Fprintf(w, "Línea %d\n", i)
        flusher.Flush()
        time.Sleep(1 * time.Second)
    }
}
```

## Comparativa: Responses

| Tipo | Laravel | Go |
|------|---------|-----|
| **JSON** | `response()->json($data)` | `json.NewEncoder(w).Encode(data)` |
| **HTML** | `view('name', $data)` | `tmpl.Execute(w, data)` |
| **Redirect** | `redirect('/path')` | `http.Redirect(w, r, "/path", 302)` |
| **Error** | `abort(404)` | `http.Error(w, msg, 404)` |
| **File** | `response()->file($path)` | `http.ServeFile(w, r, path)` |
| **Download** | `response()->download($path)` | header + `http.ServeFile` |
| **Plain** | `response($text)` | `w.Write([]byte(text))` |
| **Status** | `response()->json(...)->setStatusCode(201)` | `w.WriteHeader(201)` |

## Errores comunes

1. **Escribir header después de `w.Write()`** — Go escribe automáticamente 200 OK cuando llamas `w.Write()` por primera vez. Si quieres otro status, llama `w.WriteHeader()` antes.
2. **No setear Content-Type** — Go no infiere Content-Type a menos que uses `http.DetectContentType()`. Setéalo explícitamente.
3. **No escapar HTML en templates** — Usa `html/template` (no `text/template`) para HTML. Escapa automáticamente.

## Buenas prácticas

- Crea helpers `jsonResponse(w, status, data)`, `errorResponse(w, status, msg)` para consistencia.
- Usa constantes HTTP: `http.StatusOK`, `http.StatusNotFound`, `http.StatusInternalServerError`.
- Siempre setea `Content-Type` antes de `WriteHeader`.
- Para APIs, establece una estructura de respuesta consistente: `{ "data": ..., "error": ... }`.

## Ejercicio sugerido

> Crea un handler que devuelva JSON con paginación: `GET /users?page=1`. La respuesta debe incluir `{ "data": [...], "meta": { "page": 1, "total": 50, "per_page": 10 } }`. Implementa helpers `jsonResponse` y `errorResponse`.

## Siguientes pasos

- [Templates sin Blade](/the-basics/templates/)
