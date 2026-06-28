---
title: "Testing con la stdlib"
description: "Escribe y ejecuta tests en Go usando el paquete testing, table-driven tests y subtests"
order: 1
section: "11-testing"
laravel_url: "https://laravel.com/docs/13.x/testing"
go_packages: ["testing", "fmt"]
---

# Testing con la stdlib

**TL;DR** — Laravel usa PHPUnit con `php artisan test`. Go tiene `go test` + el paquete `testing`: tests paralelizables, table-driven tests y subtests sin frameworks externos.

---

## En Laravel

```php
// Laravel + PHPUnit
class UserTest extends TestCase
{
    public function test_it_creates_a_user(): void
    {
        $user = User::factory()->create();
        $this->assertNotNull($user->id);
    }
}
```

Ejecución: `php artisan test` corre todos los tests.

## En Go

Go incluye el paquete `testing` en la stdlib. Los tests van en archivos `*_test.go` junto al código que prueban.

```go
package user_test

import (
    "testing"
)

func TestCreateUser(t *testing.T) {
    // t es el "test runner" equivalente a $this en PHPUnit
    got := createUser("alice@example.com")
    if got == nil {
        t.Fatal("createUser() returned nil")
    }
    if got.Email != "alice@example.com" {
        t.Errorf("email = %q, want %q", got.Email, "alice@example.com")
    }
}
```

### Table-driven tests

Es el patrón estrella de Go: un slice de casos, un solo bucle.

```go
func TestValidateEmail(t *testing.T) {
    tests := []struct {
        name  string
        input string
        want  bool
    }{
        {"válido", "user@example.com", true},
        {"sin arroba", "userexample.com", false},
        {"vacío", "", false},
        {"con espacios", "user @example.com", false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := ValidateEmail(tt.input)
            if got != tt.want {
                t.Errorf("ValidateEmail(%q) = %v, want %v", tt.input, got, tt.want)
            }
        })
    }
}
```

### Subtests

`t.Run()` crea sub-tests con su propio `*testing.T`. Se ejecutan en serie por defecto; paralelízalos con `t.Parallel()`.

```go
func TestDatabaseOperations(t *testing.T) {
    t.Run("insert", func(t *testing.T) {
        // ...
    })
    t.Run("select", func(t *testing.T) {
        t.Parallel() // corre en paralelo con otros t.Parallel()
        // ...
    })
}
```

### Métodos de `*testing.T`

| Método | Equivalente PHPUnit | Comportamiento |
|--------|---------------------|----------------|
| `t.Error(args...)` | `$this->assertTrue(false)` | Falla, continúa |
| `t.Errorf(format, args...)` | `$this->assertStringContainsString(...)` | Falla con formato, continúa |
| `t.Fatal(args...)` | `$this->fail()` o `throw` | Falla, detiene el test |
| `t.Fatalf(format, args...)` | — | Falla con formato, detiene |
| `t.Log(args...)` | — | Log condicional (solo con `-v`) |
| `t.Skip(args...)` | `$this->markTestSkipped()` | Salta el test |
| `t.Cleanup(fn)` | `tearDown()` | Registra cleanup |
| `t.Parallel()` | — | Marca para ejecución paralela |

### Ejecutar tests

```bash
go test                    # todos los tests
go test ./...              # tests recursivos
go test -v                 # verbose (logs visibles)
go test -run TestValidate  # solo tests que matcheen
go test -count=1           # evita cache (útil para integración)
go test -race              # detecta race conditions
```

## Comparativa: Testing

| Concepto | Laravel (PHPUnit) | Go (testing) |
|----------|-------------------|--------------|
| **Ejecutar** | `php artisan test` | `go test` |
| **Clase base** | `TestCase` | `*testing.T` (como parámetro) |
| **Setup** | `setUp()` | `t.Cleanup()` o función helper |
| **Teardown** | `tearDown()` | `t.Cleanup(fn)` |
| **Data providers** | `@dataProvider` | Table-driven tests |
| **Tests anidados** | `@test` + clases | `t.Run(name, fn)` |
| **Saltar test** | `markTestSkipped()` | `t.Skip()` |
| **Assertions** | `$this->assert*()` | `if got != want { t.Error(...) }` |
| **Paralelismo** | `@group` manual | `t.Parallel()` |
| **Mocking** | Mockery / PHPUnit mocks | Interfaces manuales |

## Errores comunes al migrar

1. **Usar `t.Fatal` donde debería ir `t.Error`** — `Fatal` aborta el test inmediatamente. Úsalo solo si no tiene sentido continuar. Para aserciones normales usa `t.Error` / `t.Errorf`.

2. **No nombrar los casos table-driven** — Siempre pon un campo `name` y pásalo a `t.Run()`. Si falla el test 3, sin nombre no sabrás cuál es.

3. **Olvidar `-v` para ver logs** — `t.Log` solo se muestra con `go test -v`.

## Buenas prácticas

- Nombra los archivos `nombre_a_testear_test.go` (Go los detecta por el sufijo `_test.go`).
- Cada test en un `t.Run()`: los resultados se agrupan jerárquicamente.
- Usa `go test -short` + `t.Skip()` para separar tests unitarios de integración.
- No importes `testing` fuera de `*_test.go`.

## Ejercicio sugerido

> Crea una función `Sum(a, b int) int` en un archivo normal. Escribe un test table-driven con 5 casos (positivos, negativos, cero). Ejecuta `go test -v`.

## Siguientes pasos

- [Testing HTTP](/testing/testing-http/)
- [Testing con base de datos](/testing/testing-con-db/)
- [Mocks](/testing/mocks/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
