---
title: "Caché en memoria"
description: "Implementa caché en memoria con expiración usando sync.RWMutex y time.AfterFunc, equivalente a Cache::remember de Laravel"
order: 1
section: "10-digging-deeper"
laravel_url: "https://laravel.com/docs/13.x/cache"
go_packages: ["sync", "time"]
---

# Caché en memoria

**TL;DR** — Laravel tiene `Cache::remember('key', 3600, fn())` con drivers (redis, file, database). Go stdlib no incluye caché, pero es trivial implementar uno con `map + sync.RWMutex` para concurrencia y `time.AfterFunc` para expiración.

---

## En Laravel

```php
// Laravel: caché con expiración automática
$users = Cache::remember('active_users', 3600, function () {
    return User::where('active', true)->get();
});

// Cache::has, Cache::get, Cache::put, Cache::forget
Cache::put('key', 'value', 600);
$value = Cache::get('key', 'default');
Cache::forget('key');
```

Laravel soporta múltiples _drivers_ (redis, memcached, file, database) y un sistema de tags. La expiración se maneja internamente y el developer no piensa en concurrencia porque PHP es síncrono por request.

## En Go

Go no tiene una librería de caché en stdlib porque la filosofía es "solo lo esencial". Para un caché en memoria necesitas:

1. Un `map` para almacenar los valores
2. Un `sync.RWMutex` para acceso concurrente seguro
3. `time.AfterFunc` para expiración automática

### Implementación funcional

```go
package cache

import (
    "sync"
    "time"
)

type Item struct {
    value   any
    expires time.Time
}

type Cache struct {
    items map[string]Item
    mu    sync.RWMutex
}

func New() *Cache {
    c := &Cache{
        items: make(map[string]Item),
    }
    go c.cleanup(5 * time.Minute)
    return c
}

func (c *Cache) Get(key string) (any, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()

    item, ok := c.items[key]
    if !ok {
        return nil, false
    }
    if !item.expires.IsZero() && time.Now().After(item.expires) {
        return nil, false
    }
    return item.value, true
}

func (c *Cache) Set(key string, value any, ttl time.Duration) {
    c.mu.Lock()
    defer c.mu.Unlock()

    var expires time.Time
    if ttl > 0 {
        expires = time.Now().Add(ttl)
    }

    c.items[key] = Item{value: value, expires: expires}
}

func (c *Cache) Delete(key string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    delete(c.items, key)
}

// Remember: equivalente a Cache::remember
func (c *Cache) Remember(key string, ttl time.Duration, fn func() any) any {
    if val, ok := c.Get(key); ok {
        return val
    }

    val := fn()
    c.Set(key, val, ttl)
    return val
}

func (c *Cache) cleanup(interval time.Duration) {
    ticker := time.NewTicker(interval)
    defer ticker.Stop()

    for range ticker.C {
        c.mu.Lock()
        now := time.Now()
        for k, v := range c.items {
            if !v.expires.IsZero() && now.After(v.expires) {
                delete(c.items, k)
            }
        }
        c.mu.Unlock()
    }
}
```

### Uso

```go
func main() {
    cache := cache.New()

    // Set y Get simples
    cache.Set("user:42", "Juan Perez", 5*time.Minute)
    val, ok := cache.Get("user:42")

    // Remember: evalúa solo si no existe
    result := cache.Remember("active_users", 30*time.Minute, func() any {
        return fetchActiveUsers() // DB query
    })

    // Delete
    cache.Delete("user:42")
}
```

### Variante con sincronización manual (`sync.Map`)

```go
// sync.Map es útil cuando las claves se escriben una vez
// y se leen muchas veces, o para claves que no cambian
var sm sync.Map

// Store
sm.Store("key", "value")

// Load
val, ok := sm.Load("key")

// Delete
sm.Delete("key")

// Range (iterar)
sm.Range(func(key, value any) bool {
    log.Printf("key=%v, value=%v", key, value)
    return true // continuar
})
```

**Cuándo usar `sync.Map` vs `map + RWMutex`:**
- `sync.Map`: pocas escrituras, muchas lecturas concurrentes, claves únicas que no se reasignan
- `map + RWMutex`: control de expiración, tipado fuerte, casos de uso general

## Comparativa: Caché

| Aspecto | Laravel | Go (stdlib) |
|---------|---------|-------------|
| **API** | `Cache::remember('key', sec, fn)` | `cache.Remember(key, ttl, fn)` |
| **Drivers** | redis, memcached, file, database | Solo memoria (implementación propia) |
| **Expiración** | Automática por driver | `time.AfterFunc` + cleanup goroutine |
| **Concurrencia** | No aplica (PHP síncrono) | `sync.RWMutex` o `sync.Map` |
| **Tags** | `Cache::tags(['people'])->get(...)` | No nativo |
| **Atomicidad** | `Cache::lock('key')->get()` | `sync.Mutex` |
| **Tamaño** | Ilimitado (configurable) | Ilimitado (manual cleanup) |

## Errores comunes

1. **Acceder al map sin mutex en goroutines** — Si dos goroutines escriben simultáneamente, panic por escritura concurrente. Siempre usa `sync.RWMutex`.
2. **No limpiar entradas expiradas** — La memoria crece indefinidamente. Implementa un cleanup periódico como en el ejemplo.
3. **Usar `sync.Map` cuando necesitas TTL** — `sync.Map` no soporta expiración. Para TTL usa `map + RWMutex`.
4. **Almacenar punteros sin considerar mutabilidad** — Si guardas un `*User`, modificarlo externamente corrompe la caché. Guarda copias o valores inmutables.

## Buenas prácticas

- Define una interfaz `Cache` al inicio para poder intercambiar implementación (redis, etc.) después.
- Siempre establece un TTL; una caché sin expiración es una fuga de memoria garantizada.
- En producción, considera usar Redis o Memcached vía librerías externas.
- Usa nombres de clave consistentes (ej. `user:{id}`, `posts:{id}:comments`).

## Ejercicio sugerido

> Implementa un caché con límite de tamaño (LRU). Cuando el caché excede `maxItems`, elimina la entrada más antigua. Agrega un método `Len() int`.

## Siguientes pasos

- [Eventos y pub/sub](/digging-deeper/eventos/)
- [Concurrencia en Go](/architecture/ciclo-de-vida-request/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
