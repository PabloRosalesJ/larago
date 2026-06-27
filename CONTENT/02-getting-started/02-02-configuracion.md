---
title: "Configuración sin .env mágico"
description: "Gestiona configuracion de aplicaciones Go con variables de entorno y flags, sin archivos .env magicos"
order: 2
section: "02-getting-started"
laravel_url: "https://laravel.com/docs/13.x/configuration"
go_packages: ["os", "flag", "fmt", "log"]
---

# Configuración sin .env mágico

**TL;DR** — En Laravel la configuración vive en archivos PHP dentro de `config/` y se sobreescribe con `.env`. En Go lees variables de entorno directamente con `os.Getenv` y las parseas con `os.LookupEnv` o el paquete `flag`.

---

## En Laravel

```php
// config/app.php
return [
    'name' => env('APP_NAME', 'Laravel'),
    'env'  => env('APP_ENV', 'production'),
];

// .env
APP_NAME=MiApp
APP_ENV=local
DB_HOST=127.0.0.1
```

Laravel usa `env()` para leer variables, que a su vez leen el archivo `.env` mágico que se carga al inicio. No pasas la configuración explícitamente: llamas `config('app.name')` desde cualquier parte.

## En Go

En Go no hay archivos `.env` mágicos ni un contenedor de configuración global. Lees las variables de entorno reales del sistema:

```go
package main

import (
    "log"
    "os"
)

// Config agrupa toda la configuración de la aplicación
type Config struct {
    AppName string
    AppEnv  string
    DBHost  string
    DBPort  string
}

// LoadConfig lee la configuración desde variables de entorno
func LoadConfig() Config {
    return Config{
        AppName: getEnv("APP_NAME", "GoApp"),
        AppEnv:  getEnv("APP_ENV", "production"),
        DBHost:  getEnv("DB_HOST", "localhost"),
        DBPort:  getEnv("DB_PORT", "5432"),
    }
}

// getEnv lee una variable de entorno con valor por defecto
func getEnv(key, fallback string) string {
    if value, ok := os.LookupEnv(key); ok {
        return value
    }
    return fallback
}

func main() {
    cfg := LoadConfig()
    log.Printf("Iniciando %s en entorno %s", cfg.AppName, cfg.AppEnv)
}
```

### Ejecución

```bash
# Variables de entorno inline
APP_NAME=MiApp APP_ENV=development go run .

# O exportadas
export APP_NAME=MiApp
export APP_ENV=development
go run .
```

### Usando `flag` para flags de línea de comandos

```go
package main

import (
    "flag"
    "log"
)

type Config struct {
    Port  int
    Debug bool
}

func main() {
    port := flag.Int("port", 8080, "Puerto del servidor")
    debug := flag.Bool("debug", false, "Modo debug")
    flag.Parse()

    cfg := Config{
        Port:  *port,
        Debug: *debug,
    }

    log.Printf("Servidor iniciado en puerto %d (debug: %v)", cfg.Port, cfg.Debug)
}

// Uso: go run . -port=3000 -debug
```

## Comparativa: Configuración

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Archivo de configuración** | `config/*.php` + `.env` | Variables de entorno + struct Config |
| **Lectura** | `config('app.name')` | `os.Getenv("APP_NAME")` |
| **Valores por defecto** | `env('KEY', 'default')` | `getEnv("KEY", "default")` |
| **Tipado** | Todo es string, casteas manualmente | Parseas a tipos nativos |
| **Global** | Sí, `config()` es accesible globalmente | No, pasas la struct explícitamente |
| **Archivo .env** | Carga automática con `vlucas/phpdotenv` | No existe por defecto (puedes cargarlo manualmente con `godotenv`) |

### Cargar archivos .env en Go (opcional)

Si aún quieres usar archivos `.env` (para desarrollo local), usa la librería `godotenv`:

```bash
go get github.com/joho/godotenv
```

```go
package main

import (
    "log"
    "os"
    "github.com/joho/godotenv"
)

func main() {
    // Carga .env solo si existe (no falla si no está)
    if err := godotenv.Load(); err != nil {
        log.Println("No se encontró archivo .env")
    }

    dbHost := os.Getenv("DB_HOST")
    log.Printf("Conectando a %s", dbHost)
}
```

## Errores comunes

1. **Buscar un `config()` global como en Laravel** — En Go la configuración se pasa explícitamente como dependencia. No hay singleton global.
2. **No verificar si la variable existe** — Usa `os.LookupEnv` para saber si la variable fue seteada o está vacía.
3. **Olvidar parsear tipos** — `os.Getenv` siempre devuelve string. Debes convertir a int, bool, etc. manualmente.
4. **Commitear `.env`** — No comitees archivos con secrets. Usa `.env.example` como plantilla.

## Buenas prácticas

- Define un struct `Config` que agrupe toda la configuración.
- Pásala como dependencia a los componentes que la necesiten.
- Para producción, usa variables de entorno reales (no archivos .env).
- Los valores sensibles (passwords, tokens) deben ir en variables de entorno, nunca en código.

## Ejercicio sugerido

> Crea un programa que lea una variable de entorno `GREETING` (con defecto "Hola") y `NAME` (con defecto "Mundo"), e imprima "GREETING, NAME!". Luego agrega un flag `--count` que repita el mensaje N veces.

## Siguientes pasos

- [Estructura de proyecto](/getting-started/estructura-de-proyecto/)
