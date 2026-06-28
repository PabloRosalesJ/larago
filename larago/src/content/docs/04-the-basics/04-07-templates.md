---
title: "Templates sin Blade"
description: "Renderiza HTML con templates Go usando html/template, sin el azucar sintactico de Blade pero con seguridad XSS nativa"
order: 7
section: "04-the-basics"
laravel_url: "https://laravel.com/docs/13.x/views"
go_packages: ["html/template", "embed", "net/http", "fmt"]
---

# Templates sin Blade

**TL;DR** — Laravel usa Blade con herencia (`@extends`), secciones (`@section`), y sintaxis abreviada. Go usa `html/template` con acciones simples como `{{.Name}}` y seguridad XSS automática.

---

## En Laravel (Blade)

```blade
{{-- layouts/app.blade.php --}}
<html>
<head><title>@yield('title')</title></head>
<body>
    @yield('content')
</body>
</html>

{{-- users/index.blade.php --}}
@extends('layouts.app')
@section('title', 'Usuarios')
@section('content')
    <ul>
    @foreach($users as $user)
        <li>{{ $user->name }}</li>
    @endforeach
    </ul>
@endsection
```

## En Go

```go
package main

import (
    "embed"
    "html/template"
    "log"
    "net/http"
)

//go:embed templates/*
var templateFS embed.FS

// Parsear templates al iniciar
var tmpl = template.Must(template.ParseFS(templateFS, "templates/*.html"))

type User struct {
    ID   int
    Name string
    Email string
}

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /users", listUsers)
    log.Fatal(http.ListenAndServe(":8080", mux))
}

func listUsers(w http.ResponseWriter, r *http.Request) {
    users := []User{
        {ID: 1, Name: "Juan", Email: "juan@go.dev"},
        {ID: 2, Name: "María", Email: "maria@go.dev"},
    }

    w.Header().Set("Content-Type", "text/html; charset=utf-8")
    tmpl.ExecuteTemplate(w, "users.html", map[string]any{
        "Title": "Usuarios",
        "Users": users,
    })
}
```

```html
{{-- templates/users.html --}}
<!DOCTYPE html>
<html>
<head>
    <title>{{.Title}}</title>
</head>
<body>
    <h1>{{.Title}}</h1>
    <ul>
    {{range .Users}}
        <li>{{.Name}} ({{.Email}})</li>
    {{end}}
    </ul>
</body>
</html>
```

### Acciones de template

| Acción | Descripción |
|--------|-------------|
| `{{.Field}}` | Mostrar valor (escapado automáticamente) |
| `{{if .Cond}}...{{end}}` | Condicional |
| `{{range .Items}}...{{end}}` | Iteración |
| `{{with .Obj}}...{{end}}` | Contexto local |
| `{{template "name" .}}` | Incluir otro template |
| `{{block "name" .}}...{{end}}` | Template con default |
| `{{. \| func}}` | Pipe (funciones) |

### Layouts como en Laravel (con block)

```html
{{-- templates/base.html --}}
<!DOCTYPE html>
<html>
<head>
    <title>{{block "title" .}}LaraGo{{end}}</title>
</head>
<body>
    <nav>{{block "nav" .}}Menú por defecto{{end}}</nav>
    <main>{{block "content" .}}Contenido por defecto{{end}}</main>
</body>
</html>
```

```html
{{-- templates/users.html --}}
{{template "base.html" .}}

{{define "title"}}Lista de usuarios{{end}}

{{define "content"}}
    <ul>
    {{range .Users}}
        <li>{{.Name}}</li>
    {{end}}
    </ul>
{{end}}
```

### Funciones personalizadas

```go
// Registrar funciones en el template
func commonFuncs() template.FuncMap {
    return template.FuncMap{
        "upper": strings.ToUpper,
        "lower": strings.ToLower,
        "formatDate": func(t time.Time) string {
            return t.Format("02/01/2006")
        },
        "safeHTML": func(s string) template.HTML {
            return template.HTML(s) // ¡Cuidado! XSS
        },
    }
}

var tmpl = template.Must(
    template.New("").Funcs(commonFuncs()).ParseFS(templateFS, "templates/*.html"),
)
```

```html
<p>{{.Name | upper}}</p>
<p>{{.CreatedAt | formatDate}}</p>
```

## Comparativa: Templates

| Concepto | Blade (Laravel) | html/template (Go) |
|----------|-----------------|---------------------|
| **Sintaxis** | `{{ $var }}` | `{{.Var}}` |
| **Escape XSS** | Automático | Automático (html/template) |
| **Herencia** | `@extends`, `@section`, `@yield` | `{{template}}`, `{{block}}`, `{{define}}` |
| **Loop** | `@foreach($items as $item)` | `{{range .Items}}` |
| **Condicional** | `@if($cond)` | `{{if .Cond}}` |
| **Funciones** | `@php`, directivas personalizadas | `template.FuncMap` |
| **Archivos** | `resources/views/` | Cualquier directorio (o `embed`) |
| **Seguridad** | Escapa por defecto (Blade) | Escapa por defecto (html/template) |

## Errores comunes

1. **Usar `text/template` en lugar de `html/template`** — `text/template` no escapa HTML. Siempre usa `html/template` para páginas web.
2. **Confundir `.` (dot) scope** — Dentro de `{{range}}`, `.` es el item actual. Para acceder al contexto exterior, usa `$.` (ej: `$.Title`).
3. **No compilar templates al iniciar** — Usa `template.Must()` para parsear templates al arrancar, no en cada request.
4. **Olvidar `embed` para producción** — En producción los templates deben ir dentro del binario con `//go:embed`. No leas del filesystem.

## Buenas prácticas

- Compila todos los templates al iniciar la aplicación (no por cada request).
- Usa `//go:embed` para incluir templates en el binario.
- Separa layouts base y partials en templates reutilizables.
- Registra funciones comunes (formato fechas, upper, etc.) en un `FuncMap`.
- Usa `{{block}}` en el layout para definir defaults.

## Ejercicio sugerido

> Crea un layout base con header y footer, y dos páginas que lo extiendan: "Inicio" y "Acerca de". Usa `embed` para incrustar los templates en el binario. Agrega una función `currentYear` que devuelva el año actual.

## Siguientes pasos

- [Sessions con cookies](/the-basics/sessions/)
