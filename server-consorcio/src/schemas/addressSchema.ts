import { z } from 'zod';

export const AddressSchema = z.object({
    cep: z.string().min(8, 'CEP inválido'),
    street: z.string().min(2, 'Logradouro é obrigatório'),
    number: z.string().min(1, 'Número é obrigatório'),
    complement: z.string().optional().nullable(),
    neighborhood: z.string().min(2, 'Bairro é obrigatório'),
    city: z.string().min(2, 'Cidade é obrigatória'),
    state: z.string().length(2, 'Estado (UF) deve ter 2 caracteres'),
});

export type AddressDTO = z.infer<typeof AddressSchema>;
