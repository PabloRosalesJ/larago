---
title: "Mocks en Go"
description: "Implementa test doubles en Go con interfaces, mocks manuales y gomock/mockgen"
order: 4
section: "11-testing"
laravel_url: "https://laravel.com/docs/13.x/mocking"
go_packages: ["testing", "go.uber.org/mock/gomock"]
---

# Mocks en Go

**TL;DR** — Laravel tiene `$this->mock()` y `Cache::shouldReceive()`. Go usa interfaces: defines el contrato, implementas un mock manual o usas `gomock` para generarlo.

---

## En Laravel

```php
class OrderTest extends TestCase
{
    public function test_process_order_sends_email(): void
    {
        $this->mock(Mailer::class, function ($mock) {
            $mock->shouldReceive('send')
                ->once()
                ->withArgs(fn($email) => str_contains($email, 'Gracias'));
        });

        $orderService = app(OrderService::class);
        $orderService->process(['email' => 'user@example.com']);
    }
}
```

## En Go

Go no tiene mocks mágicos porque no tiene `app()` ni contenedor de servicios. Usa interfaces en el código productivo y pásalas como dependencias.

### 1. Define una interfaz

```go
// mailer.go (código productivo)
type Mailer interface {
    Send(to, subject, body string) error
}

type OrderService struct {
    mailer Mailer
}

func NewOrderService(mailer Mailer) *OrderService {
    return &OrderService{mailer: mailer}
}

func (s *OrderService) Process(email string) error {
    // ...
    return s.mailer.Send(email, "Gracias", "Contenido del email")
}
```

### 2. Mock manual (sin dependencias externas)

```go
// mailer_test.go
type mockMailer struct {
    sendCalled bool
    lastTo     string
    lastBody   string
}

func (m *mockMailer) Send(to, subject, body string) error {
    m.sendCalled = true
    m.lastTo = to
    m.lastBody = body
    return nil
}

func TestOrderProcess_SendsEmail(t *testing.T) {
    mailer := &mockMailer{}
    svc := NewOrderService(mailer)

    err := svc.Process("user@example.com")
    if err != nil {
        t.Fatal(err)
    }
    if !mailer.sendCalled {
        t.Error("Send() no fue llamado")
    }
    if mailer.lastTo != "user@example.com" {
        t.Errorf("to = %q, want %q", mailer.lastTo, "user@example.com")
    }
}
```

### 3. Mock con `gomock` (uber)

Para mocks más complejos (verificar llamadas, orden, argumentos), usa `gomock`:

```bash
go install go.uber.org/mock/mockgen@latest
mockgen -source=mailer.go -destination=mock_mailer.go -package=main
```

```go
// mailer_test.go con gomock
func TestOrderProcess_WithGomock(t *testing.T) {
    ctrl := gomock.NewController(t)
    defer ctrl.Finish()

    mailer := NewMockMailer(ctrl)
    mailer.EXPECT().
        Send("user@example.com", "Gracias", gomock.Any()).
        Return(nil).
        Times(1)

    svc := NewOrderService(mailer)
    err := svc.Process("user@example.com")
    if err != nil {
        t.Fatal(err)
    }
}
```

### 4. Stub manual (retorna valor fijo)

Para casos simples donde solo necesitas un valor de retorno:

```go
type stubUserRepo struct {
    user User
    err  error
}

func (s *stubUserRepo) FindByID(id int) (User, error) {
    return s.user, s.err
}

func TestGetUserDisplay(t *testing.T) {
    repo := &stubUserRepo{
        user: User{Name: "Alice"},
        err:  nil,
    }
    svc := NewUserService(repo)
    display := svc.GetDisplay(1)
    if display != "Alice" {
        t.Errorf("got %q, want %q", display, "Alice")
    }
}
```

### 5. Spy manual (graba llamadas)

```go
type spyCache struct {
    calls []string
}

func (s *spyCache) Get(key string) (any, bool) {
    s.calls = append(s.calls, "GET "+key)
    return nil, false
}

func (s *spyCache) Set(key string, val any) {
    s.calls = append(s.calls, "SET "+key+"="+fmt.Sprint(val))
}

func TestCacheOrder(t *testing.T) {
    cache := &spyCache{}
    svc := NewCachedService(cache)
    svc.GetOrFetch("users:42")

    if len(cache.calls) < 2 {
        t.Error("esperaba al menos 2 llamadas a cache")
    }
}
```

## Comparativa: Mocks

| Concepto | Laravel | Go |
|----------|---------|----|
| **Mock framework** | Mockery / PHPUnit | Interfaces + manual / gomock |
| **Fachadas** | `Cache::shouldReceive()` | No existe (inyección explícita) |
| **Mock parcial** | `onlyMethods()` | No nativo (mockea toda la interfaz) |
| **Verificar llamadas** | `shouldReceive()->once()` | `gomock.EXPECT().Times(1)` |
| **Argumentos** | `withArgs(fn)` | `gomock.Eq()`, `gomock.Any()` |
| **Orden de llamadas** | `ordered()` | `gomock.InOrder()` |
| **Test double** | `$this->mock()`, `$this->partialMock()` | Mock / Stub / Spy manuales |

## Errores comunes al migrar

1. **Mockear concreto en lugar de interfaz** — En Go solo mockeas interfaces. Si tu función acepta `*sql.DB`, no puedes reemplazarlo en tests. Acepta una interfaz desde el principio.
2. **No llamar `ctrl.Finish()`** — En gomock (versión anterior), si no llamas `Finish()`, los `EXPECT()` no verificados no se reportan. En `go.uber.org/mock`, `gomock.NewController(t)` ya reporta automáticamente.
3. **Hacer mocks de todo** — Go considera aceptable usar la implementación real si es rápida (SSH, HTTP, DB real). Solo mockea lo que es lento o no determinista (API externas, reloj, sistema de archivos).

## Buenas prácticas

- Diseña con interfaces pequeñas (1-3 métodos). Una interfaz grande es señal de acoplamiento.
- Prefiere mocks manuales para interfaces de 1-2 métodos. Son más legibles que gomock.
- Usa gomock cuando la interfaz tiene 5+ métodos o necesitas verificar orden de llamadas.
- Los spies son ideales para cache, logs, y métricas: registran qué pasó sin aserciones previas.

## Ejercicio sugerido

> Define una interfaz `PaymentGateway` con método `Charge(amount float64) error`. Escribe un `OrderService` que la use. Crea un mock manual que: (a) siempre retorne nil, (b) verifique que `Charge` fue llamado con el monto correcto.

## Siguientes pasos

- [Testing HTTP](/testing/testing-http/)
- [Testing con base de datos](/testing/testing-con-db/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
