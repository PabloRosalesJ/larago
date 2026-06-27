---
title: "Filosofía de Go vs Laravel"
description: "Entiende las diferencias filosóficas fundamentales entre Laravel (PHP) y Go para migrar tu mentalidad de desarrollo"
order: 1
section: "01-prologue"
laravel_url: "https://laravel.com/docs/13.x/releases"
go_packages: ["fmt"]
---

# Filosofía de Go vs Laravel

**TL;DR** — Laravel es un framework opinado que te da todo resuelto; Go es un lenguaje minimalista donde tú construyes las piezas. No es que uno sea mejor que el otro, es que resuelven problemas distintos.

---

## En Laravel

Laravel es un framework "progresivo" y opinado. Su filosofía es **convención sobre configuración**: si sigues las reglas, el framework hace el trabajo pesado por ti. El Router sabe dónde buscar tus controladores, Eloquent asume nombres de tablas, Artisan genera código boilerplate.

Cuando usas Laravel, estás comprando un ecosistema completo:

```php
// Laravel: declarativo, mágico, convención
Route::get('/users', [UserController::class, 'index']);

class UserController extends Controller
{
    public function index()
    {
        return User::all(); // Eloquent asume tabla 'users'
    }
}
```

En Laravel, el "cómo" lo resuelve el framework. Tú solo dices el "qué".

## En Go

Go sigue la filosofía opuesta: **explícito sobre implícito**, **simple sobre elegante**, **composición sobre herencia de frameworks**.

Go no es un framework. Es un lenguaje con una stdlib tan potente que construye servidores web completos sin dependencias externas. No hay magia, no hay contenedor DI, no hay convenciones ocultas. Todo es explícito.

```go
// Go: explícito, directo, sin magia
package main

import (
    "log"
    "net/http"
)

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /users", handleUsers)
    log.Fatal(http.ListenAndServe(":8080", mux))
}

func handleUsers(w http.ResponseWriter, r *http.Request) {
    // Sin ORM, sin convenciones ocultas
    w.Write([]byte("Lista de usuarios"))
}
```

Cada línea de Go hace exactamente lo que parece hacer. No hay métodos mágicos `__call`, no hay Service Providers que se ejecutan en segundo plano, no hay fachadas con acceso estático a instancias dinámicas.

### Principios fundamentales de Go

1. **Explícito > implícito** — Cada dependencia se pasa como parámetro. Nada de `app()->make()`.
2. **Composición > herencia** — Usamos structs e interfaces, no herencia de clases. Un `http.Handler` es cualquier cosa que tenga un método `ServeHTTP`.
3. **Errores como valores** — No hay excepciones. Los errores se manejan donde ocurren.
4. **Simplicidad > facilidad** — Go prioriza el código que se puede entender rápida y completamente sobre el código que es rápido de escribir.
5. **Concurrencia nativa** — Las gorutinas y canales son parte del lenguaje, no una librería externa.

## Comparativa: Laravel vs Go

| Aspecto | Laravel (PHP) | Go |
|---------|---------------|-----|
| **Filosofía** | Convención sobre configuración | Explícito sobre implícito |
| **Abstracción** | Todo tiene una capa de abstracción (Facades, Providers, Contracts) | Mínima abstracción, máximo control |
| **Dependencias** | Composer + ecosistema gigante | Módulo único, stdlib prioritaria |
| **Concurrencia** | Síncrono por naturaleza | Gorutinas como parte del lenguaje |
| **Errores** | Excepciones con try/catch | Errores como valores (if err != nil) |
| **Estado** | Request lifecycle con estado compartido | Sin estado compartido entre gorutinas |
| **Inicio** | `laravel new app` te da proyecto completo | `go mod init` te da solo un módulo vacío |
| **Curva de aprendizaje** | Suave al inicio, complejo en profundidad | Empinada al inicio, plana después |

## Errores comunes al migrar

1. **Buscar un framework "Laravel para Go"** — No existe ni debería existir. Go no se usa así. Acepta que vas a escribir más código, pero cada línea será predecible.
2. **Intentar replicar la magia** — Cosas como `User::find(1)` requieren mucha reflexión en Go. En su lugar, escribe una función `FindUserByID(db, 1)` llamando a `database/sql` directamente.
3. **Pensar en términos de "routes/controllers/models"** — En Go organizas por responsabilidad, no por carpeta MVC. Un paquete `users` puede tener handler, lógica de negocio y acceso a datos juntos.

## Buenas prácticas

- Acepta que Go requiere más código explícito que Laravel. Eso es una feature, no un bug.
- Prioriza la stdlib sobre librerías externas. La stdlib de Go es tan completa que muchas veces no necesitas nada más.
- No luches contra el lenguaje. Si sientes que estás forzando un patrón, probablemente sea porque trajiste un hábito de Laravel que no aplica.

## Ejercicio sugerido

> Crea un servidor HTTP que responda "Hola desde Go" en la ruta `/`. Sin frameworks, solo stdlib. Luego agrega una ruta `/saludo/{nombre}` que salude al usuario. Observa lo explícito que es todo.

## Siguientes pasos

- [Migrar mentalidad: Framework → Biblioteca](/prologue/migrar-mentalidad/)
- [Instalación y setup](/getting-started/instalacion-y-setup/)
