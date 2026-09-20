export interface Offer {
    sellerName: string;
    pricePerUnit: number;
    inStock: number;
    minQty: number;
    deliveryTime: string;
    ratingPercent: number;
    reviewCount: number;
    isVerified: boolean;
    isMainOffer: boolean;
    elementIndex: number;
    rawText?: string;
}

export interface CalculationResult {
    offer: Offer;
    targetBudget: number;
    unitsToBuy: number;
    itemSubtotal: number;
    feePercent: number;
    fixedFee: number;
    feeAmount: number;
    totalCost: number;
    difference: number;
    precisionPercent: number;
    isValid: boolean;
    invalidReason?: string;
}

export interface OptimizationConfig {
    budget: number;
    seoTerm: string;
    currency: string;
    country: string;
    minRating: number;
    requireVerified: boolean;
    allowOverspend: boolean;
}
