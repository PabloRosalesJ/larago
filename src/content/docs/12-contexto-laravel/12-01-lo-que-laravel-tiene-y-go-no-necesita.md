---
title: "Lo que Laravel tiene y Go no necesita"
description: "Referencia única de conceptos de Laravel que no tienen equivalente directo en Go o se resuelven con la stdlib y herramientas del ecosistema"
order: 1
section: "12-contexto-laravel"
laravel_url: "https://laravel.com/docs/13.x/blade"
go_packages: ["html/template", "embed", "net/http"]
---

# Lo que Laravel tiene y Go no necesita

**TL;DR** — Laravel incluye decenas de features "baterías incluidas". Go deliberadamente no las incluye. Algunas se resuelven con la stdlib; otras con el ecosistema; otras simplemente no aplican. Esta página es tu referencia única.

---

## Blade Templates

**Laravel**: `{{ $variable }}`, `@if`, `@foreach`, layouts con `@extends` y `@section`.

**Go**: `html/template` auto-escapado, `template.ParseFS` con `embed` para archivos embebidos.

```go
// templates/hello.gohtml
// <h1>{{.Title}}</h1>
// <p>{{.Body}}</p>

// main.go
tmpl := template.Must(template.ParseFiles("templates/hello.gohtml"))
tmpl.Execute(w, map[string]string{"Title": "Hola", "Body": "Mundo"})
```

No hay herencia de templates nativa (`define`/`template` es lo más cercano). Layouts se hacen con composición.

| Blade | Go |
|-------|----|
| `{{ $var }}` | `{{.Var}}` |
| `@if` / `@endif` | `{{if .Cond}}...{{end}}` |
| `@foreach` | `{{range .Items}}...{{end}}` |
| `@extends('layout')` | Composición manual con `{{template "header"}}` |

---

## Vite / Asset Bundling

**Laravel**: Vite + `@vite('resources/css/app.css')`.

**Go**: `embed` + esbuild o (más común) servir archivos estáticos con `http.FileServer`.

```go
//go:embed static/*
var staticFiles embed.FS

mux.Handle("GET /static/", http.FileServer(http.FS(staticFiles)))
```

Para bundling JS/CSS, usa esbuild (CLI) o Vite como herramienta externa. Go no tiene ni necesita un bundler propio.

---

## URL Generation

**Laravel**: `route('users.show', $id)`, `url()->current()`, `action([Controller::class, 'method'])`.

**Go**: Construyes URLs manualmente con `fmt.Sprintf` o `url.URL`. No hay rutas con nombre.

```go
// "Named route" manual
type Route struct {
    Name string
    Path string
}

var routes = []Route{
    {"users.show", "/users/%d"},
}

func route(name string, args ...any) string {
    for _, r := range routes {
        if r.Name == name {
            return fmt.Sprintf(r.Path, args...)
        }
    }
    return ""
}
```

---

## Artisan Console

**Laravel**: `php artisan make:model`, `php artisan migrate`, comandos personalizados.

**Go**: No hay artisan. Usas el CLI de Go (`go run`, `go build`) + Makefile para automatización. Comandos personalizados se hacen con `os.Args` o `flag`.

```makefile
run:
	go run ./cmd/api

migrate:
	go run ./cmd/migrate

seed:
	go run ./cmd/seed
```

Para comandos más complejos, `cobra` (Kubernetes, Hugo, GitHub CLI lo usan).

---

## Broadcasting (Event Broadcasting)

**Laravel**: `event(new OrderShipped($order))` + Pusher/WebSockets.

**Go**: Sin evento global. Los eventos se pasan explícitamente como parámetros. Para WebSockets, usa `gorilla/websocket` o `nhooyr.io/websocket` con goroutines.

```go
type EventBus struct {
    mu     sync.Mutex
    subs   map[string][]chan Event
}

func (b *EventBus) Publish(topic string, event Event) {
    b.mu.Lock()
    chs := b.subs[topic]
    b.mu.Unlock()
    for _, ch := range chs {
        ch <- event
    }
}
```

---

## Collections

**Laravel**: `collect([1,2,3])->map(fn)->filter(fn)->reduce(fn)`.

**Go**: Slices y maps con bucles `for` directos. No hay fluent chaining nativo. Librerías como `samber/lo` o `elliotchance/pie` ofrecen algo similar, pero el idioma Go prefiere escribir el bucle.

```go
// Lo que en Laravel sería usar Collection:
// collect($users)->filter(fn($u) => $u->active)->map(fn($u) => $u->name)->values()

var names []string
for _, u := range users {
    if u.Active {
        names = append(names, u.Name)
    }
}
```

---

## Helpers ( `str()->slug()`, `Str::random()`, `dd()`, `dump()` )

**Laravel**: `str()->slug($text)`, `Str::random(16)`, `dd($var)`.

**Go**: Funciones sueltas de `strings`, `fmt`, `crypto/rand`. No hay helpers globales.

| Laravel | Go |
|---------|----|
| `Str::slug("Hola Mundo")` | `strings.ToLower(strings.ReplaceAll(s, " ", "-"))` |
| `Str::random(16)` | `hex.EncodeToString(rand.Read(16))` |
| `dd($var)` | `fmt.Printf("%+v\n", var); os.Exit(1)` |
| `collect(...)` | `for range` |

---

## Localization ( `__('messages.welcome')` )

**Laravel**: archivos `lang/en/messages.php`, `__()`, `@lang()`.

**Go**: No tiene i18n en stdlib. Se usa `golang.org/x/text` o librerías como `go-i18n/v2`. Los mensajes se pasan como constantes o structs tipados.

---

## Package Development

**Laravel**: `ServiceProvider`, `composer.json`, Packagist.

**Go**: `go.mod`, repositorio de Git, `go get`. No hay Service Providers: importas el paquete y llamas sus funciones.

---

## Redis / MongoDB

**Laravel**: `Cache::store('redis')`, `Redis::get()`, integración con Eloquent.

**Go**: Drivers oficiales: `github.com/redis/go-redis` y `go.mongodb.org/mongo-driver`. No hay abstracción mágica.

```go
rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
val, err := rdb.Get(ctx, "key").Result()
```

---

## Eloquent ORM (completo)

Cubierto en detalle en otras secciones:

| Sección | Contenido |
|---------|-----------|
| [07 - GORM](/gorm/instalacion-y-setup/) | ORM al estilo Eloquent |
| [08 - sqlc](/sqlc/instalacion-y-setup/) | SQL tipado generado |
| [09 - Comparativa](/comparativa/tabla-comparativa-eloquent-gorm-sqlc/) | Eloquent ↔ GORM ↔ sqlc |

---

## AI SDK, MCP, Boost

**Laravel 13.x**: SDK de IA, protocolo MCP, generación de contenido con Boost.

**Go**: No hay equivalente directo. Puedes llamar APIs de OpenAI/Anthropic con `net/http`. No hay un SDK oficial "tipo Laravel".

---

## Console Tests / Browser Tests

**Laravel**: `$this->artisan('migrate')`, Laravel Dusk.

**Go**: Ya cubierto en [Testing](/testing/testing-en-go/) y [Testing HTTP](/testing/testing-http/). Para browser tests: `playwright-go` o `rod`.

---

## Todos los packages de Laravel

Laravel tiene Cashier, Horizon, Telescope, Passport, Sanctum, Scout, Socialite, Dusk, Envoy, Fortify, Folio, Homestead, Mix, Octane, Pennant, Pint, Precognition, Prompts, Pulse, Reverb, Sail, Valet...

Ninguno tiene equivalente directo en Go. El ecosistema Go resuelve estos problemas con:

| Problema | Ecosistema Go |
|----------|---------------|
| Facturación (Stripe/Paddle) | `stripe/stripe-go` |
| Colas/Jobs | `asynq`, `riverqueue/river` |
| Debugging/Monitoreo | `pprof`, `opentelemetry` |
| OAuth/Social Login | `markbates/goth` |
| API Tokens | JWT + `golang-jwt/jwt` |
| Full-text search | `blevesearch/bleve` |
| Deploy | Docker + `ko` |
| Hot reload | `air-verse/air` |
| Task scheduling | `robfig/cron` (dentro del proceso) |

---

## Resumen: filosofía

| Laravel | Go |
|---------|----|
| "Baterías incluidas" | "Hazte tus propias baterías" |
| Convención sobre configuración | Explícito sobre implícito |
| El framework lo resuelve | Tú decides qué librería usar |
| Una forma de hacer las cosas | Muchas formas, ninguna "oficial" |
| Ruta feliz; si te sales, duele | Todo es explícito; no hay magia |

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
