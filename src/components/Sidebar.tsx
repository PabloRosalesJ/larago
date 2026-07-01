import * as React from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { MenuIcon, ChevronRightIcon } from "lucide-react"

interface Section {
  id: string
  title: string
  pages: { id: string; title: string; slug: string }[]
}

interface SidebarProps {
  sections: Section[]
  currentSlug: string
  basePath?: string
  className?: string
}

function SidebarLink({
  page,
  currentSlug,
  basePath = '/',
}: {
  page: { id: string; title: string; slug: string }
  currentSlug: string
  basePath?: string
}) {
  const linkRef = React.useRef<HTMLAnchorElement>(null)
  const [isHovered, setIsHovered] = React.useState(false)
  const [linkRect, setLinkRect] = React.useState<DOMRect | null>(null)

  const handleMouseEnter = () => {
    if (linkRef.current) {
      setLinkRect(linkRef.current.getBoundingClientRect())
    }
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setLinkRect(null)
  }

  return (
    <>
      <a
        ref={linkRef}
        href={`${basePath}${page.slug}`}
        className="relative block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span
          className={cn(
            "block px-3 py-1.5 text-sm rounded-md transition-colors duration-150",
            currentSlug === page.slug
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground"
          )}
        >
          <span className="block truncate">{page.title}</span>
        </span>
      </a>

      {isHovered && linkRect && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: linkRect.top,
            left: linkRect.left,
            width: "auto",
            minWidth: linkRect.width,
          }}
        >
          <span
            className={cn(
              "block px-3 py-1.5 text-sm rounded-md -translate-y-0.5",
              currentSlug === page.slug
                ? "bg-accent text-accent-foreground font-medium"
                : "bg-muted text-foreground"
            )}
          >
            <span className="block whitespace-nowrap">{page.title}</span>
          </span>
        </div>
      )}
    </>
  )
}

function CollapsibleSection({
  section,
  currentSlug,
  basePath = '/',
}: {
  section: Section
  currentSlug: string
  basePath?: string
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const hasActiveChild = section.pages.some((p) => currentSlug === p.slug)

  React.useEffect(() => {
    if (hasActiveChild) setIsOpen(true)
  }, [hasActiveChild])

  return (
    <div className="flex flex-col">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors w-full text-left",
          hasActiveChild
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <ChevronRightIcon
          className={cn(
            "h-3 w-3 shrink-0 transition-transform",
            isOpen && "rotate-90"
          )}
        />
        <span className="truncate">{section.title}</span>
      </button>
      {isOpen && (
        <div className="flex flex-col gap-0.5 ml-4 pl-3 border-l">
          {section.pages.map((page) => (
            <SidebarLink
              key={page.id}
              page={page}
              currentSlug={currentSlug}
              basePath={basePath}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SidebarNav({ sections, currentSlug, basePath }: SidebarProps) {
  return (
    <nav className="flex flex-col gap-1">
      {sections.map((section) => (
        <CollapsibleSection
          key={section.id}
          section={section}
          currentSlug={currentSlug}
          basePath={basePath}
        />
      ))}
    </nav>
  )
}

export function Sidebar({ sections, currentSlug, basePath, className }: SidebarProps) {
  return (
    <>
      <aside
        className={cn(
          "hidden lg:block sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 border-r w-[260px] max-w-[260px]",
          className
        )}
      >
        <ScrollArea className="h-full">
          <div className="p-4">
            <SidebarNav sections={sections} currentSlug={currentSlug} basePath={basePath} />
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
                <SidebarNav sections={sections} currentSlug={currentSlug} basePath={basePath} />
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
