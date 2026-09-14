

import { prisma } from '../config/database';

async function main() {
    console.log('--- Updating All Product Images to High-Res CORS-Friendly URLs ---');

    const imageMap: Record<string, string> = {
        // Carros
        'Toyota Corolla Cross': 'https://images.unsplash.com/photo-1590362891988-f778047020d6?w=800&auto=format&fit=crop&q=80',
        'Toyota Corolla Cross 2025': 'https://images.unsplash.com/photo-1590362891988-f778047020d6?w=800&auto=format&fit=crop&q=80',
        'Toyota Corolla Cross XRE 2026': 'https://images.unsplash.com/photo-1590362891988-f778047020d6?w=800&auto=format&fit=crop&q=80',
        'Toyota Corolla Cross XRX Hybrid 2026': 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80',
        'Honda HR-V EXL 2026': 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format&fit=crop&q=80',
        'Honda City Sedan EX 2026': 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop&q=80',
        'Hyundai HB20 2025': 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&auto=format&fit=crop&q=80',
        'Chevrolet Tracker 2025': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80',
        
        // Motos
        'Honda CG 160 Titan 2026': 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=800&auto=format&fit=crop&q=80',
        'Yamaha Fazer FZ25 Connected': 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&fit=crop&q=80',
        'Yamaha Ténéré 700': 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80',

        // Eletrônicos
        'Lenovo IdeaPad 1 15 AMD': 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&auto=format&fit=crop&q=80',
        'Acer Aspire 5 A515-57-51W5': 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80',
        'Dell Inspiron 15 3530': 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800&auto=format&fit=crop&q=80',
        'Dell OptiPlex 7020 Micro': 'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=800&auto=format&fit=crop&q=80',
        'PC Gamer RTX 4070 Super': 'https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=800&auto=format&fit=crop&q=80',
        'MacBook Pro M4 Pro': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80',

        // Cartas de Crédito
        'Carta de Crédito R$ 50.000': 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&auto=format&fit=crop&q=80',
        'Carta de Crédito R$ 150.000': 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&auto=format&fit=crop&q=80',
        'Carta de Crédito R$ 500.000': 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80',
        'Carta de Crédito R$ 1.250.000': 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80',
        'BB Carta de Crédito Automóvel': 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&auto=format&fit=crop&q=80',
        'BB Carta de Crédito Imóvel': 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&auto=format&fit=crop&q=80',
        'BB Carta de Crédito Moto': 'https://images.unsplash.com/photo-1558981803-3e15e4f52e59?w=800&auto=format&fit=crop&q=80',
        'BB Carta de Crédito Serviços': 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
        'Honda HR-V EXL — Plano EasyHonda': 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format&fit=crop&q=80'
    };

    const products = await prisma.product.findMany();

    for (const prod of products) {
        let newImageUrl = imageMap[prod.name];
        if (!newImageUrl) {
            if (prod.type === 'CARRO') newImageUrl = 'https://images.unsplash.com/photo-1590362891988-f778047020d6?w=800&auto=format&fit=crop&q=80';
            else if (prod.type === 'MOTO') newImageUrl = 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=800&auto=format&fit=crop&q=80';
            else if (prod.type === 'ELETRONICO') newImageUrl = 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&auto=format&fit=crop&q=80';
            else newImageUrl = 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&auto=format&fit=crop&q=80';
        }

        await prisma.product.update({
            where: { id: prod.id },
            data: {
                imageUrl: newImageUrl,
                imageUrls: JSON.stringify([newImageUrl])
            }
        });
        console.log(`Updated [${prod.name}] -> ${newImageUrl.substring(0, 45)}...`);
    }

    console.log('--- All Products Successfully Updated! ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
