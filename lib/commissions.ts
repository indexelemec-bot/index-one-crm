import type { CommissionStatus } from "@/types/domain";

export const SALES_COMMISSION_RATE = 0.5;

export function calculateSaleFigures(initialFee: number, finalFee: number) {
  const safeInitial = Math.max(0, Number(initialFee) || 0);
  const safeFinal = Math.max(0, Number(finalFee) || 0);
  return {
    initialFee: safeInitial,
    finalFee: safeFinal,
    annualValue: safeFinal * 12,
    commissionRate: SALES_COMMISSION_RATE,
    commissionBase: safeFinal,
    commissionAmount: safeFinal * SALES_COMMISSION_RATE,
    commissionStatus: "pendiente" as CommissionStatus
  };
}
