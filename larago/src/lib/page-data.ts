import { getCollection } from "astro:content"

export interface PageEntry {
  id: string
  title: string
  slug: string
  section: string
  order: number
  description: string
}

export interface NavItem {
  title: string
  slug: string
}

let cachedPages: PageEntry[] | null = null

export async function getAllPages(): Promise<PageEntry[]> {
  if (cachedPages) return cachedPages

  const docs = await getCollection("docs")
  cachedPages = docs
    .filter((doc) => !doc.id.endsWith("/template"))
    .map((doc) => ({
      id: doc.id,
      title: doc.data.title,
      slug: doc.id,
      section: doc.data.section,
      order: doc.data.order,
      description: doc.data.description,
    }))
    .sort(
      (a, b) =>
        a.section.localeCompare(b.section) || a.order - b.order
    )

  return cachedPages
}

export async function getPrevNext(
  currentSlug: string
): Promise<{ prev: NavItem | null; next: NavItem | null }> {
  const pages = await getAllPages()
  const idx = pages.findIndex((p) => p.slug === currentSlug)

  return {
    prev: idx > 0
      ? { title: pages[idx - 1].title, slug: pages[idx - 1].slug }
      : null,
    next: idx < pages.length - 1
      ? { title: pages[idx + 1].title, slug: pages[idx + 1].slug }
      : null,
  }
}
