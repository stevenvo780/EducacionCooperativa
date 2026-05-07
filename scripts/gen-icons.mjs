import sharp from 'sharp';
import fs from 'node:fs';

// SVG bigger than favicon for icons (preserves quality at 192/512)
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="mandy" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#e85d75"/>
      <stop offset="100%" style="stop-color:#d94a63"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#mandy)"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="288" font-weight="bold">A</text>
</svg>`;

// OG image 1200x630 with brand
const svgOg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0f"/>
      <stop offset="100%" style="stop-color:#12121a"/>
    </linearGradient>
    <linearGradient id="mandy" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#e85d75"/>
      <stop offset="100%" style="stop-color:#d94a63"/>
    </linearGradient>
    <linearGradient id="mandy2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#e85d75"/>
      <stop offset="100%" style="stop-color:#9333ea"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="120" cy="120" r="220" fill="#e85d75" opacity="0.08"/>
  <circle cx="1080" cy="510" r="220" fill="#9333ea" opacity="0.08"/>
  <rect x="80" y="100" width="120" height="120" rx="24" fill="url(#mandy)"/>
  <text x="140" y="186" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="74" font-weight="bold">A</text>
  <text x="240" y="166" fill="#e85d75" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="bold">Agora</text>
  <text x="240" y="216" fill="#9ca3af" font-family="system-ui, -apple-system, sans-serif" font-size="22">por Elenxos</text>
  <text x="80" y="370" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="800">El nuevo estándar para</text>
  <text x="80" y="440" fill="url(#mandy2)" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="800">investigación rigurosa</text>
  <text x="80" y="540" fill="#9ca3af" font-family="system-ui, -apple-system, sans-serif" font-size="26">Lógica formal ejecutable · Markdown académico · Terminales cloud</text>
</svg>`;

const out = '/home/operador/proyectos/humanizar/EducacionCooperativa/AgoraFront/public';

await sharp(Buffer.from(svgIcon)).png().resize(192, 192).toFile(out + '/icon-192.png');
await sharp(Buffer.from(svgIcon)).png().resize(512, 512).toFile(out + '/icon-512.png');
await sharp(Buffer.from(svgIcon)).png().resize(180, 180).toFile(out + '/apple-touch-icon.png');
await sharp(Buffer.from(svgOg)).png().resize(1200, 630).toFile(out + '/og-image.png');

const sizes = await Promise.all(['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'og-image.png'].map(async f => {
  const stat = fs.statSync(out + '/' + f);
  return f + ': ' + Math.round(stat.size / 1024) + 'KB';
}));
console.log('Generated:\n' + sizes.join('\n'));
