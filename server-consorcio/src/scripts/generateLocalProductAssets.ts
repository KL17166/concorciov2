import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database';

const targetDir = path.resolve(__dirname, '../../../zuvio-web/public/img/products');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

// SVG templates for high-end product representations
function createCarSvg(title: string, color: string, badge: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#1E293B"/>
    </linearGradient>
    <linearGradient id="carGrad" x1="0%" y1="0%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FF6D00"/>
      <stop offset="100%" stop-color="#FFA000"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="30" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <rect width="800" height="500" rx="24" fill="url(#bg)"/>
  
  <!-- Subtle Studio Lighting Grid -->
  <circle cx="400" cy="200" r="300" fill="${color}" opacity="0.08" filter="blur(60px)"/>
  <ellipse cx="400" cy="400" rx="320" ry="40" fill="#000000" opacity="0.4"/>

  <!-- Badge / Category -->
  <rect x="40" y="40" width="140" height="32" rx="16" fill="url(#accent)"/>
  <text x="110" y="61" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" letter-spacing="1">${badge}</text>

  <!-- Car Silhouette & Body -->
  <g filter="url(#shadow)">
    <!-- Main Body Contour -->
    <path d="M140 330 C180 330 200 320 250 270 C310 210 390 190 530 190 C620 190 670 240 700 280 C730 320 720 330 680 340 L160 340 Z" fill="url(#carGrad)"/>
    
    <!-- Roof & Windshield -->
    <path d="M280 260 C330 205 380 195 510 195 C580 195 620 230 650 265 Z" fill="#0F172A" opacity="0.85"/>
    
    <!-- Window Reflection Line -->
    <path d="M310 250 L450 205" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.3"/>

    <!-- Headlight / Glow -->
    <polygon points="680,290 730,300 700,320 660,310" fill="#FFF" opacity="0.9"/>
    <circle cx="700" cy="305" r="30" fill="#60A5FA" opacity="0.3" filter="blur(10px)"/>

    <!-- Wheels -->
    <!-- Front Wheel -->
    <circle cx="590" cy="340" r="48" fill="#1E293B"/>
    <circle cx="590" cy="340" r="38" fill="#334155"/>
    <circle cx="590" cy="340" r="20" fill="url(#accent)"/>
    
    <!-- Rear Wheel -->
    <circle cx="230" cy="340" r="48" fill="#1E293B"/>
    <circle cx="230" cy="340" r="38" fill="#334155"/>
    <circle cx="230" cy="340" r="20" fill="url(#accent)"/>
  </g>

  <!-- Title & Specs Overlay -->
  <text x="40" y="440" fill="#F8FAFC" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" letter-spacing="-0.5">${title}</text>
  <text x="40" y="468" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="500">Consórcio Katari · 0% de Juros · Entrega Garantida</text>
</svg>`;
}

function createMotoSvg(title: string, color: string, badge: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
  <defs>
    <linearGradient id="bgM" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B0F19"/>
      <stop offset="100%" stop-color="#1E1B4B"/>
    </linearGradient>
    <linearGradient id="motoAccent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="#FF6D00"/>
    </linearGradient>
  </defs>

  <rect width="800" height="500" rx="24" fill="url(#bgM)"/>
  <circle cx="400" cy="240" r="220" fill="${color}" opacity="0.15" filter="blur(50px)"/>

  <!-- Badge -->
  <rect x="40" y="40" width="140" height="32" rx="16" fill="url(#motoAccent)"/>
  <text x="110" y="61" fill="#FFFFFF" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" letter-spacing="1">${badge}</text>

  <!-- Moto Silhouette & Chassis -->
  <g>
    <!-- Rear Wheel -->
    <circle cx="220" cy="330" r="65" fill="#1E293B" stroke="#334155" stroke-width="6"/>
    <circle cx="220" cy="330" r="42" fill="#0F172A" stroke="${color}" stroke-width="4"/>

    <!-- Front Wheel -->
    <circle cx="580" cy="330" r="65" fill="#1E293B" stroke="#334155" stroke-width="6"/>
    <circle cx="580" cy="330" r="42" fill="#0F172A" stroke="${color}" stroke-width="4"/>

    <!-- Frame & Tank -->
    <path d="M220 330 L350 280 L440 220 L520 220 L580 330" stroke="#CBD5E1" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M360 250 C380 200 460 200 500 230 L380 280 Z" fill="url(#motoAccent)"/>
    <path d="M490 200 L540 160 L570 170" stroke="#CBD5E1" stroke-width="8" stroke-linecap="round" fill="none"/>

    <!-- Headlight -->
    <circle cx="560" cy="180" r="14" fill="#FFFFFF" opacity="0.95"/>
    <polygon points="560,180 720,140 700,280" fill="#FFFFFF" opacity="0.12"/>
  </g>

  <!-- Title -->
  <text x="40" y="440" fill="#F8FAFC" font-family="system-ui, sans-serif" font-size="28" font-weight="900">${title}</text>
  <text x="40" y="468" fill="#A5B4FC" font-family="system-ui, sans-serif" font-size="15" font-weight="500">Motos 2026 · Parcelas Reduzidas · Contemplação Rápida</text>
</svg>`;
}

function createTechSvg(title: string, brand: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
  <defs>
    <linearGradient id="bgT" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="screenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#6366F1"/>
    </linearGradient>
  </defs>

  <rect width="800" height="500" rx="24" fill="url(#bgT)"/>
  <circle cx="400" cy="220" r="180" fill="#38BDF8" opacity="0.15" filter="blur(60px)"/>

  <!-- Badge -->
  <rect x="40" y="40" width="150" height="32" rx="16" fill="#38BDF8"/>
  <text x="115" y="61" fill="#0F172A" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" letter-spacing="1">ELETRÔNICOS</text>

  <!-- Laptop Mockup -->
  <g transform="translate(180, 110)">
    <!-- Screen Shell -->
    <rect x="40" y="20" width="360" height="230" rx="14" fill="#334155" stroke="#64748B" stroke-width="4"/>
    <!-- Screen Display -->
    <rect x="52" y="32" width="336" height="206" rx="8" fill="url(#screenGrad)"/>
    <!-- Code / UI lines -->
    <rect x="70" y="60" width="160" height="12" rx="6" fill="#FFFFFF" opacity="0.8"/>
    <rect x="70" y="85" width="220" height="10" rx="5" fill="#FFFFFF" opacity="0.5"/>
    <rect x="70" y="105" width="190" height="10" rx="5" fill="#FFFFFF" opacity="0.5"/>
    <circle cx="340" cy="150" r="28" fill="#FFFFFF" opacity="0.2"/>

    <!-- Base / Keyboard -->
    <path d="M0 254 L440 254 L400 274 L40 274 Z" fill="#1E293B" stroke="#475569" stroke-width="2"/>
    <rect x="170" y="258" width="100" height="8" rx="4" fill="#0F172A"/>
  </g>

  <!-- Title -->
  <text x="40" y="440" fill="#F8FAFC" font-family="system-ui, sans-serif" font-size="28" font-weight="900">${title}</text>
  <text x="40" y="468" fill="#94A3B8" font-family="system-ui, sans-serif" font-size="15" font-weight="500">${brand} · Alta Performance · Garantia Nacional</text>
</svg>`;
}

function createLetterSvg(title: string, value: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
  <defs>
    <linearGradient id="bgL" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064E3B"/>
      <stop offset="100%" stop-color="#022C22"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCD34D"/>
      <stop offset="50%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
  </defs>

  <rect width="800" height="500" rx="24" fill="url(#bgL)"/>
  <circle cx="400" cy="220" r="200" fill="#10B981" opacity="0.2" filter="blur(60px)"/>

  <!-- Badge -->
  <rect x="40" y="40" width="180" height="32" rx="16" fill="url(#gold)"/>
  <text x="130" y="61" fill="#78350F" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" letter-spacing="1">CARTA DE CRÉDITO</text>

  <!-- Gold Certificate Emblem -->
  <g transform="translate(400, 220)">
    <circle cx="0" cy="0" r="85" fill="url(#gold)"/>
    <circle cx="0" cy="0" r="75" fill="#064E3B"/>
    <circle cx="0" cy="0" r="68" stroke="url(#gold)" stroke-width="2" fill="none" stroke-dasharray="6,4"/>
    
    <text x="0" y="-12" fill="#FCD34D" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" letter-spacing="2">CRÉDITO</text>
    <text x="0" y="16" fill="#FFFFFF" font-family="system-ui, sans-serif" font-size="22" font-weight="900" text-anchor="middle">${value}</text>
    <text x="0" y="36" fill="#A7F3D0" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">PODER DE COMPRA</text>
  </g>

  <!-- Title -->
  <text x="40" y="440" fill="#F8FAFC" font-family="system-ui, sans-serif" font-size="28" font-weight="900">${title}</text>
  <text x="40" y="468" fill="#6EE7B7" font-family="system-ui, sans-serif" font-size="15" font-weight="500">BB Consórcios · Poder de Compra à Vista · Sem Juros</text>
</svg>`;
}

async function main() {
    console.log('--- Generating Local SVG Assets in zuvio-web/public/img/products ---');

    const assets: Record<string, string> = {
        'corolla_cross.svg': createCarSvg('Toyota Corolla Cross 2026', '#38BDF8', 'SUV PREMIUM'),
        'corolla_cross_hybrid.svg': createCarSvg('Toyota Corolla Cross Hybrid 2026', '#10B981', 'HÍBRIDO 2026'),
        'honda_hrv.svg': createCarSvg('Honda HR-V EXL 2026', '#F59E0B', 'SUV COMPACTO'),
        'honda_city.svg': createCarSvg('Honda City Sedan EX 2026', '#818CF8', 'SEDAN MODERNO'),
        'hb20.svg': createCarSvg('Hyundai HB20 2025', '#EC4899', 'HATCH URBANO'),
        'tracker.svg': createCarSvg('Chevrolet Tracker 2025', '#FF6D00', 'SUV TURBO'),

        'yamaha_tenere.svg': createMotoSvg('Yamaha Ténéré 700 2026', '#38BDF8', 'TRAIL ADVENTURE'),
        'yamaha_fz25.svg': createMotoSvg('Yamaha Fazer FZ25 2026', '#6366F1', 'STREET NAKED'),
        'honda_titan.svg': createMotoSvg('Honda CG 160 Titan 2026', '#EF4444', 'LÍDER EM VENDAS'),

        'lenovo_ideapad.svg': createTechSvg('Lenovo IdeaPad 1 15 AMD', 'Lenovo Ryzen 5'),
        'acer_aspire.svg': createTechSvg('Acer Aspire 5 A515', 'Acer Intel Core i5'),
        'dell_inspiron.svg': createTechSvg('Dell Inspiron 15 3530', 'Dell 120Hz Full HD'),
        'dell_optiplex.svg': createTechSvg('Dell OptiPlex 7020 Micro', 'Dell Intel 14ª Geração'),
        'macbook_pro.svg': createTechSvg('MacBook Pro M4 Pro', 'Apple Silicon M4'),
        'pc_gamer.svg': createTechSvg('PC Gamer RTX 4070 Super', 'NVIDIA GeForce RTX'),

        'carta_imovel.svg': createLetterSvg('Carta de Crédito Imobiliária', 'R$ 300.000'),
        'carta_carro.svg': createLetterSvg('Carta de Crédito Automóvel', 'R$ 80.000'),
        'carta_moto.svg': createLetterSvg('Carta de Crédito Moto', 'R$ 25.000'),
        'carta_servicos.svg': createLetterSvg('Carta de Crédito Serviços', 'R$ 30.000'),
        'carta_50k.svg': createLetterSvg('Carta de Crédito R$ 50.000', 'R$ 50.000'),
        'carta_150k.svg': createLetterSvg('Carta de Crédito R$ 150.000', 'R$ 150.000'),
        'carta_500k.svg': createLetterSvg('Carta de Crédito R$ 500.000', 'R$ 500.000'),
        'carta_1250k.svg': createLetterSvg('Carta de Crédito R$ 1.250.000', 'R$ 1.25M')
    };

    for (const [filename, content] of Object.entries(assets)) {
        const filePath = path.join(targetDir, filename);
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Generated: ${filename}`);
    }

    console.log('--- Mapping Products to Local Public Assets ---');

    const productMap: Record<string, string> = {
        'Toyota Corolla Cross 2025': '/img/products/corolla_cross.svg',
        'Toyota Corolla Cross XRE 2026': '/img/products/corolla_cross.svg',
        'Toyota Corolla Cross 2027': '/img/products/corolla_cross.svg',
        'Toyota Corolla Cross XRX Hybrid 2026': '/img/products/corolla_cross_hybrid.svg',
        'Toyota Corolla Cross Hybrid 2027': '/img/products/corolla_cross_hybrid.svg',
        'Honda HR-V EXL 2026': '/img/products/honda_hrv.svg',
        'Honda HR-V 2026/2027': '/img/products/honda_hrv.svg',
        'Honda City Sedan EX 2026': '/img/products/honda_city.svg',
        'Honda City Sedan 2026': '/img/products/honda_city.svg',
        'Hyundai HB20 2025': '/img/products/hb20.svg',
        'Chevrolet Tracker 2025': '/img/products/tracker.svg',

        'Yamaha Ténéré 700 2026': '/img/products/yamaha_tenere.svg',
        'Yamaha Ténéré 700': '/img/products/yamaha_tenere.svg',
        'Yamaha Fazer FZ25 Connected 2026': '/img/products/yamaha_fz25.svg',
        'Yamaha Fazer FZ25 Connected': '/img/products/yamaha_fz25.svg',
        'Honda CG160 Titan 2026': '/img/products/honda_titan.svg',
        'Honda CG 160 Titan 2026': '/img/products/honda_titan.svg',

        'Lenovo IdeaPad 1 15 AMD': '/img/products/lenovo_ideapad.svg',
        'Acer Aspire 5 A515-57-51W5': '/img/products/acer_aspire.svg',
        'Dell Inspiron 15 3530': '/img/products/dell_inspiron.svg',
        'Dell OptiPlex 7020 Micro': '/img/products/dell_optiplex.svg',
        'MacBook Pro M4 Pro': '/img/products/macbook_pro.svg',
        'PC Gamer RTX 4070 Super': '/img/products/pc_gamer.svg',

        'Carta de Crédito Imobiliária R$ 300.000': '/img/products/carta_imovel.svg',
        'Carta de crédito para imóvel — Consórcio BB': '/img/products/carta_imovel.svg',
        'Carta de Crédito Automóvel R$ 80.000': '/img/products/carta_carro.svg',
        'Carta de crédito para carro — Consórcio BB': '/img/products/carta_carro.svg',
        'Carta de Crédito Moto R$ 25.000': '/img/products/carta_moto.svg',
        'Carta de crédito para moto — Consórcio BB': '/img/products/carta_moto.svg',
        'Carta de Crédito Serviços R$ 30.000': '/img/products/carta_servicos.svg',
        'Carta de crédito para serviços — Consórcio BB': '/img/products/carta_servicos.svg',
        'Carta de Crédito Honda HR-V EX — EasyHonda 84 meses': '/img/products/honda_hrv.svg',
        'Carta de Crédito R$ 50.000': '/img/products/carta_50k.svg',
        'Carta de Crédito R$ 150.000': '/img/products/carta_150k.svg',
        'Carta de Crédito R$ 500.000': '/img/products/carta_500k.svg',
        'Carta de Crédito R$ 1.250.000': '/img/products/carta_1250k.svg'
    };

    const products = await prisma.product.findMany();
    for (const prod of products) {
        const localUrl = productMap[prod.name] || '/img/products/corolla_cross.svg';
        await prisma.product.update({
            where: { id: prod.id },
            data: {
                imageUrl: localUrl,
                imageUrls: JSON.stringify([localUrl])
            }
        });
        console.log(`Linked [${prod.name}] -> ${localUrl}`);
    }

    console.log('--- All Assets Generated and DB Successfully Updated! ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
