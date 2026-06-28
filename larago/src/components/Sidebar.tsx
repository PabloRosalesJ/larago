import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { MenuIcon } from "lucide-react"

interface Section {
  id: string
  title: string
  pages: { id: string; title: string; slug: string }[]
}

interface SidebarProps {
  sections: Section[]
  currentSlug: string
  className?: string
}

function SidebarNav({ sections, currentSlug }: SidebarProps) {
  return (
    <nav className="flex flex-col gap-4">
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-1">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
            {section.title}
          </h4>
          <div className="flex flex-col gap-0.5">
            {section.pages.map((page) => (
              <a
                key={page.id}
                href={`/${page.slug}`}
                className={cn(
                  "px-2 py-1.5 text-sm rounded-md transition-colors",
                  currentSlug === page.slug
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {page.title}
              </a>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

export function Sidebar({ sections, currentSlug, className }: SidebarProps) {
  return (
    <>
      <aside className={cn("hidden lg:block", className)}>
        <ScrollArea className="h-[calc(100vh-4rem)]">
          <div className="p-4">
            <SidebarNav sections={sections} currentSlug={currentSlug} />
          </div>
        </ScrollArea>
      </aside>

      <div className="lg:hidden fixed bottom-4 right-4 z-40">
        <Sheet>
          <SheetTrigger render={<Button size="icon" variant="outline" />}>
            <MenuIcon className="size-4" />
            <span className="sr-only">Open menu</span>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Navegacion</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-8rem)]">
              <div className="p-4">
                <SidebarNav sections={sections} currentSlug={currentSlug} />
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
