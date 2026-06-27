export function cleanSlug(id: string): string {
  // ID format: "XX-section-XX-XX-slug"
  // Extract section name (without number) and the clean slug
  const match = id.match(/^\d{2}-([a-z-]+?)-\d{2}-\d{2}-(.+)$/);
  if (!match) return id;
  const section = match[1]; // e.g. "getting-started", "01-prologue" -> "prologue"
  const slug = match[2];    // e.g. "instalacion-y-setup"
  return `${section}/${slug}`;
}
