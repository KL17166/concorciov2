import { calculateInstallmentValue, calculatePlanFinancials } from '../domain/calculations/installmentCalculator';

describe('installmentCalculator', () => {
    describe('calculateInstallmentValue', () => {
        it('should return baseAmount if installment is the current or past one', () => {
            expect(calculateInstallmentValue(500, 1, 1)).toBe(500);
            expect(calculateInstallmentValue(500, 2, 3)).toBe(500);
        });

        it('should apply present value discount if installment is in advance', () => {
            const baseAmount = 1000;
            // 2 months in advance, discount rate 0.005 (0.5% per month)
            // VP = 1000 / (1 + 0.005 * 2) = 1000 / 1.01 = 990.0990...
            const value = calculateInstallmentValue(baseAmount, 5, 3);
            expect(value).toBeCloseTo(990.099, 2);
        });
    });

    describe('calculatePlanFinancials', () => {
        it('should calculate credit value and monthly installment correctly', () => {
            const result = calculatePlanFinancials({
                productPrice: 20000,
                adminFeeRate: 15.0,
                fundRate: 2.0,
                durationMonths: 48
            });

            expect(result.totalRatePercentage).toBe(17.0);
            expect(result.creditValue).toBe(23400); // 20000 * 1.17
            expect(result.monthlyInstallment).toBe(487.5); // 23400 / 48
            expect(result.totalInstallments).toBe(48);
        });

        it('should throw error if duration is zero or negative', () => {
            expect(() => calculatePlanFinancials({
                productPrice: 20000,
                adminFeeRate: 15.0,
                fundRate: 2.0,
                durationMonths: 0
            })).toThrow('Duração do plano deve ser maior que zero');
        });
    });
});
