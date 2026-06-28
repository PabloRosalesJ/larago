---
title: "Cómo contribuir a Go std"
description: "Guia para contribuir al ecosistema de Go: reportar bugs, sugerir features, contribuir codigo y mejores practicas"
order: 3
section: "01-prologue"
laravel_url: "https://laravel.com/docs/13.x/contributions"
go_packages: []
---

# Cómo contribuir a Go std

**TL;DR** — Contribuir al ecosistema Go es diferente a contribuir a Laravel. No hay un solo repositorio monolítico, sino múltiples proyectos: la stdlib en `go.googlesource.com/go`, los paquetes extendidos en `golang.org/x/*`, y módulos independientes en GitHub.

---

## En Laravel

En Laravel, contribuir significa:

- Reportar bugs en el repositorio oficial de Laravel Framework.
- Enviar PRs siguiendo la guía de estilo (PSR-2, PHPDoc).
- La mayoría de las contribuciones son al núcleo del framework (Routing, Eloquent, Blade, etc.).
- Laravel mantiene StyleCI para asegurar consistencia de estilo.

```php
// Ejemplo de contribución en Laravel: agregar un método a una clase existente
public function newMethod(): static
{
    // ...
    return $this;
}
```

## En Go

Contribuir a Go es más diverso. Existen varios canales y tipos de contribución:

### Reportar bugs

Si encuentras un bug en la stdlib o en las herramientas oficiales, repórtalo en:

- **Issues de Go**: https://github.com/golang/go/issues
- Sigue la plantilla de issue: describe el problema, versión de Go, código mínimo reproducible.
- Antes de reportar, busca si ya existe un reporte similar.

### Contribuir al código fuente de Go

El proceso es más formal que en Laravel:

1. Firma el CLA (Contributor License Agreement) de Google.
2. El flujo es: **Change >>> Review >>> Submit**. Usan Gerrit (no GitHub PRs).
3. Cada cambio debe tener una descripción clara del *por qué* y un test que lo acompañe.

```bash
# Flujo típico para contribuir a Go
git clone https://go.googlesource.com/go
cd go
git codereview change "mypackage: add new function FooBar"
# ... haces cambios ...
git codereview mail
```

### Contribuir a paquetes extendidos (golang.org/x)

Los paquetes `golang.org/x/*` (como `x/crypto`, `x/net`, `x/text`) siguen el mismo proceso que la stdlib, pero están en repositorios separados:

- https://go.googlesource.com/crypto
- https://go.googlesource.com/net

### Contribuir a la comunidad

No todo es código. Puedes contribuir de otras formas:

- Escribir documentación para paquetes que usas.
- Responder preguntas en https://stackoverflow.com/questions/tagged/go.
- Reportar errores de documentación (los `// TODO` en los comentarios de código).
- Mejorar los tutoriales oficiales en https://go.dev/doc/tutorial/.
- Traducir documentación al español.

### Buenas prácticas para contribuir

| Acción | Cómo |
|--------|------|
| Reportar bug | Ve a https://github.com/golang/go/issues, usa la plantilla |
| Proponer feature | Discútelo antes en la lista de correo `golang-dev` |
| Enviar parche | Usa Gerrit (https://go-review.googlesource.com) |
| Mejorar docs | Envía un CL en Gerrit o PR en repositorios de documentación |
| Preguntar | Usa la lista `golang-nuts` o el canal `#go-nuts` en Gophers Slack |

## Comparativa: Contribuir en Laravel vs Go

| Aspecto | Laravel | Go |
|---------|---------|-----|
| **Plataforma** | GitHub PRs | Gerrit Code Review |
| **CLA** | No requiere | Requiere CLA de Google |
| **Estilo de código** | PSR-2 + StyleCI | `gofmt` es la ley (no negociable) |
| **Tests** | PHPUnit | `go test` (obligatorio en cada CL) |
| **Discusión** | Issues + Discord | Listas de correo + Gerrit comments |
| **Ritmo de releases** | Mayor releases por año | Dos releases mayores por año (Agosto, Febrero) |
| **Documentación** | En el mismo repo | `go doc` + https://go.dev/doc/ |
| **Paquetes extendidos** | Laravel Packages | `golang.org/x/*` mantenidos por el equipo Go |

## Errores comunes

1. **Enviar un PR por GitHub** — El repositorio de `golang/go` en GitHub es un mirror. Los cambios se envían por Gerrit. No se aceptan PRs de GitHub.
2. **No pasar `gofmt` antes de enviar** — `gofmt` no es opcional. Es una barrera de entrada automática. Si tu código no está formateado con `gofmt`, será rechazado.
3. **Cambios grandes sin discusión previa** — Siempre discute cambios significativos en la lista `golang-dev` antes de escribir código. Un CL grande sin contexto tiene alta probabilidad de ser rechazado.
4. **Olvidar los tests** — Go no acepta cambios sin tests. El覆盖率 (coverage) debe ser alto.

## Buenas prácticas

- Instala `gofmt` y configúralo para que se ejecute al guardar.
- Usa `go vet` antes de enviar cualquier cambio.
- Empieza con contribuciones pequeñas (documentación, reportes de bug) antes de intentar cambios grandes.
- Únete a la comunidad Gophers en español (https://gophers.lat) para hacer preguntas en tu idioma.

## Ejercicio sugerido

> Encuentra un paquete de `golang.org/x` que uses o te interese. Lee su documentación, busca un TODO en los comentarios del código, e intenta enviar una mejora de documentación como primer CL.

## Siguientes pasos

- [Instalación y setup](/getting-started/instalacion-y-setup/)
