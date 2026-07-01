---
title: "Título de la Página"
description: "Descripción corta para SEO y previstas"
order: 1
section: "01-prologue"
laravel_url: "https://laravel.com/docs/13.x/releases"
go_packages: ["fmt", "log"]
---

# Título de la Página

**TL;DR** — Una frase directa que conecta el concepto de Laravel con su equivalente en Go. Máximo dos líneas.

---

## En Laravel

Contexto breve de cómo funciona esta característica en Laravel. Asume que el lector viene de PHP/Laravel.

Máximo 3 párrafos. Explica el *qué* y el *por qué* de la aproximación de Laravel, para que el lector reconozca el concepto.

```php
// Código PHP/Laravel de ejemplo (solo si es relevante)
Route::get('/users', [UserController::class, 'index']);
```

## En Go

Cómo se implementa el mismo concepto con la stdlib de Go. Explica la filosofía detrás.

```go
// Código Go funcional y listo para copiar-pegar
package main

import (
    "fmt"
    "log"
    "net/http"
)

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /users", handleUsers)
    
    log.Fatal(http.ListenAndServe(":8080", mux))
}

func handleUsers(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello, World")
}
```

### Conceptos clave

- Punto 1: ...
- Punto 2: ...

## Comparativa: Laravel vs Go

| Aspecto | Laravel (PHP) | Go (stdlib) |
|---------|---------------|-------------|
| Sintaxis | `Route::get(...)` | `mux.HandleFunc(...)` |
| Filosofía | Convención sobre configuración | Explícito sobre implícito |
| Estado | Framework con estado | Sin estado compartido |

## Errores comunes al migrar

1. **Error**: ...  
   **Solución**: ...

2. **Error**: ...  
   **Solución**: ...

## Buenas prácticas

- Haz esto...
- Evita esto...

## Ejercicio sugerido

> Breve ejercicio para practicar lo aprendido. Algo que se pueda resolver en 5-10 minutos.

## Siguientes pasos

- [Página relacionada 1](/04-the-basics/04-01-routing)
- [Página relacionada 2](/04-the-basics/04-02-middleware)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
