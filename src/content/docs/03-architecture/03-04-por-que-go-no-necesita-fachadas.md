---
title: "Por qué Go no necesita fachadas"
description: "Entiende por que Go no necesita el patron Facade de Laravel y como la simplicidad reemplaza la magia"
order: 4
section: "03-architecture"
laravel_url: "https://laravel.com/docs/13.x/facades"
go_packages: []
---

# Por qué Go no necesita fachadas

**TL;DR** — Las Facades en Laravel son atajos estáticos a instancias del contenedor. En Go no hay estado global mutable, así que no hay necesidad de fingir que una función estática accede a una instancia dinámica.

---

## En Laravel

```php
// Laravel: Facade como atajo estático
use Illuminate\Support\Facades\Cache;

class UserController extends Controller
{
    public function show($id)
    {
        // Esto SE VE como un método estático...
        return Cache::remember("user.{$id}", 3600, function () {
            return User::find($id);
        });
    }
}
```

`Cache::remember()` parece un método estático, pero en realidad `Cache` es una Facade que resuelve una instancia del contenedor. Esto es azúcar sintáctica que esconde la complejidad.

Para testear, Laravel proporciona `Cache::shouldReceive('remember')->andReturn(...)`, otra capa de magia.

## En Go

En Go, no hay estado global mutable (sin singletons). Si necesitas un cache, lo pasas explícitamente:

```go
package main

type UserHandler struct {
    cache  Cache
    users  *UserRepository
}

func (h *UserHandler) Show(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id")

    // Explícito: llamas a métodos en una INSTANCIA que recibiste
    user, ok := h.cache.Get("user." + id)
    if !ok {
        var err error
        user, err = h.users.FindByID(id)
        if err != nil {
            http.Error(w, err.Error(), 404)
            return
        }
        h.cache.Set("user."+id, user, 1*time.Hour)
    }
    // responder con user...
}

// Definición de la interfaz (donde la necesitas)
type Cache interface {
    Get(key string) (any, bool)
    Set(key string, value any, ttl time.Duration)
}
```

No hay fachada. `h.cache` es una instancia real que fue inyectada en el constructor.

### Test sin magia

```go
// Test: creas un mock manual de la interfaz
type mockCache struct {
    data map[string]any
}

func (m *mockCache) Get(key string) (any, bool) {
    v, ok := m.data[key]
    return v, ok
}

func (m *mockCache) Set(key string, value any, ttl time.Duration) {
    m.data[key] = value
}

func TestUserShow(t *testing.T) {
    cache := &mockCache{data: make(map[string]any)}
    handler := &UserHandler{cache: cache, users: &UserRepository{}}
    // test...
}
```

Sin fachadas, sin `shouldReceive`, sin magia. Pasas un mock que implementa la interfaz.

### ¿Y si realmente necesitas un singleton?

```go
// Go: si necesitas una instancia compartida, la creas una vez y la pasas
// No hay "fachada estática". Hay una instancia explícita.
cache := NewInMemoryCache()
handler1 := NewUserHandler(cache, userRepo)
handler2 := NewOrderHandler(cache, orderRepo)
```

## Comparativa: Facades

| Aspecto | Laravel (Facade) | Go |
|---------|------------------|-----|
| **Naturaleza** | Atajo estático a instancia dinámica | Instancia real inyectada |
| **Cómo se llama** | `Cache::remember()` (estático) | `handler.cache.Remember()` (instancia) |
| **Resolución** | Contenedor DI resuelve detrás de escena | Pasa explícitamente en constructor |
| **Test** | `Cache::shouldReceive()` | Mock de interfaz, inyectas mock |
| **Legibilidad** | Corto pero mágico | Explícito y predecible |
| **Estado global** | Sí (el Facade accede al contenedor global) | No (cada handler tiene su instancia) |
| **IDE support** | Limitado (no sabes qué métodos están disponibles sin ejecutar) | Total (sabes exactamente el tipo) |

## Errores comunes

1. **Buscar una Facade para Logger** — En Go, usas `slog.Logger` directamente. Si quieres un logger global, exponlo como variable de paquete, pero mejor pásalo como dependencia.
2. **Crear variables globales para simular Facades** — `var Log = slog.Default()` es tentador, pero perjudica los tests. Pásalo explícitamente.
3. **No entender que la simplicidad de Go es intencional** — La razón por la que Go no tiene Facades no es porque "no se le ocurrió a los diseñadores". Es porque el patrón esconde complejidad y fomenta el acoplamiento global.

## Buenas prácticas

- Pasa dependencias explícitamente. Cada handler recibe lo que necesita.
- Define interfaces pequeñas donde las necesites, no donde las implementes.
- Para tests, implementa la interfaz manualmente o usa `mockgen`.
- Si sientes que necesitas una Facade, pregúntate: "¿por qué no paso esta dependencia directamente?".

## Ejercicio sugerido

> Toma el ejemplo del `Cache::remember()` de Laravel y tradúcelo a Go puro: define una interfaz `Cache`, implementa `InMemoryCache`, crea un `UserHandler` que la reciba en su constructor, y escribe un test que use un `mockCache`. Sin fachadas, sin magia.

## Siguientes pasos

- [Routing con stdlib](/the-basics/routing/)
