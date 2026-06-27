import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const docsDir = 'src/content/docs';

// Transform: /NN-section/NN-NN-slug -> /section/slug
// Also adds trailing slash
function fixLinks(content) {
  return content.replace(
    /\]\(\/(\d{2}-[a-z-]+)\/(\d{2}-\d{2}-[a-z0-9-]+)\)/g,
    (match, section, slug) => {
      const cleanSection = section.replace(/^\d{2}-/, '');
      const cleanSlug = slug.replace(/^\d{2}-\d{2}-/, '');
      return `](/${cleanSection}/${cleanSlug}/)`;
    }
  );
}

const files = readdirSync(docsDir).filter(f => f.endsWith('.md'));
let total = 0;

for (const file of files) {
  const path = join(docsDir, file);
  const original = readFileSync(path, 'utf-8');
  const fixed = fixLinks(original);
  if (original !== fixed) {
    writeFileSync(path, fixed);
    total++;
    console.log(`Fixed: ${file}`);
  }
}

console.log(`\n✅ ${total} files updated`);

// Also fix CONTENT/ dir
const contentDir = '../CONTENT';
try {
  const sections = readdirSync(contentDir).filter(f => f.match(/^\d{2}-/));
  let total2 = 0;
  for (const section of sections) {
    const sectionPath = join(contentDir, section);
    const files2 = readdirSync(sectionPath).filter(f => f.endsWith('.md'));
    for (const file of files2) {
      const path = join(sectionPath, file);
      const original = readFileSync(path, 'utf-8');
      const fixed = fixLinks(original);
      if (original !== fixed) {
        writeFileSync(path, fixed);
        total2++;
        console.log(`Fixed: CONTENT/${section}/${file}`);
      }
    }
  }
  console.log(`\n✅ ${total2} CONTENT files updated`);
} catch (e) {
  console.log('CONTENT dir not found, skipping');
}
