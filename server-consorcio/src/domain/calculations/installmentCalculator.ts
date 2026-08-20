/**
 * Domain calculations for Consortium installment values, amortization, and credit calculations.
 */

export interface CalculateInstallmentOptions {
    baseAmount: number;
    installmentNumber: number;
    nextInstallmentNumber: number;
    monthlyDiscountRate?: number; // default: 0.005 (0.5% per month)
}

/**
 * Calculates the current payable value for an installment.
 * If paying in advance (installmentNumber > nextInstallmentNumber),
 * applies present value (VP) discount for each month in advance.
 */
export function calculateInstallmentValue(
    baseAmount: number,
    installmentIndex: number,
    nextInstallmentIndex: number,
    discountRate: number = 0.005
): number {
    if (installmentIndex <= nextInstallmentIndex) {
        return baseAmount;
    }

    const monthsInAdvance = installmentIndex - nextInstallmentIndex;
    return baseAmount / (1 + (discountRate * monthsInAdvance));
}

export interface CreditCalculationInput {
    productPrice: number;
    adminFeeRate: number; // e.g. 15.0 for 15%
    fundRate: number;     // e.g. 2.0 for 2%
    durationMonths: number;
}

export interface CreditCalculationResult {
    productPrice: number;
    totalRatePercentage: number;
    creditValue: number;
    monthlyInstallment: number;
    totalInstallments: number;
}

/**
 * Calculates total credit value and base monthly installment for a consortium plan.
 */
export function calculatePlanFinancials(input: CreditCalculationInput): CreditCalculationResult {
    if (!input.durationMonths || input.durationMonths <= 0) {
        throw new Error('Duração do plano deve ser maior que zero');
    }

    const totalRatePercentage = Number(input.adminFeeRate) + Number(input.fundRate);
    const creditValue = Number(input.productPrice) * (1 + totalRatePercentage / 100);
    const monthlyInstallment = creditValue / input.durationMonths;

    return {
        productPrice: Number(input.productPrice),
        totalRatePercentage,
        creditValue,
        monthlyInstallment,
        totalInstallments: input.durationMonths
    };
}
