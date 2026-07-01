"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Heading {
  id: string
  text: string
  level: number
}

interface RightSidebarProps {
  content: string
}

function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = []
  const lines = markdown.split("\n")

  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)/)
    if (match) {
      const level = match[1].length
      const text = match[2]
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .trim()
      const id = text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")

      headings.push({ id, text, level })
    }
  }

  return headings
}

export function RightSidebar({ content }: RightSidebarProps) {
  const headings = extractHeadings(content)
  const [activeId, setActiveId] = useState<string>("")

  const handleScroll = useCallback(() => {
    const headingElements = headings
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[]

    let current = ""
    for (const el of headingElements) {
      const rect = el.getBoundingClientRect()
      if (rect.top <= 100) {
        current = el.id
      }
    }
    setActiveId(current)
  }, [headings])

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  if (headings.length === 0) return null

  return (
    <aside className="hidden xl:block sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 w-[280px] max-w-[280px] border-l">
      <ScrollArea className="h-full">
        <div className="p-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">
              En esta pagina
            </span>
            <nav className="flex flex-col gap-0.5">
              {headings.map((heading) => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  className={cn(
                    "text-sm transition-colors duration-150 rounded-md px-2 py-1 hover:text-foreground",
                    heading.level === 3 && "ml-3",
                    activeId === heading.id
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}
