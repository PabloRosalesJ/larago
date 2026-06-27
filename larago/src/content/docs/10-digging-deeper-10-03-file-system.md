---
title: "Sistema de archivos"
description: "Lee, escribe y embebe archivos en Go usando os, io/fs, y embed, equivalente a Storage::disk de Laravel"
order: 3
section: "10-digging-deeper"
laravel_url: "https://laravel.com/docs/13.x/filesystem"
go_packages: ["os", "io", "io/fs", "embed", "path/filepath"]
---

# Sistema de archivos

**TL;DR** — Laravel tiene `Storage::disk('s3')->put('file', $content)` con múltiples discos (local, s3, gcs). Go usa el paquete `os` para archivos locales, `io/fs` para interfaces de sistema de archivos, y `embed` para incrustar archivos en el binario.

---

## En Laravel

```php
// Laravel: sistema de archivos por discos
Storage::disk('local')->put('file.txt', 'contenido');
$content = Storage::disk('local')->get('file.txt');
Storage::disk('local')->delete('file.txt');

// Discos: local, s3, gcs, etc.
Storage::disk('s3')->put('avatars/photo.jpg', $file);

// Conveniencias
Storage::exists('file.txt');
Storage::files('directory');
Storage::directories('directory');
```

Laravel abstrae el sistema de archivos detrás de "discos". Cambiar de local a S3 solo implica cambiar la configuración.

## En Go

Go separa las responsabilidades en paquetes especializados:

- `os` — operaciones con archivos y directorios
- `io` / `io/fs` — interfaces (`io.Reader`, `io.Writer`, `fs.FS`)
- `embed` — incrustar archivos en el binario (Go 1.16+)
- `path/filepath` — manipulación de rutas

### Leer y escribir archivos

```go
package main

import (
    "fmt"
    "os"
    "path/filepath"
)

func main() {
    // Escribir archivo (sobrescribe)
    err := os.WriteFile("file.txt", []byte("contenido"), 0644)

    // Leer archivo completo
    data, err := os.ReadFile("file.txt")
    fmt.Println(string(data))

    // Append
    f, _ := os.OpenFile("file.txt", os.O_APPEND|os.O_WRONLY, 0644)
    f.WriteString("nueva línea\n")
    f.Close()

    // Eliminar
    os.Remove("file.txt")

    // Crear directorios (como mkdir -p)
    os.MkdirAll("path/to/dir", 0755)

    // Listar archivos en directorio
    entries, _ := os.ReadDir(".")
    for _, e := range entries {
        fmt.Println(e.Name(), e.IsDir())
    }

    // Walk recursivo
    filepath.WalkDir(".", func(path string, d os.DirEntry, err error) error {
        if err != nil {
            return err
        }
        fmt.Println(path)
        return nil
    })
}
```

### Interfaces `io.Reader` y `io.Writer`

```go
// Go usa interfaces para operaciones de streaming
// Cualquier cosa que implemente io.Reader se puede leer
// Cualquier cosa que implemente io.Writer se puede escribir

// Copiar de un archivo a otro
src, _ := os.Open("source.txt")
defer src.Close()

dst, _ := os.Create("dest.txt")
defer dst.Close()

io.Copy(dst, src) // equivalente a cp

// Leer de un archivo por partes (buffered)
buf := make([]byte, 32)
f, _ := os.Open("file.txt")
for {
    n, err := f.Read(buf)
    if err == io.EOF {
        break
    }
    fmt.Print(string(buf[:n]))
}
```

### Archivos embebidos con `embed`

```go
// Incrustar archivos en el binario compilado
// Sin dependencias externas, sin sistema de archivos en producción

import (
    "embed"
    "net/http"
)

//go:embed static/*
var staticFiles embed.FS

//go:embed templates/*.html
var templateFiles embed.FS

//go:embed config.yaml
var configFile []byte

func main() {
    // Servir archivos estáticos embebidos
    http.Handle("GET /static/", http.FileServer(http.FS(staticFiles)))

    // Leer archivo embebido
    data, _ := templateFiles.ReadFile("templates/index.html")
    fmt.Println(string(data))

    // Config embebida
    fmt.Println(string(configFile))
}
```

### Sistema de archivos virtual (fs.FS)

```go
// io/fs.FS es una interfaz que representa un sistema de archivos
// Cualquier implementación (os.DirFS, embed.FS, zip.Reader) es compatible

// Leer archivos de un directorio
fsys := os.DirFS(".")
data, _ := fs.ReadFile(fsys, "file.txt")

// Listar archivos
entries, _ := fs.ReadDir(fsys, ".")
for _, e := range entries {
    fmt.Println(e.Name())
}
```

## Comparativa: File System

| Aspecto | Laravel | Go (stdlib) |
|---------|---------|-------------|
| **Leer archivo** | `Storage::get('file')` | `os.ReadFile("file")` |
| **Escribir** | `Storage::put('file', $c)` | `os.WriteFile("file", data, 0644)` |
| **Eliminar** | `Storage::delete('file')` | `os.Remove("file")` |
| **Listar** | `Storage::files('dir')` | `os.ReadDir("dir")` |
| **Streaming** | `Storage::readStream('file')` | `os.Open("file")` + `io.Copy` |
| **Discos remotos** | S3, GCS nativos | Librerías externas (aws-sdk-go) |
| **Archivos embebidos** | No nativo | `embed` (Go 1.16+) |
| **Sistema virtual** | No aplica | `io/fs.FS` (interfaz) |
| **Walk recursivo** | `Storage::allFiles('dir')` | `filepath.WalkDir` |

## Errores comunes

1. **No cerrar archivos** — Siempre usa `defer f.Close()` después de abrir un archivo. Los file descriptors son un recurso limitado.
2. **Permisos incorrectos** — `os.WriteFile` requiere permisos octal (0644, 0755). No uses strings.
3. **Ignorar errores de `Close`** — Al escribir, `f.Close()` puede fallar si el buffer no se vació correctamente. Verifica el error.
4. **Usar rutas relativas en producción** — La ruta relativa depende del `cwd` del proceso. Usa rutas absolutas o variables de entorno.
5. **No usar `embed` para archivos estáticos** — Si distribuyes un binario, los archivos estáticos deben ir dentro. `embed` los incluye en la compilación.

## Buenas prácticas

- Prefiere `os.ReadFile`/`os.WriteFile` para archivos pequeños; usa `os.Open` + `io.Copy` para archivos grandes.
- Usa `embed.FS` para templates, configs, y archivos estáticos que acompañan al binario.
- Implementa `fs.FS` si necesitas un sistema de archivos virtual (tests, zip, etc.).
- Siempre maneja errores al cerrar archivos de escritura.

## Ejercicio sugerido

> Crea un programa que lea un directorio, filtre archivos por extensión `.log`, lea cada uno, y cuente líneas que contengan "ERROR". Usa `fs.WalkDir` y `bufio.Scanner`.

## Siguientes pasos

- [Cliente HTTP](/digging-deeper/cliente-http/)
- [Logging estructurado](/the-basics/logging/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
