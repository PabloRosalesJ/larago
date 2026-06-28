import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface MarkdownRendererProps {
  content: string
  frontmatter: {
    title: string
    description: string
    laravel_url?: string
    go_packages?: string[]
  }
}

function parseMarkdownSections(content: string) {
  const sections: { type: string; title: string; content: string }[] = []
  const lines = content.split("\n")
  let currentSection: { type: string; title: string; content: string } | null = null

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentSection) {
        sections.push(currentSection)
      }
      const title = line.replace("## ", "").trim()
      const type = title.toLowerCase().includes("laravel")
        ? "laravel"
        : title.toLowerCase().includes("go")
        ? "go"
        : title.toLowerCase().includes("comparativa")
        ? "comparativa"
        : title.toLowerCase().includes("ejercicio")
        ? "ejercicio"
        : title.toLowerCase().includes("siguiente")
        ? "siguientes"
        : title.toLowerCase().includes("error")
        ? "errores"
        : title.toLowerCase().includes("buena")
        ? "buenas"
        : "default"
      currentSection = { type, title, content: "" }
    } else if (currentSection) {
      currentSection.content += line + "\n"
    }
  }
  if (currentSection) {
    sections.push(currentSection)
  }
  return sections
}

function formatMarkdown(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/g, "").replace(/```$/g, "")
      return `<pre class="rounded-lg bg-muted p-4 overflow-x-auto"><code>${code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</code></pre>`
    })
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1.5 py-0.5 text-sm">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline underline-offset-4 hover:no-underline">$1</a>')
    .replace(/\n\n/g, "</p><p>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>")
}

export function MarkdownRenderer({ content, frontmatter }: MarkdownRendererProps) {
  const sections = parseMarkdownSections(content)

  return (
    <article className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{frontmatter.title}</h1>
        <p className="text-muted-foreground">{frontmatter.description}</p>
        {frontmatter.go_packages && frontmatter.go_packages.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {frontmatter.go_packages.map((pkg) => (
              <Badge key={pkg} variant="secondary">
                {pkg}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {sections.map((section, i) => {
        if (section.type === "laravel" || section.type === "go") {
          return null
        }

        if (section.type === "comparativa") {
          return (
            <Card key={i}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(section.content) }}
                />
              </CardContent>
            </Card>
          )
        }

        return (
          <Card key={i}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: formatMarkdown(section.content) }}
              />
            </CardContent>
          </Card>
        )
      })}
    </article>
  )
}
