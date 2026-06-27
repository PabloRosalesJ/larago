---
title: "Instalación y setup"
description: "Instala Go, configura tu primer modulo y crea un servidor HTTP basico"
order: 1
section: "02-getting-started"
laravel_url: "https://laravel.com/docs/13.x/installation"
go_packages: ["net/http", "log", "fmt"]
---

# Instalación y setup

**TL;DR** — En Laravel instalas PHP + Composer + Laravel Installer y ejecutas `laravel new`. En Go instalas el compilador y usas `go mod init` para crear un módulo. No hay "proyecto base", solo código.

---

## En Laravel

```bash
# Laravel: instalas PHP, Composer, y el installer
composer global require laravel/installer
laravel new example-app
cd example-app
composer run dev
```

Laravel te da un proyecto completo con estructura de directorios, configuración, migrations, tests, etc. Empiezas con todo.

## En Go

```bash
# Go: instalas el compilador y creas un módulo vacío
brew install go                    # macOS
# o descarga de https://go.dev/dl/

go version                         # Verificar instalación
# → go version go1.24.2 darwin/amd64

mkdir mi-app && cd mi-app
go mod init github.com/tuusuario/mi-app

# Crear un archivo main.go
cat > main.go << 'EOF'
package main

import (
    "log"
    "net/http"
)

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("Hola desde Go"))
    })
    log.Fatal(http.ListenAndServe(":8080", mux))
}
EOF

go run main.go                     # Ejecutar
# Servidor escuchando en :8080
```

No hay "proyecto base". Go te da un módulo vacío y tú construyes desde cero. El servidor HTTP viene incluido en la stdlib — no necesitas instalar nada más.

### Verificar la instalación

```bash
go env GOROOT    # → /usr/local/go (dónde está instalado Go)
go env GOPATH    # → /Users/tu/go (dónde van los paquetes descargados)
go env GOMOD     # → /path/to/mi-app/go.mod (módulo actual)
```

## Comparativa: Instalación

| Paso | Laravel | Go |
|------|---------|-----|
| **Instalación** | PHP + Composer + Laravel Installer | `brew install go` o binario |
| **Crear proyecto** | `laravel new app` | `go mod init` |
| **Servidor de desarrollo** | `composer run dev` (start multiple services) | `go run .` |
| **Dependencias** | `composer require` → `composer.json` | `go get` → `go.mod` |
| **Puerto por defecto** | 8000 | 8080 (tú lo eliges) |
| **Tiempo al primer "hola mundo"** | ~5 minutos | ~2 minutos |

## Errores comunes

1. **Olvidar `go mod init`** — Sin un `go.mod`, Go no sabe cómo compilar tu proyecto.
2. **Usar `go run main.go` cuando hay múltiples archivos** — Usa `go run .` o `go run *.go` en su lugar.
3. **Buscar homólogo de `artisan serve`** — Go no necesita un servidor de desarrollo separado. `go run` compila y ejecuta tu binario directamente.

## Buenas prácticas

- Usa `go mod init <ruta>` con una ruta significativa (ej: `github.com/tuuser/mi-app`).
- Todo tu código vive dentro del módulo. No hay carpeta `vendor` por defecto (solo si usas `go mod vendor`).
- Versiona tu `go.mod` y `go.sum` en git.

## Ejercicio sugerido

> Instala Go, crea un módulo, escribe un servidor HTTP que responda "Hola, [nombre]" en la ruta `GET /hola?nombre=Juan`, y ejecútalo sin frameworks.

## Siguientes pasos

- [Configuración sin .env mágico](/getting-started/configuracion/)
