// Génère les icônes PWA (192, 512, maskable, apple-touch) à partir de
// public/brand/logo-icon.png si présent, sinon d'une icône temporaire SVG.
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'icons');
mkdirSync(out, { recursive: true });
const official = join(root, 'public', 'brand', 'logo-icon.png');

const placeholder = (padding) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0B1F33"/>
  <circle cx="256" cy="256" r="${168 - padding}" fill="none" stroke="#E30613" stroke-width="${34 - padding / 6}"/>
  <text x="256" y="${300 - padding / 8}" font-family="Montserrat, Arial Black, Arial, sans-serif" font-size="${132 - padding / 2}" font-weight="900" text-anchor="middle" fill="#FFFFFF">SOS</text>
</svg>`);

async function render(size, name, padding = 0) {
  const src = existsSync(official) ? sharp(official).resize(size, size, { fit: 'contain', background: '#0B1F33' }) : sharp(placeholder(padding)).resize(size, size);
  await src.png().toFile(join(out, name));
  console.log('✓', name);
}

await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(512, 'icon-maskable-512.png', 48);
await render(180, 'apple-touch-icon.png');
