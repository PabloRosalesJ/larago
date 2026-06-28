"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CodeBlock } from "@/components/ui/code-block"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface MdContentProps {
  title: string
  description: string
  laravelUrl?: string
  goPackages?: string[]
  content: string
}

interface ParsedBlock {
  type: "text" | "code" | "heading" | "table"
  content: string
  level?: number
  language?: string
  filename?: string
  tableData?: { headers: string[]; rows: string[][] }
}

function parseMarkdownToBlocks(markdown: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = []
  const lines = markdown.split("\n")

  let currentTextBlock = ""
  let inCodeBlock = false
  let codeLanguage = ""
  let codeContent = ""
  let inTable = false
  let tableHeaders: string[] = []
  let tableRows: string[][] = []

  const flushText = () => {
    if (currentTextBlock.trim()) {
      blocks.push({
        type: "text",
        content: currentTextBlock.trim(),
      })
      currentTextBlock = ""
    }
  }

  const flushTable = () => {
    if (tableHeaders.length > 0) {
      blocks.push({
        type: "table",
        content: "",
        tableData: { headers: tableHeaders, rows: tableRows },
      })
      tableHeaders = []
      tableRows = []
      inTable = false
    }
  }

  for (const line of lines) {
    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        blocks.push({
          type: "code",
          content: codeContent.trim(),
          language: codeLanguage || "text",
        })
        inCodeBlock = false
        codeContent = ""
        codeLanguage = ""
      } else {
        flushText()
        flushTable()
        inCodeBlock = true
        codeLanguage = line.replace("```", "").trim()
      }
      continue
    }

    if (inCodeBlock) {
      codeContent += line + "\n"
      continue
    }

    // Tables
    if (line.trim().startsWith("|")) {
      const trimmed = line.trim()
      // Skip separator row (|---|---|)
      if (/^\|[\s-]+\|/.test(trimmed)) {
        inTable = true
        continue
      }
      const cells = trimmed
        .split("|")
        .filter((c) => c.trim() !== "")
        .map((c) => c.trim())
      if (!inTable && cells.length > 0 && tableHeaders.length === 0) {
        tableHeaders = cells
        inTable = true
      } else if (inTable) {
        tableRows.push(cells)
      }
      continue
    } else if (inTable) {
      flushTable()
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      flushText()
      const level = headingMatch[1].length
      blocks.push({
        type: "heading",
        content: headingMatch[2].trim(),
        level,
      })
      continue
    }

    // Regular text
    currentTextBlock += line + "\n"
  }

  flushText()
  flushTable()

  if (inCodeBlock) {
    blocks.push({
      type: "code",
      content: codeContent.trim(),
      language: codeLanguage || "text",
    })
  }

  return blocks
}

function detectLanguage(code: string): string {
  if (code.includes("package main") || code.includes("func main()")) return "go"
  if (code.includes("<?php") || code.includes("Route::")) return "php"
  if (code.includes("import ") && code.includes("from ")) return "typescript"
  if (code.includes("SELECT ") || code.includes("CREATE TABLE")) return "sql"
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
      html.push(`<blockquote class='border-l-2 border-muted-foreground/30 pl-4 italic text-muted-foreground my-2'>${renderInlineMarkdown(trimmed.slice(2))}</blockquote>`)
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

function HeadingBlock({ level, content }: { level: number; content: string }) {
  const rendered = renderInlineMarkdown(content)
  const className = "font-bold tracking-tight"

  switch (level) {
    case 1:
      return <h1 className={`${className} text-2xl mt-4 mb-2`} dangerouslySetInnerHTML={{ __html: rendered }} />
    case 2:
      return <h2 className={`${className} text-xl mt-4 mb-2`} dangerouslySetInnerHTML={{ __html: rendered }} />
    case 3:
      return <h3 className={`${className} text-lg mt-3 mb-1`} dangerouslySetInnerHTML={{ __html: rendered }} />
    case 4:
      return <h4 className={`${className} text-base mt-3 mb-1`} dangerouslySetInnerHTML={{ __html: rendered }} />
    case 5:
      return <h5 className={`${className} text-sm mt-2 mb-1`} dangerouslySetInnerHTML={{ __html: rendered }} />
    case 6:
      return <h6 className={`${className} text-sm mt-2 mb-1`} dangerouslySetInnerHTML={{ __html: rendered }} />
    default:
      return <h3 className={`${className} text-lg mt-3 mb-1`} dangerouslySetInnerHTML={{ __html: rendered }} />
  }
}

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-2 rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header, i) => (
              <TableHead key={i} className="font-medium">
                <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(header) }} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => (
                <TableCell key={j}>
                  <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(cell) }} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function TextRenderer({ text }: { text: string }) {
  return (
    <div
      className="max-w-none"
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
  const blocks = parseMarkdownToBlocks(content)

  return (
    <article className="flex flex-col gap-4">
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

      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return <HeadingBlock key={i} level={block.level || 2} content={block.content} />
        }
        if (block.type === "table" && block.tableData) {
          return <TableBlock key={i} headers={block.tableData.headers} rows={block.tableData.rows} />
        }
        if (block.type === "text") {
          return <TextRenderer key={i} text={block.content} />
        }
        if (block.type === "code") {
          const lang = block.language || detectLanguage(block.content)
          return (
            <CodeBlock
              key={i}
              code={block.content}
              language={lang === "terminal" ? "bash" : lang}
              filename={getFilenameForCode(block.content, lang)}
              bodyClassName="bg-secondary"
            />
          )
        }
        return null
      })}
    </article>
  )
}
