---
title: "Envío de emails"
description: "Envía emails HTML/text con net/smtp, equivalente a Mail::to de Laravel"
order: 5
section: "10-digging-deeper"
laravel_url: "https://laravel.com/docs/13.x/mail"
go_packages: ["net/smtp", "mime/multipart", "bytes", "embed"]
---

# Envío de emails

**TL;DR** — Laravel tiene `Mail::to($user)->send(new OrderConfirmation($order))` con Mailable, Blade templates, y drivers (SMTP, Mailgun, SES). Go usa `net/smtp.SendMail()` para lo básico, con construcción manual del mensaje MIME.

---

## En Laravel

```php
// Laravel: Mailables
class OrderConfirmation extends Mailable
{
    public function __construct(public Order $order) {}

    public function build(): static
    {
        return $this->from('shop@example.com')
                    ->subject('Confirmación de pedido')
                    ->view('emails.order-confirmation');
    }
}

// Envío
Mail::to($user->email)->send(new OrderConfirmation($order));
```

Laravel abstrae toda la complejidad SMTP, MIME, y templates. El developer solo define el Mailable.

## En Go

`net/smtp` es de bajo nivel. Para enviar emails necesitas construir manualmente el mensaje en formato MIME o usar una librería como `gomail` para algo más serio.

### Envío básico (texto plano)

```go
package main

import (
    "fmt"
    "net/smtp"
    "os"
)

func sendPlainText(to, subject, body string) error {
    from := os.Getenv("SMTP_FROM")
    password := os.Getenv("SMTP_PASSWORD")
    host := os.Getenv("SMTP_HOST")
    port := os.Getenv("SMTP_PORT")

    auth := smtp.PlainAuth("", from, password, host)

    msg := []byte(fmt.Sprintf(
        "From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s\r\n",
        from, to, subject, body,
    ))

    addr := fmt.Sprintf("%s:%s", host, port)
    return smtp.SendMail(addr, auth, from, []string{to}, msg)
}
```

### Email HTML con estructura MIME

```go
func sendHTML(to, subject, htmlBody string) error {
    from := os.Getenv("SMTP_FROM")

    headers := make(map[string]string)
    headers["From"] = from
    headers["To"] = to
    headers["Subject"] = subject
    headers["MIME-Version"] = "1.0"
    headers["Content-Type"] = "text/html; charset=\"utf-8\""

    var msg bytes.Buffer
    for k, v := range headers {
        msg.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
    }
    msg.WriteString("\r\n")
    msg.WriteString(htmlBody)

    return smtp.SendMail(
        fmt.Sprintf("%s:%s", os.Getenv("SMTP_HOST"), os.Getenv("SMTP_PORT")),
        smtp.PlainAuth("", from, os.Getenv("SMTP_PASSWORD"), os.Getenv("SMTP_HOST")),
        from, []string{to}, msg.Bytes(),
    )
}
```

### Email con template HTML

```go
//go:embed templates/order-confirmation.html
var orderTemplate string

type OrderData struct {
    OrderID string
    Total   float64
    Items   []string
}

func sendOrderConfirmation(to string, data OrderData) error {
    var buf bytes.Buffer
    tmpl := template.Must(template.New("email").Parse(orderTemplate))
    tmpl.Execute(&buf, data)

    return sendHTML(to, "Confirmación de pedido", buf.String())
}
```

### Email con adjuntos (multipart)

```go
func sendWithAttachment(to, subject, body string, filename string, content []byte) error {
    from := os.Getenv("SMTP_FROM")

    var buf bytes.Buffer
    writer := multipart.NewWriter(&buf)

    // Headers
    buf.WriteString(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\n", from, to, subject))
    buf.WriteString(fmt.Sprintf("MIME-Version: 1.0\r\n"))
    buf.WriteString(fmt.Sprintf("Content-Type: multipart/mixed; boundary=\"%s\"\r\n\r\n", writer.Boundary()))

    // Parte texto
    part, _ := writer.CreatePart(textproto.MIMEHeader{
        "Content-Type": {"text/html; charset=\"utf-8\""},
    })
    part.Write([]byte(body))

    // Adjunto
    part, _ = writer.CreatePart(textproto.MIMEHeader{
        "Content-Type":              {"application/octet-stream"},
        "Content-Disposition":       {fmt.Sprintf("attachment; filename=\"%s\"", filename)},
        "Content-Transfer-Encoding": {"base64"},
    })
    part.Write(content)

    writer.Close()

    return smtp.SendMail(
        fmt.Sprintf("%s:%s", os.Getenv("SMTP_HOST"), os.Getenv("SMTP_PORT")),
        smtp.PlainAuth("", from, os.Getenv("SMTP_PASSWORD"), os.Getenv("SMTP_HOST")),
        from, []string{to}, buf.Bytes(),
    )
}
```

### Helper con opciones

```go
type Email struct {
    To       string
    Subject  string
    HTML     string
    Text     string
    From     string
}

func (e *Email) Send() error {
    // Construir mensaje multipart/alternative
    var buf bytes.Buffer

    headers := []string{
        fmt.Sprintf("From: %s", e.From),
        fmt.Sprintf("To: %s", e.To),
        fmt.Sprintf("Subject: %s", e.Subject),
        "MIME-Version: 1.0",
        "Content-Type: multipart/alternative; boundary=\"alt\"",
    }

    for _, h := range headers {
        buf.WriteString(h + "\r\n")
    }
    buf.WriteString("\r\n")

    // Versión texto
    buf.WriteString("--alt\r\n")
    buf.WriteString("Content-Type: text/plain; charset=\"utf-8\"\r\n\r\n")
    buf.WriteString(e.Text + "\r\n")

    // Versión HTML
    buf.WriteString("--alt\r\n")
    buf.WriteString("Content-Type: text/html; charset=\"utf-8\"\r\n\r\n")
    buf.WriteString(e.HTML + "\r\n")
    buf.WriteString("--alt--\r\n")

    return smtp.SendMail(
        addr(), auth(), e.From, []string{e.To}, buf.Bytes(),
    )
}
```

## Comparativa: Email

| Aspecto | Laravel | Go (stdlib) |
|---------|---------|-------------|
| **API** | `Mail::to()->send(new Mailable)` | `smtp.SendMail(addr, auth, from, to, msg)` |
| **Templates** | Blade | `html/template` |
| **Adjuntos** | `->attach('file.pdf')` | Manual (multipart MIME) |
| **Colas** | `->queue(new Mailable)` | Manual (con canal/worker) |
| **Drivers** | SMTP, Mailgun, SES, Postmark, Log | SMTP únicamente |
| **Preview** | `Mail::fake()` | Servidor SMTP de prueba (mailhog) |
| **CSS inlining** | Automático | No nativo |
| **Logging** | Driver `log` | No nativo |

## Errores comunes

1. **Usar `PlainAuth` sin TLS** — `PlainAuth` envía credenciales en texto plano. Siempre usa conexión TLS (puerto 587 o 465).
2. **No escapar headers** — Un `Subject` con saltos de línea puede ser un vector de inyección SMTP. Usa `mime.QEncoding`.
3. **Olvidar el CRLF** — SMTP requiere `\r\n` (CRLF), no solo `\n`. Los emails pueden fallar si usas solo `\n`.
4. **Hardcodear credenciales SMTP** — Usa variables de entorno. Nunca commits credenciales al repositorio.

## Buenas prácticas

- Para producción, considera `gomail` o `go-mail` (wrappers sobre `net/smtp` que manejan MIME correctamente).
- Usa templates HTML con `html/template` para escapar automáticamente variables.
- Siempre incluye versión texto plano (`text/plain`) además de HTML para mejor deliverability.
- Configura SPF, DKIM, y DMARC en tu dominio para evitar que los emails caigan en spam.

## Ejercicio sugerido

> Crea una función `SendWelcomeEmail(email, name string)` que lea un template HTML embebido, renderice el nombre del usuario, y envíe el email vía SMTP. Usa variables de entorno para la configuración SMTP.

## Siguientes pasos

- [Notificaciones multicanal](/digging-deeper/notificaciones/)
- [Colas y worker pools](/digging-deeper/colas/)

---

*¿Algo no claro? [Abre un issue](https://github.com/yourusername/larago/issues) y ayúdanos a mejorar.*
