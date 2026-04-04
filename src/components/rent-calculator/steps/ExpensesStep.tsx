"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  Car,
  CreditCard,
  Receipt,
  Lightbulb,
  Shield,
} from "lucide-react";
import { formatCurrency } from "@/lib/affordability";

export interface ExpensesData {
  studentLoans: number;
  carPayment: number;
  creditCards: number;
  otherDebt: number;
  utilities: number;
  rentersInsurance: number;
}

interface ExpensesStepProps {
  expenses: ExpensesData;
  onChange: (expenses: ExpensesData) => void;
  onNext: () => void;
  onBack: () => void;
}

const fields: {
  key: keyof ExpensesData;
  label: string;
  icon: typeof GraduationCap;
  placeholder: string;
  hint: string;
}[] = [
  {
    key: "studentLoans",
    label: "Student Loan Payment",
    icon: GraduationCap,
    placeholder: "0",
    hint: "Monthly minimum payment",
  },
  {
    key: "carPayment",
    label: "Car / Auto Loan",
    icon: Car,
    placeholder: "0",
    hint: "Monthly auto payment",
  },
  {
    key: "creditCards",
    label: "Credit Card Minimums",
    icon: CreditCard,
    placeholder: "0",
    hint: "Total minimum payments across all cards",
  },
  {
    key: "otherDebt",
    label: "Other Monthly Debts",
    icon: Receipt,
    placeholder: "0",
    hint: "Personal loans, medical debt, alimony, etc.",
  },
  {
    key: "utilities",
    label: "Estimated Utilities",
    icon: Lightbulb,
    placeholder: "150",
    hint: "Electric, gas, water, internet",
  },
  {
    key: "rentersInsurance",
    label: "Renter's Insurance",
    icon: Shield,
    placeholder: "20",
    hint: "Typically $15–$30/mo — highly recommended",
  },
];

export function ExpensesStep({
  expenses,
  onChange,
  onNext,
  onBack,
}: ExpensesStepProps) {
  function handleChange(key: keyof ExpensesData, value: string) {
    const num = Number(value.replace(/[^0-9.]/g, ""));
    onChange({ ...expenses, [key]: num });
  }

  const totalExpenses = Object.values(expenses).reduce((sum, v) => sum + v, 0);

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1F36] mb-1">
          Monthly expenses & debts
        </h2>
        <p className="text-sm text-[#5E6687]">
          Tell us about your recurring monthly obligations. We only need debts
          and housing costs — skip groceries and subscriptions.
        </p>
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key} className="flex items-start gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#FAFBFD] border border-[#E2E8F0] flex-shrink-0 mt-6">
              <field.icon className="w-4 h-4 text-[#5E6687]" />
            </div>
            <div className="flex-1">
              <Input
                label={field.label}
                type="text"
                inputMode="numeric"
                placeholder={field.placeholder}
                value={expenses[field.key] > 0 ? expenses[field.key].toLocaleString() : ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
              />
              <p className="text-[10px] text-[#A3ACBE] mt-0.5">{field.hint}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Running total */}
      <div className="mt-6 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[#5E6687]">
          Total monthly obligations
        </span>
        <span className="text-lg font-bold text-[#1A1F36]">
          {formatCurrency(totalExpenses)}
        </span>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button onClick={onNext}>
          Continue
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
