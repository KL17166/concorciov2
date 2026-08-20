import { z } from 'zod';

export const CreateProductSchema = z.object({
    name: z.string().min(2, 'Nome do produto é obrigatório'),
    description: z.string().min(2, 'Descrição é obrigatória'),
    type: z.enum(['MOTO', 'CARRO', 'CARTA_CREDITO', 'ELETRONICO', 'IMOVEL', 'SERVICO']),
    category: z.string().min(1, 'Categoria é obrigatória'),
    price: z.coerce.number().positive('Preço deve ser positivo'),
    imageUrl: z.string().min(1, 'Imagem principal é obrigatória'),
    imageUrls: z.string().or(z.array(z.string())).optional().default('[]'),
    brand: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    year: z.coerce.number().optional().nullable(),
    specs: z.string().or(z.record(z.string(), z.any())).optional().nullable(),
    minDuration: z.coerce.number().min(1).default(12),
    maxDuration: z.coerce.number().min(1).default(60),
    adminFeeRate: z.coerce.number().min(0).default(15.0),
    isFeatured: z.boolean().or(z.string()).optional().default(false),
    isPopular: z.boolean().or(z.string()).optional().default(false),
    active: z.boolean().or(z.string()).optional().default(true)
});

export type CreateProductDTO = z.infer<typeof CreateProductSchema>;
