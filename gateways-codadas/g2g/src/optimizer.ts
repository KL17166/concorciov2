import { Offer, CalculationResult } from './types';

/**
 * Motor herdado do Eldorado, com default zerado para G2G
 * (converted_unit_price da sls já vem com conversão embutida).
 */
export function evaluateOffer(
    offer: Offer,
    targetBudget: number,
    allowOverspend: boolean = false,
    feePercent: number = 0,
    fixedFee: number = 0
): CalculationResult {
    const feeMultiplier = 1 + (feePercent / 100);

    if (offer.pricePerUnit <= 0) {
        return {
            offer,
            targetBudget,
            unitsToBuy: 0,
            itemSubtotal: 0,
            feePercent,
            fixedFee,
            feeAmount: 0,
            totalCost: 0,
            difference: targetBudget,
            precisionPercent: 0,
            isValid: false,
            invalidReason: 'Preço unitário inválido (<= 0)'
        };
    }

    const effectiveBudget = Math.max(0, targetBudget - fixedFee) / feeMultiplier;
    let units = Math.floor(effectiveBudget / offer.pricePerUnit);

    if (allowOverspend) {
        const unitsDown = units;
        const unitsUp = units + 1;
        const totalDown = (unitsDown * offer.pricePerUnit * feeMultiplier) + fixedFee;
        const totalUp = (unitsUp * offer.pricePerUnit * feeMultiplier) + fixedFee;
        if (Math.abs(targetBudget - totalUp) < Math.abs(targetBudget - totalDown)) {
            units = unitsUp;
        }
    }

    if (units < offer.minQty) {
        const minItemCost = Number((offer.minQty * offer.pricePerUnit).toFixed(2));
        const minTotalWithFee = Number(((minItemCost * feeMultiplier) + fixedFee).toFixed(2));
        return {
            offer,
            targetBudget,
            unitsToBuy: units,
            itemSubtotal: Number((units * offer.pricePerUnit).toFixed(2)),
            feePercent,
            fixedFee,
            feeAmount: Number(((units * offer.pricePerUnit * (feePercent / 100)) + fixedFee).toFixed(2)),
            totalCost: Number(((units * offer.pricePerUnit * feeMultiplier) + fixedFee).toFixed(2)),
            difference: Number((targetBudget - ((units * offer.pricePerUnit * feeMultiplier) + fixedFee)).toFixed(2)),
            precisionPercent: 0,
            isValid: false,
            invalidReason: `Orçamento R$${targetBudget.toFixed(2)} não atinge o pedido mínimo de ${offer.minQty.toLocaleString()} un (mínimo com taxa: R$${minTotalWithFee.toFixed(2)})`
        };
    }

    if (units > offer.inStock) {
        units = offer.inStock;
    }

    const itemSubtotal = Number((units * offer.pricePerUnit).toFixed(2));
    const feeAmount = Number(((itemSubtotal * (feePercent / 100)) + fixedFee).toFixed(2));
    const totalCost = Number((itemSubtotal + feeAmount).toFixed(2));
    const difference = Number((targetBudget - totalCost).toFixed(2));

    let precisionPercent = 0.0;
    if (targetBudget > 0) {
        precisionPercent = Math.max(0.0, Number(((1.0 - (Math.abs(difference) / targetBudget)) * 100.0).toFixed(2)));
    }

    return {
        offer,
        targetBudget,
        unitsToBuy: units,
        itemSubtotal,
        feePercent,
        fixedFee,
        feeAmount,
        totalCost,
        difference,
        precisionPercent,
        isValid: true
    };
}

export function findBestOffer(
    offers: Offer[],
    targetBudget: number,
    minRating: number = 0.0,
    requireVerified: boolean = false,
    allowOverspend: boolean = false,
    feePercent: number = 0,
    fixedFee: number = 0
): { best: CalculationResult | null; all: CalculationResult[] } {
    if (!offers || offers.length === 0) {
        return { best: null, all: [] };
    }

    const results: CalculationResult[] = [];

    for (const offer of offers) {
        if (offer.ratingPercent < minRating) {
            results.push({
                offer, targetBudget, unitsToBuy: 0, itemSubtotal: 0,
                feePercent, fixedFee, feeAmount: 0, totalCost: 0,
                difference: targetBudget, precisionPercent: 0, isValid: false,
                invalidReason: `Reputação (${offer.ratingPercent}%) abaixo do mínimo (${minRating}%)`
            });
            continue;
        }

        if (requireVerified && !offer.isVerified) {
            results.push({
                offer, targetBudget, unitsToBuy: 0, itemSubtotal: 0,
                feePercent, fixedFee, feeAmount: 0, totalCost: 0,
                difference: targetBudget, precisionPercent: 0, isValid: false,
                invalidReason: 'Vendedor não possui selo de verificado'
            });
            continue;
        }

        results.push(evaluateOffer(offer, targetBudget, allowOverspend, feePercent, fixedFee));
    }

    const validOffers = results.filter(r => r.isValid);
    if (validOffers.length === 0) {
        return { best: null, all: results };
    }

    validOffers.sort((a, b) => {
        const diffA = Math.abs(a.difference);
        const diffB = Math.abs(b.difference);
        if (diffA !== diffB) return diffA - diffB;
        if (a.offer.pricePerUnit !== b.offer.pricePerUnit) return a.offer.pricePerUnit - b.offer.pricePerUnit;
        if (b.offer.ratingPercent !== a.offer.ratingPercent) return b.offer.ratingPercent - a.offer.ratingPercent;
        return b.offer.reviewCount - a.offer.reviewCount;
    });

    const seenSellers = new Set<string>();
    const uniqueRankedOffers: CalculationResult[] = [];
    for (const item of validOffers) {
        const name = item.offer.sellerName.toLowerCase().trim();
        if (!seenSellers.has(name)) {
            seenSellers.add(name);
            uniqueRankedOffers.push(item);
        }
    }

    return { best: validOffers[0], all: uniqueRankedOffers };
}
