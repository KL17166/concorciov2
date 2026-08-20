/**
 * Safe parser for imageUrls (stored as JSON string or arrays in the DB).
 */
export function safeParseImageUrls(imageUrls: any): string[] {
    if (!imageUrls) return [];
    if (Array.isArray(imageUrls)) return imageUrls;
    if (typeof imageUrls !== 'string') return [];

    try {
        const parsed = JSON.parse(imageUrls);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === 'string') return [parsed];
        return [];
    } catch (e) {
        try {
            const normalized = imageUrls.replace(/'/g, '"').replace(/,\s*]/g, ']');
            const parsed = JSON.parse(normalized);
            if (Array.isArray(parsed)) return parsed;
            return [];
        } catch (e2) {
            if (imageUrls.startsWith('http')) return [imageUrls];
            return [];
        }
    }
}

/**
 * Safe parser for product specs JSON string.
 */
export function safeParseSpecs(specs: any): Record<string, any> {
    if (!specs) return {};
    if (typeof specs === 'object') return specs;
    if (typeof specs !== 'string') return {};

    try {
        return JSON.parse(specs);
    } catch {
        return {};
    }
}
