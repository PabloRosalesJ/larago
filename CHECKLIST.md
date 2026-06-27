# CHECKLIST — LaraGo

> Progreso del proyecto. Estado: ⏳ Pendiente | ✅ Completado | 🔄 En progreso

---

## Fase 1: Contexto
- [x] PLAN.md creado
- [x] CHECKLIST.md creado
- [x] CONTEXT.md creado
- [x] CONTENT/template.md creado
- [ ] Directorio `scraped/` con datos de scrapping

## Fase 2: Scraping de Laravel docs
- [ ] Scrapear estructura de páginas de Prólogo
- [ ] Scrapear estructura de páginas de Getting Started
- [ ] Scrapear estructura de páginas de Arquitectura
- [ ] Scrapear estructura de páginas de The Basics
- [ ] Scrapear estructura de páginas de Seguridad
- [ ] Scrapear estructura de páginas de Database
- [ ] Scrapear estructura de páginas de Digging Deeper
- [ ] Scrapear estructura de páginas de Testing

## Fase 3: Contenido — Prólogo (3 páginas)
- [ ] 01-01-filosofia-de-go-vs-laravel.md
- [ ] 01-02-migrar-mentalidad.md
- [ ] 01-03-contribuir-a-go-std.md

## Fase 4: Contenido — Getting Started (4 páginas)
- [ ] 02-01-instalacion-y-setup.md
- [ ] 02-02-configuracion.md
- [ ] 02-03-estructura-de-proyecto.md
- [ ] 02-04-build-y-deploy.md

## Fase 5: Contenido — Arquitectura (4 páginas)
- [ ] 03-01-ciclo-de-vida-request.md
- [ ] 03-02-di-sin-contenedor.md
- [ ] 03-03-bootstrapping-explicito.md
- [ ] 03-04-por-que-go-no-necesita-fachadas.md

## Fase 6: Contenido — The Basics (11 páginas)
- [ ] 04-01-routing.md
- [ ] 04-02-middleware.md
- [ ] 04-03-csrf.md
- [ ] 04-04-handlers-y-organizacion.md
- [ ] 04-05-leyendo-requests.md
- [ ] 04-06-construyendo-responses.md
- [ ] 04-07-templates.md
- [ ] 04-08-sessions.md
- [ ] 04-09-validacion.md
- [ ] 04-10-errores-como-valores.md
- [ ] 04-11-logging.md

## Fase 7: Contenido — Seguridad (5 páginas)
- [ ] 05-01-auth-desde-cero.md
- [ ] 05-02-autorizacion-explicita.md
- [ ] 05-03-encriptacion.md
- [ ] 05-04-hashing.md
- [ ] 05-05-reset-passwords.md

## Fase 8: Contenido — Database (5 páginas)
- [ ] 06-01-conectando-a-db.md
- [ ] 06-02-queries-con-stdlib.md
- [ ] 06-03-paginacion.md
- [ ] 06-04-migraciones.md
- [ ] 06-05-seed-data.md

## Fase 9: Contenido — GORM (7 páginas)
- [ ] 07-01-instalacion-y-setup.md
- [ ] 07-02-modelos.md
- [ ] 07-03-crud-basico.md
- [ ] 07-04-relaciones.md
- [ ] 07-05-hooks-y-eventos.md
- [ ] 07-06-migraciones-gorm.md
- [ ] 07-07-consejos-y-practicas.md

## Fase 10: Contenido — sqlc (7 páginas)
- [ ] 08-01-instalacion-y-setup.md
- [ ] 08-02-schema-y-modelos.md
- [ ] 08-03-queries-select.md
- [ ] 08-04-mutaciones.md
- [ ] 08-05-relaciones-con-sqlc.md
- [ ] 08-06-transacciones.md
- [ ] 08-07-integracion-continua.md

## Fase 11: Contenido — Comparativa (1 página)
- [ ] 09-01-tabla-comparativa-eloquent-gorm-sqlc.md

## Fase 12: Contenido — Digging Deeper (8 páginas)
- [ ] 10-01-caching.md
- [ ] 10-02-eventos.md
- [ ] 10-03-file-system.md
- [ ] 10-04-cliente-http.md
- [ ] 10-05-envio-emails.md
- [ ] 10-06-notificaciones.md
- [ ] 10-07-colas.md
- [ ] 10-08-cron-tareas.md

## Fase 13: Contenido — Testing (4 páginas)
- [ ] 11-01-testing-en-go.md
- [ ] 11-02-testing-http.md
- [ ] 11-03-testing-con-db.md
- [ ] 11-04-mocks.md

## Fase 14: Contenido — Contexto (1 página)
- [ ] 12-01-lo-que-laravel-tiene-y-go-no-necesita.md

## Fase 15: Build Astro + shadcn/ui
- [ ] Inicializar proyecto Astro
- [ ] Configurar shadcn/ui
- [ ] Crear layout de documentación
- [ ] Crear Sidebar component
- [ ] Crear CodeBlock component
- [ ] Crear ComparisonTable component
- [ ] Crear Callout component
- [ ] Configurar Content Collections
- [ ] Crear rutas dinámicas [...slug].astro
- [ ] Integrar todos los MD
- [ ] Build de prueba

## Fase 16: Verificación
- [ ] Build exitoso sin errores
- [ ] Navegación completa funcionando
- [ ] Responsive design OK
- [ ] Dark mode funcionando
- [ ] Links internos verificados
- [ ] Código Go verificado (sintaxis válida)

---

**Leyenda:**
- ✅ = Completado
- ⏳ = Pendiente
- 🔄 = En progreso
- ❌ = Bloqueado
