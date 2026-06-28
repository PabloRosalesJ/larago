"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CodeBlock } from "@/components/ui/code-block"

interface MdContentProps {
  title: string
  description: string
  laravelUrl?: string
  goPackages?: string[]
  content: string
}

interface ParsedBlock {
  type: "text" | "code"
  content: string
  language?: string
  filename?: string
}

function parseMarkdownToBlocks(markdown: string): { sectionTitle: string; blocks: ParsedBlock[] }[] {
  const sections: { sectionTitle: string; blocks: ParsedBlock[] }[] = []
  const lines = markdown.split("\n")
  
  let currentSection: { sectionTitle: string; blocks: ParsedBlock[] } | null = null
  let currentTextBlock = ""
  let inCodeBlock = false
  let codeLanguage = ""
  let codeContent = ""

  const flushText = () => {
    if (currentTextBlock.trim()) {
      currentSection?.blocks.push({
        type: "text",
        content: currentTextBlock.trim(),
      })
      currentTextBlock = ""
    }
  }

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flushText()
      if (inCodeBlock && currentSection) {
        currentSection.blocks.push({
          type: "code",
          content: codeContent.trim(),
          language: codeLanguage || "text",
        })
        inCodeBlock = false
        codeContent = ""
      }
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = {
        sectionTitle: line.replace("## ", "").trim(),
        blocks: [],
      }
    } else if (line.startsWith("```")) {
      if (inCodeBlock) {
        currentSection?.blocks.push({
          type: "code",
          content: codeContent.trim(),
          language: codeLanguage || "text",
        })
        inCodeBlock = false
        codeContent = ""
        codeLanguage = ""
      } else {
        flushText()
        inCodeBlock = true
        codeLanguage = line.replace("```", "").trim()
      }
    } else if (inCodeBlock) {
      codeContent += line + "\n"
    } else {
      currentTextBlock += line + "\n"
    }
  }

  flushText()
  if (inCodeBlock && currentSection) {
    currentSection.blocks.push({
      type: "code",
      content: codeContent.trim(),
      language: codeLanguage || "text",
    })
  }
  if (currentSection) {
    sections.push(currentSection)
  }

  return sections
}

function getLanguageLabel(lang: string): string {
  const labels: Record<string, string> = {
    go: "Go",
    php: "PHP",
    typescript: "TypeScript",
    ts: "TypeScript",
    javascript: "JS",
    js: "JS",
    bash: "Terminal",
    sh: "Terminal",
    sql: "SQL",
    json: "JSON",
    yaml: "YAML",
    text: "Code",
  }
  return labels[lang] || lang.toUpperCase()
}

function detectLanguage(code: string): string {
  if (code.includes("package main") || code.includes("func main()")) return "go"
  if (code.includes("<?php") || code.includes("Route::") || code.includes("class ") && code.includes("extends")) return "php"
  if (code.includes("import ") && code.includes("from ")) return "typescript"
  if (code.includes("SELECT ") || code.includes("CREATE TABLE")) return "sql"
  if (code.includes("{") && code.includes(":")) return "json"
  return "text"
}

function renderInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline underline-offset-4 hover:no-underline">$1</a>')
}

function renderTextBlock(text: string): string {
  const lines = text.split("\n")
  const html: string[] = []
  let inList = false
  let listType: "ul" | "ol" = "ul"

  for (const line of lines) {
    const trimmed = line.trim()
    
    if (!trimmed) {
      if (inList) {
        html.push(listType === "ul" ? "</ul>" : "</ol>")
        inList = false
      }
      continue
    }

    if (trimmed.startsWith("- ")) {
      if (!inList || listType !== "ul") {
        if (inList) html.push("</ul>")
        html.push("<ul class='ml-6 list-disc flex flex-col gap-1'>")
        inList = true
        listType = "ul"
      }
      html.push(`<li>${renderInlineMarkdown(trimmed.slice(2))}</li>`)
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (!inList || listType !== "ol") {
        if (inList) html.push("</ol>")
        html.push("<ol class='ml-6 list-decimal flex flex-col gap-1'>")
        inList = true
        listType = "ol"
      }
      html.push(`<li>${renderInlineMarkdown(trimmed.replace(/^\d+\.\s/, ""))}</li>`)
    } else if (trimmed.startsWith("> ")) {
      html.push(`<blockquote class='border-l-2 border-muted-foreground/30 pl-4 italic text-muted-foreground'>${renderInlineMarkdown(trimmed.slice(2))}</blockquote>`)
    } else if (trimmed === "---") {
      html.push("<hr class='my-4' />")
    } else {
      html.push(`<p class='mb-2'>${renderInlineMarkdown(trimmed)}</p>`)
    }
  }

  if (inList) {
    html.push(listType === "ul" ? "</ul>" : "</ol>")
  }

  return html.join("\n")
}

function TextRenderer({ text }: { text: string }) {
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: renderTextBlock(text) }}
    />
  )
}

function getFilenameForCode(code: string, language: string): string {
  if (language === "go") {
    if (code.includes("package main")) return "main.go"
    if (code.includes("func Test")) return "_test.go"
    return "app.go"
  }
  if (language === "php") {
    if (code.includes("class ") && code.includes("Controller")) return "Controller.php"
    if (code.includes("Route::")) return "routes/web.php"
    return "app.php"
  }
  if (language === "bash" || language === "sh") return "terminal"
  if (language === "sql") return "schema.sql"
  if (language === "json") return "config.json"
  return `code.${language === "typescript" ? "ts" : language === "javascript" ? "js" : language}`
}

export function MdContent({ title, description, laravelUrl, goPackages, content }: MdContentProps) {
  const sections = parseMarkdownToBlocks(content)

  return (
    <article className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        {goPackages && goPackages.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {goPackages.map((pkg) => (
              <Badge key={pkg} variant="secondary">
                {pkg}
              </Badge>
            ))}
          </div>
        )}
        {laravelUrl && (
          <a
            href={laravelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Ver en Laravel docs →
          </a>
        )}
      </div>

      <Separator />

      {sections.map((section, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle>{section.sectionTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {section.blocks.map((block, j) => {
              if (block.type === "text") {
                return <TextRenderer key={j} text={block.content} />
              }
              const lang = block.language || detectLanguage(block.content)
              return (
                <CodeBlock
                  key={j}
                  code={block.content}
                  language={lang === "terminal" ? "bash" : lang}
                  filename={getFilenameForCode(block.content, lang)}
                  bodyClassName="bg-secondary"
                />
              )
            })}
          </CardContent>
        </Card>
      ))}
    </article>
  )
}
