---
title: "Eventos y pub/sub"
description: "Implementa un sistema de eventos con canales y goroutines, equivalente a Event::dispatch y listeners de Laravel"
order: 2
section: "10-digging-deeper"
laravel_url: "https://laravel.com/docs/13.x/events"
go_packages: ["sync", "context"]
---

# Eventos y pub/sub

**TL;DR** — Laravel tiene `Event::dispatch(new UserRegistered($user))` con listeners, subscribers y colas. En Go usas channels + goroutines para un sistema pub/sub desacoplado, sin framework.

---

## En Laravel

```php
// Definir evento
class UserRegistered
{
    public function __construct(public User $user) {}
}

// Definir listener
class SendWelcomeEmail
{
    public function handle(UserRegistered $event): void
    {
        Mail::to($event->user)->send(new WelcomeMail($event->user));
    }
}

// Despachar (síncrono o encolado)
Event::dispatch(new UserRegistered($user));
```

Laravel ejecuta listeners secuencialmente por defecto. Si un listener falla, los siguientes no se ejecutan. Los eventos pueden encolarse para procesamiento asíncrono.

## En Go

Go maneja eventos con **channels** y **goroutines**. No necesitas un contenedor de IoC ni un bus mágico: el patrón es explícito.

### Sistema pub/sus básico

```go
package events

import (
    "sync"
)

type Event interface{}

type Handler func(event Event)

type Bus struct {
    handlers map[string][]Handler
    mu       sync.RWMutex
}

func New() *Bus {
    return &Bus{
        handlers: make(map[string][]Handler),
    }
}

func (b *Bus) Listen(name string, handler Handler) {
    b.mu.Lock()
    defer b.mu.Unlock()
    b.handlers[name] = append(b.handlers[name], handler)
}

func (b *Bus) Dispatch(name string, event Event) {
    b.mu.RLock()
    handlers := b.handlers[name]
    b.mu.RUnlock()

    for _, h := range handlers {
        h(event)
    }
}
```

### Eventos con channels (asíncrono)

```go
package events

type AsyncBus struct {
    channels map[string]chan Event
}

func NewAsync() *AsyncBus {
    return &AsyncBus{
        channels: make(map[string]chan Event),
    }
}

// Listen registra un canal y lanza goroutines workers
func (b *AsyncBus) Listen(name string, handler Handler, workers int) {
    ch := make(chan Event, 100)
    b.channels[name] = ch

    for range workers {
        go func() {
            for event := range ch {
                handler(event)
            }
        }()
    }
}

// Dispatch envía el evento al canal (no bloqueante si el buffer lo permite)
func (b *AsyncBus) Dispatch(name string, event Event) {
    ch, ok := b.channels[name]
    if !ok {
        return
    }
    select {
    case ch <- event:
    default:
        // Canal lleno: loggear o descartar
    }
}
```

### Ejemplo completo

```go
// Eventos
type UserRegistered struct {
    UserID int
    Email  string
}

type OrderShipped struct {
    OrderID string
    Total   float64
}

// Handlers
func sendWelcomeEmail(event events.Event) {
    e := event.(UserRegistered)
    log.Printf("Enviando bienvenida a %s", e.Email)
}

func updateInventory(event events.Event) {
    e := event.(OrderShipped)
    log.Printf("Actualizando inventario para orden %s", e.OrderID)
}

func main() {
    bus := events.NewAsync()

    // Registrar listeners
    bus.Listen("user.registered", sendWelcomeEmail, 3)
    bus.Listen("order.shipped", updateInventory, 2)

    // Despachar eventos (no bloqueante)
    bus.Dispatch("user.registered", UserRegistered{
        UserID: 42,
        Email:  "user@go.dev",
    })
    bus.Dispatch("order.shipped", OrderShipped{
        OrderID: "ORD-001",
        Total:   99.99,
    })

    time.Sleep(time.Second) // esperar a que los workers procesen
}
```

### Patrón pub/sub tipado con interfaces

```go
// En lugar de Event interface{}, usa tipos concretos
type Dispatcher[T any] struct {
    handlers []func(T)
}

func NewDispatcher[T any]() *Dispatcher[T] {
    return &Dispatcher[T]{}
}

func (d *Dispatcher[T]) Listen(fn func(T)) {
    d.handlers = append(d.handlers, fn)
}

func (d *Dispatcher[T]) Dispatch(event T) {
    for _, h := range d.handlers {
        h(event)
    }
}

// Uso
disp := NewDispatcher[UserRegistered]()
disp.Listen(func(e UserRegistered) {
    log.Printf("Usuario registrado: %d", e.UserID)
})
disp.Dispatch(UserRegistered{UserID: 1, Email: "a@b.com"})
```

## Comparativa: Eventos

| Aspecto | Laravel | Go (stdlib) |
|---------|---------|-------------|
| **Declaración** | Clase PHP con __construct | Struct Go |
| **Despacho** | `Event::dispatch(new Event())` | `bus.Dispatch("name", event)` |
| **Listeners** | Clases con método handle | Funciones o closures |
| **Async** | Queue worker | Goroutines + channels |
| **Cola de respaldo** | Base de datos / Redis | Channel buffer |
| **Orden** | Secuencial por listener | Orden de registro (o concurrente) |
| **Failure** | Detiene la cadena | Manejo explícito (defer/recover) |
| **Wildcards** | `Event::listen('*', fn)` | No nativo (implementable) |

## Errores comunes

1. **Compartir datos mutables entre handlers** — Los handlers ejecutan concurrentemente. Cada handler debe recibir una copia del evento o el evento debe ser inmutable.
2. **No manejar el buffer lleno** — Si el canal se llena, `Dispatch` bloquea o descarta. Usa `select` con `default` para descartar o loggear.
3. **Cerrar canales sin sincronización** — Solo el productor debe cerrar el canal. Usa `sync.WaitGroup` para esperar que los consumidores terminen.
4. **Usar `interface{}` sin tipo** — Siempre que puedas, usa genéricos (Go 1.18+) para events tipados. Evita type assertions en cada handler.

## Buenas prácticas

- Mantén los eventos pequeños e inmutables. Un evento es un mensaje, no un objeto de dominio.
- Usa canales con buffer para no bloquear al productor.
- Define eventos como tipos exportados, handlers como funciones privadas.
- Si necesitas orden estricto, usa un solo worker por canal (workers=1).

## Ejercicio sugerido

> Crea un bus de eventos que soporte cancelación via `context.Context`. Cuando el contexto se cancele, los workers deben terminar graceful. Despacha 100 eventos y verifica que todos se procesen antes de cancelar.

## Siguientes pasos

- [Colas y worker pools](/digging-deeper/colas/)
- [Notificaciones multicanal](/digging-deeper/notificaciones/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
