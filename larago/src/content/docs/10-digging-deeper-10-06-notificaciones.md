---
title: "Notificaciones multicanal"
description: "Implementa un sistema de notificaciones con interfaces y canales, equivalente a Notifiable + notify de Laravel"
order: 6
section: "10-digging-deeper"
laravel_url: "https://laravel.com/docs/13.x/notifications"
go_packages: ["net/smtp", "fmt", "log"]
---

# Notificaciones multicanal

**TL;DR** — Laravel tiene `$user->notify(new InvoicePaid($invoice))` con canales (mail, database, broadcast, slack, sms). En Go defines interfaces para cada canal y un `Notifier` que las orquesta, sin herencia ni traits.

---

## En Laravel

```php
// Laravel: Notificación multicanal
class InvoicePaid extends Notification
{
    public function via($notifiable): array
    {
        return ['mail', 'database']; // canales
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->line('Tu factura ha sido pagada.')
            ->action('Ver factura', url('/invoices/...'));
    }

    public function toDatabase($notifiable): array
    {
        return ['invoice_id' => $this->invoice->id];
    }
}

// Envío
$user->notify(new InvoicePaid($invoice));
```

Laravel usa el trait `Notifiable` en el modelo `User`. Cada notificación define los canales y el contenido para cada uno.

## En Go

Go logra lo mismo con **interfaces**. No necesitas traits ni herencia: un `Notifier` recibe un destinatario que implementa `Notifiable` y envía por cada canal registrado.

### Interfaces base

```go
package notifications

// Notifiable es cualquier entidad que puede recibir notificaciones
type Notifiable interface {
    Email() string
    Phone() string
    ID() string
}

// Channel define cómo se envía una notificación
type Channel interface {
    Send(to Notifiable, notification Notification) error
    Name() string
}
```

### Notificación

```go
type Notification interface {
    Channels() []string
    ToEmail(to Notifiable) (string, string) // subject, body
    ToPush(to Notifiable) (string, string)  // title, body
}
```

### Canales concretos

```go
type EmailChannel struct {
    from string
}

func (c *EmailChannel) Name() string { return "email" }

func (c *EmailChannel) Send(to Notifiable, n Notification) error {
    if email := to.Email(); email == "" {
        return fmt.Errorf("no email for %s", to.ID())
    }
    subject, body := n.ToEmail(to)
    return sendEmail(c.from, to.Email(), subject, body)
}

type ConsoleChannel struct{}

func (c *ConsoleChannel) Name() string { return "console" }

func (c *ConsoleChannel) Send(to Notifiable, n Notification) error {
    _, body := n.ToEmail(to)
    log.Printf("[NOTIFICATION] To: %s | %s", to.ID(), body)
    return nil
}
```

### Notifier

```go
type Notifier struct {
    channels map[string]Channel
}

func New(channels ...Channel) *Notifier {
    n := &Notifier{channels: make(map[string]Channel)}
    for _, ch := range channels {
        n.channels[ch.Name()] = ch
    }
    return n
}

func (n *Notifier) Send(to Notifiable, notification Notification) error {
    for _, name := range notification.Channels() {
        ch, ok := n.channels[name]
        if !ok {
            continue
        }
        if err := ch.Send(to, notification); err != nil {
            return fmt.Errorf("channel %s: %w", name, err)
        }
    }
    return nil
}

// SendAsync envía por todos los canales concurrentemente
func (n *Notifier) SendAsync(to Notifiable, notification Notification) {
    var wg sync.WaitGroup
    for _, name := range notification.Channels() {
        ch, ok := n.channels[name]
        if !ok {
            continue
        }
        wg.Add(1)
        go func(c Channel) {
            defer wg.Done()
            if err := c.Send(to, notification); err != nil {
                log.Printf("Error sending via %s: %v", c.Name(), err)
            }
        }(ch)
    }
    wg.Wait()
}
```

### Uso completo

```go
type User struct {
    ID    string
    Name  string
    Email string
}

func (u User) Email() string { return u.Email }
func (u User) Phone() string { return "" }
func (u User) ID() string    { return u.ID }

type InvoicePaid struct {
    InvoiceID string
    Amount    float64
}

func (n InvoicePaid) Channels() []string {
    return []string{"email", "console"}
}

func (n InvoicePaid) ToEmail(to Notifiable) (string, string) {
    body := fmt.Sprintf("Hola %s, tu factura %s por $%.2f ha sido pagada.",
        to.ID(), n.InvoiceID, n.Amount)
    return "Factura pagada", body
}

func (n InvoicePaid) ToPush(to Notifiable) (string, string) {
    return "Pago recibido",
        fmt.Sprintf("Factura %s pagada - $%.2f", n.InvoiceID, n.Amount)
}

func main() {
    notifier := notifications.New(
        &notifications.EmailChannel{from: "billing@example.com"},
        &notifications.ConsoleChannel{},
    )

    user := User{ID: "42", Name: "Juan", Email: "juan@go.dev"}

    notifier.Send(user, InvoicePaid{
        InvoiceID: "INV-001",
        Amount:    199.99,
    })
}
```

### Notificaciones vía canales (pub/sub)

```go
// Canal basado en canales de Go para procesamiento asíncrono
type NotificationEvent struct {
    To           Notifiable
    Notification Notification
}

type ChannelNotifier struct {
    events chan NotificationEvent
}

func NewChannelNotifier(buffer int) *ChannelNotifier {
    cn := &ChannelNotifier{
        events: make(chan NotificationEvent, buffer),
    }
    go cn.process()
    return cn
}

func (cn *ChannelNotifier) Send(to Notifiable, n Notification) {
    cn.events <- NotificationEvent{To: to, Notification: n}
}

func (cn *ChannelNotifier) process() {
    for evt := range cn.events {
        notifier.Send(evt.To, evt.Notification)
    }
}
```

## Comparativa: Notificaciones

| Aspecto | Laravel | Go (stdlib) |
|---------|---------|-------------|
| **Destinatario** | Modelo con `Notifiable` trait | Struct que implementa interfaz `Notifiable` |
| **Canales** | mail, database, broadcast, slack, vonage, etc. | Interfaces `Channel` (tú los implementas) |
| **Envío** | `$user->notify(new Notification)` | `notifier.Send(user, notification)` |
| **Async** | `->notifyLater(...)` | `SendAsync()` con goroutines |
| **Cola** | Integrado con jobs | Manual (canal + workers) |
| **Database** | Canal automático | Implementación propia |
| **Broadcast** | Pusher, Reverb, etc. | WebSockets / SSE manual |

## Errores comunes

1. **Acoplar la notificación al canal** — Una notificación no debe saber cómo se envía. Separa contenido (Notification) de transporte (Channel).
2. **Enviar sincrónicamente canales lentos** — Email y SMS son lentos. Usa `SendAsync` o encola en un worker.
3. **No verificar disponibilidad del canal** — Si el usuario no tiene email, no intentes enviar por el canal email. La interfaz `Notifiable` puede devolver strings vacías.
4. **Reinventar Broadcast** — Para notificaciones en tiempo real, considera Server-Sent Events (SSE) con `net/http` en lugar de WebSockets.

## Buenas prácticas

- Modela cada canal como una struct que implementa `Channel`. Es fácil de testear y reemplazar.
- Define `Notification` como interfaz pequeña; cada notificación concreta implementa los métodos relevantes.
- Usa canales con buffer para no bloquear al llamante en notificaciones async.
- Para múltiples destinatarios, itera y llama `Send` para cada uno.

## Ejercicio sugerido

> Implementa un canal `SlackChannel` que envíe notificaciones a un webhook de Slack. Crea una notificación `DeployFailed` que se envíe por Slack y Console cuando un deploy falle. El SlackChannel debe enviar un JSON POST al webhook.

## Siguientes pasos

- [Colas y worker pools](/digging-deeper/colas/)
- [Eventos y pub/sub](/digging-deeper/eventos/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
