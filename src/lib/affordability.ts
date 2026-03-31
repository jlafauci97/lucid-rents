/**
 * Pure affordability calculator logic.
 * No React or Supabase dependencies — easy to unit test.
 */

export interface AffordabilityInput {
  grossMonthlyIncome: number;
  /** Roommate/co-signer rent contribution */
  additionalIncome: number;
  /** Sum of all recurring debt payments (student loans, car, credit cards, etc.) */
  monthlyDebtPayments: number;
  /** Estimated monthly utilities */
  estimatedUtilities: number;
  /** Monthly renter's insurance */
  rentersInsurance: number;
}

export interface BudgetBreakdown {
  rent: number;
  utilities: number;
  insurance: number;
  debt: number;
  savings: number;
  discretionary: number;
  totalIncome: number;
}

export interface AffordabilityResult {
  /** 30% of gross monthly income */
  thirtyPercentRule: number;
  /** 50/30/20 rule: 50% for needs, minus non-rent needs */
  fiftyThirtyTwentyRule: number;
  /** Debt-adjusted: total housing + debt under 43% of gross */
  debtAdjustedMax: number;
  /** Conservative recommendation: min of the three rules */
  recommendedMax: number;
  /** Full budget allocation breakdown */
  budgetBreakdown: BudgetBreakdown;
  /** Percentage of income spent on recommended rent */
  rentToIncomePercent: number;
}

/**
 * Compute affordability based on three expert financial rules.
 * Returns the most conservative (lowest) recommendation to protect the user.
 */
export function calculateAffordability(
  input: AffordabilityInput
): AffordabilityResult {
  const totalIncome = input.grossMonthlyIncome + input.additionalIncome;
  const { monthlyDebtPayments, estimatedUtilities, rentersInsurance } = input;

  // --- Rule 1: 30% Rule ---
  // Rent should be no more than 30% of gross monthly income
  const thirtyPercentRule = Math.round(totalIncome * 0.3);

  // --- Rule 2: 50/30/20 Rule ---
  // 50% of income goes to "needs" (rent, utilities, insurance, minimum debt payments)
  // Max rent = needs budget minus other non-rent needs
  const needsBudget = totalIncome * 0.5;
  const fiftyThirtyTwentyRule = Math.max(
    0,
    Math.round(needsBudget - estimatedUtilities - rentersInsurance - monthlyDebtPayments)
  );

  // --- Rule 3: Debt-Adjusted (43% DTI) ---
  // Landlords and lenders typically want total housing + debt under 43% of gross
  const maxTotalObligations = totalIncome * 0.43;
  const debtAdjustedMax = Math.max(
    0,
    Math.round(maxTotalObligations - monthlyDebtPayments - estimatedUtilities - rentersInsurance)
  );

  // Use the most conservative (lowest) value to protect the user
  const recommendedMax = Math.min(
    thirtyPercentRule,
    fiftyThirtyTwentyRule,
    debtAdjustedMax
  );

  // Build the full budget breakdown based on recommended rent
  const savingsTarget = Math.round(totalIncome * 0.2);
  const allocatedTotal =
    recommendedMax + estimatedUtilities + rentersInsurance + monthlyDebtPayments + savingsTarget;
  const discretionary = Math.max(0, Math.round(totalIncome - allocatedTotal));

  const budgetBreakdown: BudgetBreakdown = {
    rent: recommendedMax,
    utilities: estimatedUtilities,
    insurance: rentersInsurance,
    debt: monthlyDebtPayments,
    savings: savingsTarget,
    discretionary,
    totalIncome,
  };

  const rentToIncomePercent =
    totalIncome > 0 ? Math.round((recommendedMax / totalIncome) * 100) : 0;

  return {
    thirtyPercentRule,
    fiftyThirtyTwentyRule,
    debtAdjustedMax,
    recommendedMax,
    budgetBreakdown,
    rentToIncomePercent,
  };
}

/** Format a number as USD currency */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format a number with commas */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/** City-specific cost-of-living tips */
export const CITY_TIPS: Record<string, string[]> = {
  nyc: [
    "NYC renters typically spend $120–$180/mo on utilities (electric + gas).",
    "Most NYC apartments don't include laundry — budget $40–$60/mo for laundromat.",
    "A monthly MetroCard is $132 — no car needed in most neighborhoods.",
  ],
  "los-angeles": [
    "LA renters almost always need a car — budget $400–$600/mo for auto costs.",
    "Utilities average $100–$150/mo, but AC can push summer bills higher.",
    "Many LA apartments include some utilities — check before budgeting.",
  ],
  chicago: [
    "Chicago winters mean higher heating bills — budget $150–$250/mo Nov–Mar.",
    "A CTA monthly pass is $75 — many neighborhoods are transit-friendly.",
    "Renter's insurance is especially important in older Chicago buildings.",
  ],
  miami: [
    "Miami AC bills can hit $150–$250/mo in summer — budget accordingly.",
    "Flood insurance may be required in some zones — check with your landlord.",
    "A car is essential in most Miami neighborhoods outside Brickell/Downtown.",
  ],
  houston: [
    "Houston AC is a must — expect $100–$200/mo for electricity in summer.",
    "A car is essential — Houston has limited public transit options.",
    "No state income tax in Texas means more take-home pay for rent.",
  ],
};
