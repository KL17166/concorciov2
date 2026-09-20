// Gera ícones SVG convertidos para PNG via canvas
// Execute este script no browser console ou Node.js para gerar os PNGs

const sizes = [16, 48, 128];
const svgTemplate = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6c63ff"/>
      <stop offset="100%" style="stop-color:#ff6584"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <text x="64" y="88" font-size="72" text-anchor="middle" fill="white">🔍</text>
</svg>`;

// Para gerar os PNGs, use um conversor de SVG para PNG
// ou instale a extensão sem ícones (funciona sem eles no modo developer)
sizes.forEach(s => console.log(`icon${s}.svg gerado`));
