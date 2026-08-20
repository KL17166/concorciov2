import { AddressDTO, AddressSchema } from '../schemas/addressSchema';
import { logger } from '../config/logger';

/**
 * Safely parses a JSON string or object into an AddressDTO.
 * Returns null or empty object fallback on invalid data without crashing.
 */
export function parseAddress(rawAddress: any): AddressDTO | null {
    if (!rawAddress) return null;

    let parsed = rawAddress;
    if (typeof rawAddress === 'string') {
        try {
            parsed = JSON.parse(rawAddress);
        } catch (e) {
            logger.warn('Could not parse address JSON string:', rawAddress);
            return null;
        }
    }

    const validation = AddressSchema.safeParse(parsed);
    if (validation.success) {
        return validation.data;
    }

    // Fallback: If partial fields exist, return normalized record
    if (typeof parsed === 'object' && parsed !== null) {
        return {
            cep: parsed.cep || parsed.address_cep || '',
            street: parsed.street || parsed.address_street || '',
            number: parsed.number || parsed.address_number || '',
            complement: parsed.complement || parsed.address_complement || null,
            neighborhood: parsed.neighborhood || parsed.address_neighborhood || '',
            city: parsed.city || parsed.address_city || '',
            state: parsed.state || parsed.address_state || ''
        };
    }

    return null;
}

/**
 * Serializes an address object or form fields into a JSON string for Prisma storage.
 */
export function stringifyAddress(data: Record<string, any>): string {
    const addressObj = {
        cep: data.cep || data.address_cep || '',
        street: data.street || data.address_street || '',
        number: data.number || data.address_number || '',
        complement: data.complement || data.address_complement || '',
        neighborhood: data.neighborhood || data.address_neighborhood || '',
        city: data.city || data.address_city || '',
        state: data.state || data.address_state || ''
    };

    return JSON.stringify(addressObj);
}
