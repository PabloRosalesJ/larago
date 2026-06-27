import { getCollection } from 'astro:content';
const docs = await getCollection('docs');
console.log("Total docs:", docs.length);
console.log("First doc ID:", docs[0]?.id);
console.log("First doc title:", docs[0]?.data?.title);
console.log("Sample IDs:");
docs.slice(0, 5).forEach(d => console.log("  ", d.id));
