"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle,
  DollarSign,
  Download,
  Home,
  PiggyBank,
  Save,
  TrendingUp,
  Upload,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type FilingStatus = "mfj" | "single";

type WithdrawalStrategy =
  | "esop_first_roth_last"
  | "portfolio_first_roth_last"
  | "pro_rata_roth_last"
  | "esop_first_roth_early"
  | "portfolio_first_roth_early";

type AppState = {
  currentAge: number;
  retireAge: number;
  endAge: number;

  portfolioNow: number;
  esopAtRetirement: number;
  annualContribution: number;
  preRetirementReturn: number;
  postRetirementReturn: number;

  monthlySpendBefore67: number;
  monthlySpendAfter67: number;
  monthlySpendAfter77: number;

  carExpenseAge: number;
  carExpenseAmount: number;
  remodelExpenseAge: number;
  remodelExpenseAmount: number;
  medicalExpenseAge: number;
  medicalExpenseAmount: number;
  familyHelpAge: number;
  familyHelpAmount: number;
  longTermCareEnabled: boolean;
  longTermCareStartAge: number;
  longTermCareYears: number;
  longTermCareAnnualCost: number;

  expenseInflationEnabled: boolean;
  expenseInflationRate: number;

  ssUserAge: number;
  ssUserMonthly: number;
  ssSpouseAge: number;
  ssSpouseMonthly: number;
  ssInflationEnabled: boolean;
  ssInflationRate: number;

  pensionAge: number;
  pensionMonthly: number;

  rentalMonthly: number;
  rentalTaxable: boolean;
  esopTaxable: boolean;

  policy1Age: number;
  policy1Value: number;
  policy2Age: number;
  policy2Value: number;

  rothConversionBefore67: number;
  rothConversionAfter67: number;
  rothConversionStopAge: number;
  autoRothMode: boolean;
  targetTopBracket: number;

  taxFilingStatus: FilingStatus;
  stateTaxRegion: "wa" | "ca" | "id" | "az";
  federalDeduction: number;
  inflationRate: number;

  homePayoffAge: number;
  homeValueAtPayoff: number;
  includeHomeInNetWorth: boolean;
  homeAppreciationEnabled: boolean;
  homeAppreciationRate: number;

  bestCaseReturn: number;
  baseCaseReturn: number;
  worstCaseReturn: number;

  monteCarloRuns: number;
  monteCarloMeanReturn: number;
  monteCarloStdDev: number;

  spouseDeathAge: number;
  survivorSpendingPercent: number;
  survivorKeepsHigherSS: boolean;

  withdrawalStrategy: WithdrawalStrategy;
};

type Bracket = {
  limit: number;
  rate: number;
};

type ResultRow = {
  age: number;
  annualSpend: number;
  oneTimeExpense: number;
  longTermCareExpense: number;
  federalTax: number;
  stateTax: number;
  irmaa: number;
  taxableIncome: number;
  topRate: number;

  totalSS: number;
  taxableSS: number;
  pension: number;
  rental: number;
  insuranceIncome: number;

  rothConversion: number;
  rmd: number;

  spendFundingNeed: number;
  totalPortfolioDistribution: number;

  esopWithdrawal: number;
  portfolioWithdrawal: number;
  rothCashWithdrawal: number;
  conversionFromPortfolio: number;

  taxablePortfolioWithdrawal: number;
  taxableEsopWithdrawal: number;

  endPortfolio: number;
  endRoth: number;
  endEsop: number;
  netWorth: number;
};

type ScenarioSummary = {
  name: string;
  returnRate: number;
  depletionAge: number | null;
  endingPortfolio: number;
  endingRoth: number;
  endingEsop: number;
  endingNetWorth: number;
};

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
};

type SummaryCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STORAGE_KEY = "retirement-planner-current-state";
const SCENARIOS_KEY = "retirement-planner-scenarios";

const RMD_TABLE: Record<number, number> = {
  73: 26.5,
  74: 25.5,
  75: 24.6,
  76: 23.7,
  77: 22.9,
  78: 22.0,
  79: 21.1,
  80: 20.2,
  81: 19.4,
  82: 18.5,
  83: 17.7,
  84: 16.8,
  85: 16.0,
  86: 15.2,
  87: 14.4,
  88: 13.7,
  89: 12.9,
  90: 12.2,
  91: 11.5,
  92: 10.8,
  93: 10.1,
  94: 9.5,
  95: 8.9,
};

const defaultState: AppState = {
  currentAge: 55,
  retireAge: 62,
  endAge: 95,

  portfolioNow: 770000,
  esopAtRetirement: 500000,
  annualContribution: 42500,
  preRetirementReturn: 8.9,
  postRetirementReturn: 6.0,

  monthlySpendBefore67: 13000,
  monthlySpendAfter67: 9000,
  monthlySpendAfter77: 8000,

  carExpenseAge: 68,
  carExpenseAmount: 35000,
  remodelExpenseAge: 72,
  remodelExpenseAmount: 60000,
  medicalExpenseAge: 78,
  medicalExpenseAmount: 40000,
  familyHelpAge: 70,
  familyHelpAmount: 25000,
  longTermCareEnabled: false,
  longTermCareStartAge: 85,
  longTermCareYears: 4,
  longTermCareAnnualCost: 90000,

  expenseInflationEnabled: true,
  expenseInflationRate: 2.5,

  ssUserAge: 62,
  ssUserMonthly: 2730,
  ssSpouseAge: 62,
  ssSpouseMonthly: 1472,
  ssInflationEnabled: true,
  ssInflationRate: 2.5,

  pensionAge: 66,
  pensionMonthly: 1040,

  rentalMonthly: 1500,
  rentalTaxable: false,
  esopTaxable: true,

  policy1Age: 71,
  policy1Value: 65000,
  policy2Age: 62,
  policy2Value: 25000,

  rothConversionBefore67: 120000,
  rothConversionAfter67: 70000,
  rothConversionStopAge: 72,
  autoRothMode: true,
  targetTopBracket: 0.22,

  taxFilingStatus: "mfj",
  stateTaxRegion: "wa",
  federalDeduction: 30000,
  inflationRate: 2.5,

  homePayoffAge: 66,
  homeValueAtPayoff: 1200000,
  includeHomeInNetWorth: true,
  homeAppreciationEnabled: true,
  homeAppreciationRate: 2.5,

  bestCaseReturn: 8,
  baseCaseReturn: 6,
  worstCaseReturn: 3,

  monteCarloRuns: 250,
  monteCarloMeanReturn: 6,
  monteCarloStdDev: 10,

  spouseDeathAge: 90,
  survivorSpendingPercent: 75,
  survivorKeepsHigherSS: true,

  withdrawalStrategy: "esop_first_roth_last",
};

function fmtCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function fmtPercent(value: number) {
  return `${(Number(value) || 0).toFixed(1)}%`;
}

function NumberField({ label, value, onChange, step = 1000, min = 0 }: NumberFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  onClick,
}: SummaryCardProps & { onClick?: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
      className="w-full cursor-pointer rounded-2xl text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
    >
      <Card className="h-full rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">{title}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
              {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
            </div>
            <div className="rounded-2xl bg-slate-100 p-3">
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function calcFederalTax(taxableIncome: number, brackets: Bracket[]) {
  const income = Math.max(0, taxableIncome);
  let tax = 0;
  let previousLimit = 0;
  let topRate = 0;

  for (const bracket of brackets) {
    if (income <= previousLimit) break;
    const amountInBracket = Math.min(income, bracket.limit) - previousLimit;
    if (amountInBracket > 0) {
      tax += amountInBracket * bracket.rate;
      topRate = bracket.rate;
    }
    previousLimit = bracket.limit;
  }

  return { tax, topRate };
}

function calcRMD(age: number, balance: number) {
  const factor = RMD_TABLE[age];
  if (!factor) return 0;
  return Math.max(0, balance) / factor;
}

function calcSSTaxable(ss: number, otherIncome: number, filingStatus: FilingStatus) {
  const base = filingStatus === "single" ? 25000 : 32000;
  const second = filingStatus === "single" ? 34000 : 44000;
  const provisional = otherIncome + ss * 0.5;

  if (provisional <= base) return 0;
  if (provisional <= second) return Math.min(ss * 0.5, (provisional - base) * 0.5);

  const firstLayer = Math.min(ss * 0.5, (second - base) * 0.5);
  const secondLayer = (provisional - second) * 0.85;
  return Math.min(ss * 0.85, firstLayer + secondLayer);
}

function calcIRMAA(age: number, filingStatus: FilingStatus, magi: number) {
  if (age < 65) return 0;

  const thresholds =
    filingStatus === "single"
      ? [106000, 133000, 167000, 200000, 500000]
      : [212000, 266000, 334000, 400000, 750000];

  const monthlySurcharges = [0, 74, 185, 295, 406, 443];
  let tier = 0;

  while (tier < thresholds.length && magi > thresholds[tier]) {
    tier += 1;
  }

  return monthlySurcharges[tier] * 12 * 2;
}


function calcStateTax(taxableIncome: number, region: AppState["stateTaxRegion"]) {
  const income = Math.max(0, taxableIncome);

  if (region === "wa") return 0;
  if (region === "az") return income * 0.025;
  if (region === "id") return income * 0.058;

  // Simplified California single/MFJ-blended estimate for planning only.
  // This is intentionally conservative and not a substitute for a full state return.
  const brackets: Bracket[] = [
    { limit: 20198, rate: 0.01 },
    { limit: 47884, rate: 0.02 },
    { limit: 75576, rate: 0.04 },
    { limit: 104910, rate: 0.06 },
    { limit: 132590, rate: 0.08 },
    { limit: 677278, rate: 0.093 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.103 },
  ];
  return calcFederalTax(income, brackets).tax;
}

function randomNormal(mean: number, stdDev: number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * stdDev;
}

function runSelfChecks() {
  const checks = [
    calcFederalTax(50000, [
      { limit: 10000, rate: 0.1 },
      { limit: 50000, rate: 0.2 },
      { limit: Number.POSITIVE_INFINITY, rate: 0.3 },
    ]).tax === 9000,
    calcSSTaxable(40000, 0, "mfj") === 0,
    Math.round(calcRMD(73, 265000)) === 10000,
    calcIRMAA(64, "mfj", 500000) === 0,
  ];

  return checks.every(Boolean);
}

function exportRowsToExcel(rows: ResultRow[]) {
  const exportData = rows.map((row) => ({
    Age: row.age,
    Spend: row.annualSpend,
    OneTimeExpense: row.oneTimeExpense,
    LongTermCareExpense: row.longTermCareExpense,
    SocialSecurity: row.totalSS,
    TaxableSocialSecurity: row.taxableSS,
    Pension: row.pension,
    Rental: row.rental,
    Insurance: row.insuranceIncome,
    RothConversion: row.rothConversion,
    RMD: row.rmd,
    TaxablePortfolioWithdrawal: row.taxablePortfolioWithdrawal,
    TaxableESOPWithdrawal: row.taxableEsopWithdrawal,
    TaxableIncome: row.taxableIncome,
    FederalTax: row.federalTax,
    StateTax: row.stateTax,
    IRMAA: row.irmaa,
    TopBracket: row.topRate,
    SpendGap: row.spendFundingNeed,
    TotalDistribution: row.totalPortfolioDistribution,
    ESOPUsed: row.esopWithdrawal,
    PortfolioUsed: row.portfolioWithdrawal,
    RothUsed: row.rothCashWithdrawal,
    ConversionFromPortfolio: row.conversionFromPortfolio,
    EndingPortfolio: row.endPortfolio,
    EndingRoth: row.endRoth,
    EndingESOP: row.endEsop,
    NetWorth: row.netWorth,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Year by Year");
  XLSX.writeFile(workbook, "retirement_projection.xlsx");
}

export default function RetirementPlannerApp() {
  const [state, setState] = useState<AppState>(defaultState);
  const [scenarioName, setScenarioName] = useState("");
  const [savedScenarios, setSavedScenarios] = useState<string[]>([]);
  const [importMessage, setImportMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"summary" | "inputs" | "projection" | "details">("summary");
  const importRef = useRef<HTMLInputElement | null>(null);
  const yearHeaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setState({ ...defaultState, ...JSON.parse(saved) });

      const scenarioRaw = localStorage.getItem(SCENARIOS_KEY);
      if (scenarioRaw) {
        const parsed = JSON.parse(scenarioRaw) as Record<string, AppState>;
        setSavedScenarios(Object.keys(parsed).sort());
      }
    } catch {
      setImportMessage("Could not load saved browser data.");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline support is optional; ignore registration failures.
      });
    }
  }, []);

  const update = <K extends keyof AppState>(key: K, value: AppState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const {
    currentAge,
    retireAge,
    endAge,
    portfolioNow,
    esopAtRetirement,
    annualContribution,
    preRetirementReturn,
    postRetirementReturn,
    monthlySpendBefore67,
    monthlySpendAfter67,
    monthlySpendAfter77,
    carExpenseAge,
    carExpenseAmount,
    remodelExpenseAge,
    remodelExpenseAmount,
    medicalExpenseAge,
    medicalExpenseAmount,
    familyHelpAge,
    familyHelpAmount,
    longTermCareEnabled,
    longTermCareStartAge,
    longTermCareYears,
    longTermCareAnnualCost,
    expenseInflationEnabled,
    expenseInflationRate,
    ssUserAge,
    ssUserMonthly,
    ssSpouseAge,
    ssSpouseMonthly,
    ssInflationEnabled,
    ssInflationRate,
    pensionAge,
    pensionMonthly,
    rentalMonthly,
    rentalTaxable,
    esopTaxable,
    policy1Age,
    policy1Value,
    policy2Age,
    policy2Value,
    rothConversionBefore67,
    rothConversionAfter67,
    rothConversionStopAge,
    autoRothMode,
    targetTopBracket,
    taxFilingStatus,
    stateTaxRegion,
    federalDeduction,
    inflationRate,
    homePayoffAge,
    homeValueAtPayoff,
    includeHomeInNetWorth,
    homeAppreciationEnabled,
    homeAppreciationRate,
    bestCaseReturn,
    baseCaseReturn,
    worstCaseReturn,
    monteCarloRuns,
    monteCarloMeanReturn,
    monteCarloStdDev,
    spouseDeathAge,
    survivorSpendingPercent,
    survivorKeepsHigherSS,
    withdrawalStrategy,
  } = state;

  const yearsToRetirement = Math.max(0, retireAge - currentAge);

  const federalBrackets = useMemo<Bracket[]>(() => {
    if (taxFilingStatus === "single") {
      return [
        { limit: 11925, rate: 0.1 },
        { limit: 48475, rate: 0.12 },
        { limit: 103350, rate: 0.22 },
        { limit: 197300, rate: 0.24 },
        { limit: 250525, rate: 0.32 },
        { limit: 626350, rate: 0.35 },
        { limit: Number.POSITIVE_INFINITY, rate: 0.37 },
      ];
    }

    return [
      { limit: 23850, rate: 0.1 },
      { limit: 96950, rate: 0.12 },
      { limit: 206700, rate: 0.22 },
      { limit: 394600, rate: 0.24 },
      { limit: 501050, rate: 0.32 },
      { limit: 751600, rate: 0.35 },
      { limit: Number.POSITIVE_INFINITY, rate: 0.37 },
    ];
  }, [taxFilingStatus]);

  const getInflatedBrackets = (yearOffset: number) =>
    federalBrackets.map((bracket) => ({
      ...bracket,
      limit: Number.isFinite(bracket.limit)
        ? bracket.limit * Math.pow(1 + inflationRate / 100, yearOffset)
        : bracket.limit,
    }));

  const getInflatedDeduction = (yearOffset: number) =>
    federalDeduction * Math.pow(1 + inflationRate / 100, yearOffset);

  const projectedPortfolioAtRetirement = useMemo(() => {
    let balance = portfolioNow;
    for (let i = 0; i < yearsToRetirement; i += 1) {
      balance = balance * (1 + preRetirementReturn / 100) + annualContribution;
    }
    return balance;
  }, [portfolioNow, annualContribution, preRetirementReturn, yearsToRetirement]);

  function computeTaxForYear(params: {
    age: number;
    yearOffset: number;
    totalSS: number;
    pension: number;
    conversion: number;
    taxablePortfolioWithdrawal: number;
    taxableEsopWithdrawal: number;
    rental: number;
    rentalTaxableFlag: boolean;
  }) {
    const otherIncome =
      params.pension +
      params.conversion +
      params.taxablePortfolioWithdrawal +
      params.taxableEsopWithdrawal +
      (params.rentalTaxableFlag ? params.rental : 0);

    const taxableSS = calcSSTaxable(params.totalSS, otherIncome, taxFilingStatus);
    const taxableIncome = Math.max(
      0,
      otherIncome + taxableSS - getInflatedDeduction(params.yearOffset),
    );

    const taxResult = calcFederalTax(taxableIncome, getInflatedBrackets(params.yearOffset));
    const stateTax = calcStateTax(taxableIncome, stateTaxRegion);
    const irmaa = calcIRMAA(params.age, taxFilingStatus, otherIncome + taxableSS);

    return {
      federalTax: taxResult.tax,
      stateTax,
      topRate: taxResult.topRate,
      taxableIncome,
      taxableSS,
      irmaa,
    };
  }

  function buildProjection(customReturnRate?: number, esopTaxableOverride = esopTaxable): ResultRow[] {
    let taxDeferredPortfolio = projectedPortfolioAtRetirement;
    let esop = esopAtRetirement;
    let rothBalance = 0;
    const rows: ResultRow[] = [];
    const effectiveReturn = customReturnRate ?? postRetirementReturn;

    for (let age = retireAge; age <= endAge; age += 1) {
      const yearOffset = age - retireAge;

      let spendBase: number;
      let spendInflationYears: number;

      if (age < 67) {
        spendBase = monthlySpendBefore67 * 12;
        spendInflationYears = yearOffset;
      } else if (age < 77) {
        spendBase = monthlySpendAfter67 * 12;
        spendInflationYears = Math.max(0, 67 - retireAge) + (age - 67);
      } else {
        spendBase = monthlySpendAfter77 * 12;
        spendInflationYears = Math.max(0, 67 - retireAge) + (77 - 67) + (age - 77);
      }

      const baseAnnualSpend = expenseInflationEnabled
        ? spendBase * Math.pow(1 + expenseInflationRate / 100, spendInflationYears)
        : spendBase;

      const oneTimeExpense =
        (age === carExpenseAge ? carExpenseAmount : 0) +
        (age === remodelExpenseAge ? remodelExpenseAmount : 0) +
        (age === medicalExpenseAge ? medicalExpenseAmount : 0) +
        (age === familyHelpAge ? familyHelpAmount : 0);

      const longTermCareExpense =
        longTermCareEnabled &&
        age >= longTermCareStartAge &&
        age < longTermCareStartAge + longTermCareYears
          ? longTermCareAnnualCost * Math.pow(1 + expenseInflationRate / 100, age - longTermCareStartAge)
          : 0;

      const survivorAdjustment =
        spouseDeathAge > 0 && age >= spouseDeathAge ? survivorSpendingPercent / 100 : 1;

      const annualSpend = baseAnnualSpend * survivorAdjustment + oneTimeExpense + longTermCareExpense;

      const userSSInflationYears = age >= ssUserAge ? age - ssUserAge : 0;
      const spouseSSInflationYears = age >= ssSpouseAge ? age - ssSpouseAge : 0;

      const userSS =
        age >= ssUserAge
          ? ssUserMonthly *
            12 *
            (ssInflationEnabled ? Math.pow(1 + ssInflationRate / 100, userSSInflationYears) : 1)
          : 0;

      const spouseSS =
        age >= ssSpouseAge
          ? ssSpouseMonthly *
            12 *
            (ssInflationEnabled ? Math.pow(1 + ssInflationRate / 100, spouseSSInflationYears) : 1)
          : 0;

      const totalSS =
        spouseDeathAge > 0 && age >= spouseDeathAge
          ? survivorKeepsHigherSS
            ? Math.max(userSS, spouseSS)
            : userSS
          : userSS + spouseSS;
      const pension = age >= pensionAge ? pensionMonthly * 12 : 0;
      const rental = rentalMonthly * 12;
      const insuranceIncome =
        (age === policy1Age ? policy1Value : 0) + (age === policy2Age ? policy2Value : 0);

      const rmd = age >= 73 ? Math.min(taxDeferredPortfolio, calcRMD(age, taxDeferredPortfolio)) : 0;

      const baseOtherIncomeForConversion = pension + rmd + (rentalTaxable ? rental : 0);
      const taxableSSForConversion = calcSSTaxable(
        totalSS,
        baseOtherIncomeForConversion,
        taxFilingStatus,
      );

      const baseTaxableIncomeForConversion = Math.max(
        0,
        baseOtherIncomeForConversion + taxableSSForConversion - getInflatedDeduction(yearOffset),
      );

      const targetBracket = getInflatedBrackets(yearOffset).find((b) => b.rate === targetTopBracket);

      const autoConversion =
        targetBracket && Number.isFinite(targetBracket.limit)
          ? Math.max(0, targetBracket.limit - baseTaxableIncomeForConversion)
          : 0;

      const desiredConversion =
        age <= rothConversionStopAge
          ? autoRothMode
            ? autoConversion
            : age < 67
              ? rothConversionBefore67
              : rothConversionAfter67
          : 0;

      const conversionFromPortfolio = Math.min(taxDeferredPortfolio, desiredConversion);
      taxDeferredPortfolio -= conversionFromPortfolio;
      rothBalance += conversionFromPortfolio;

      const spendFundingNeed = Math.max(
        0,
        annualSpend - (totalSS + pension + rental + insuranceIncome),
      );

      let federalTax = 0;
      let stateTax = 0;
      let irmaa = 0;
      let taxableIncome = 0;
      let topRate = 0;
      let taxableSS = 0;

      let finalEsopWithdrawal = 0;
      let finalExtraPortfolioWithdrawal = 0;
      let finalRothWithdrawal = 0;

      // Important: RMD is taxable whether or not it is needed for spending.
      // Portfolio used = RMD + extra tax-deferred withdrawal.
      // Taxable portfolio = Portfolio used.
      for (let pass = 0; pass < 15; pass += 1) {
        let remainingCashNeed = spendFundingNeed + federalTax + stateTax + irmaa;

        const rmdCashUsed = Math.min(rmd, remainingCashNeed);
        remainingCashNeed -= rmdCashUsed;

        let esopWithdrawal = 0;
        let extraPortfolioWithdrawal = 0;
        let rothWithdrawal = 0;

        const availablePortfolioAfterRmd = Math.max(0, taxDeferredPortfolio - rmd);

        const useExtraPortfolio = () => {
          const amount = Math.min(availablePortfolioAfterRmd - extraPortfolioWithdrawal, remainingCashNeed);
          const safeAmount = Math.max(0, amount);
          extraPortfolioWithdrawal += safeAmount;
          remainingCashNeed -= safeAmount;
        };

        const useEsop = () => {
          const amount = Math.min(esop - esopWithdrawal, remainingCashNeed);
          const safeAmount = Math.max(0, amount);
          esopWithdrawal += safeAmount;
          remainingCashNeed -= safeAmount;
        };

        const useRoth = () => {
          const amount = Math.min(rothBalance - rothWithdrawal, remainingCashNeed);
          const safeAmount = Math.max(0, amount);
          rothWithdrawal += safeAmount;
          remainingCashNeed -= safeAmount;
        };

        if (withdrawalStrategy === "portfolio_first_roth_last") {
          useExtraPortfolio();
          useEsop();
          useRoth();
        } else if (withdrawalStrategy === "pro_rata_roth_last") {
          const halfNeed = remainingCashNeed * 0.5;
          const esopPart = Math.min(esop, halfNeed);
          esopWithdrawal += Math.max(0, esopPart);
          remainingCashNeed -= Math.max(0, esopPart);

          const portfolioPart = Math.min(availablePortfolioAfterRmd, halfNeed);
          extraPortfolioWithdrawal += Math.max(0, portfolioPart);
          remainingCashNeed -= Math.max(0, portfolioPart);

          useEsop();
          useExtraPortfolio();
          useRoth();
        } else if (withdrawalStrategy === "esop_first_roth_early") {
          useEsop();
          useRoth();
          useExtraPortfolio();
        } else if (withdrawalStrategy === "portfolio_first_roth_early") {
          useExtraPortfolio();
          useRoth();
          useEsop();
        } else {
          useEsop();
          useExtraPortfolio();
          useRoth();
        }

        const taxablePortfolioWithdrawal = rmd + extraPortfolioWithdrawal;
        const taxableEsopWithdrawal = esopTaxableOverride ? esopWithdrawal : 0;

        const taxCalc = computeTaxForYear({
          age,
          yearOffset,
          totalSS,
          pension,
          conversion: conversionFromPortfolio,
          taxablePortfolioWithdrawal,
          taxableEsopWithdrawal,
          rental,
          rentalTaxableFlag: rentalTaxable,
        });

        const stable =
          Math.abs(taxCalc.federalTax - federalTax) < 1 &&
          Math.abs(taxCalc.stateTax - stateTax) < 1 &&
          Math.abs(taxCalc.irmaa - irmaa) < 1;

        federalTax = taxCalc.federalTax;
        stateTax = taxCalc.stateTax;
        irmaa = taxCalc.irmaa;
        taxableIncome = taxCalc.taxableIncome;
        taxableSS = taxCalc.taxableSS;
        topRate = taxCalc.topRate;

        finalEsopWithdrawal = esopWithdrawal;
        finalExtraPortfolioWithdrawal = extraPortfolioWithdrawal;
        finalRothWithdrawal = rothWithdrawal;

        if (stable) break;
      }

      const portfolioWithdrawal = Math.min(taxDeferredPortfolio, rmd + finalExtraPortfolioWithdrawal);
      const taxablePortfolioWithdrawal = portfolioWithdrawal;

      const esopWithdrawal = Math.min(esop, finalEsopWithdrawal);
      const taxableEsopWithdrawal = esopTaxableOverride ? esopWithdrawal : 0;

      const rothCashWithdrawal = Math.min(rothBalance, finalRothWithdrawal);

      const finalTaxCalc = computeTaxForYear({
        age,
        yearOffset,
        totalSS,
        pension,
        conversion: conversionFromPortfolio,
        taxablePortfolioWithdrawal,
        taxableEsopWithdrawal,
        rental,
        rentalTaxableFlag: rentalTaxable,
      });

      federalTax = finalTaxCalc.federalTax;
      stateTax = finalTaxCalc.stateTax;
      irmaa = finalTaxCalc.irmaa;
      taxableIncome = finalTaxCalc.taxableIncome;
      taxableSS = finalTaxCalc.taxableSS;
      topRate = finalTaxCalc.topRate;

      taxDeferredPortfolio = Math.max(0, taxDeferredPortfolio - portfolioWithdrawal);
      esop = Math.max(0, esop - esopWithdrawal);
      rothBalance = Math.max(0, rothBalance - rothCashWithdrawal);

      const totalPortfolioDistribution =
        conversionFromPortfolio + portfolioWithdrawal + rothCashWithdrawal;

      taxDeferredPortfolio += taxDeferredPortfolio * (effectiveReturn / 100);
      rothBalance += rothBalance * (effectiveReturn / 100);

      const yearsSincePayoff = age >= homePayoffAge ? age - homePayoffAge : 0;
      const homeBase = age >= homePayoffAge ? homeValueAtPayoff : 0;

      const homeEquity = homeAppreciationEnabled
        ? homeBase * Math.pow(1 + homeAppreciationRate / 100, yearsSincePayoff)
        : homeBase;

      const netWorth =
        taxDeferredPortfolio + rothBalance + esop + (includeHomeInNetWorth ? homeEquity : 0);

      rows.push({
        age,
        annualSpend,
        oneTimeExpense,
        longTermCareExpense,
        federalTax,
        stateTax,
        irmaa,
        taxableIncome,
        topRate,

        totalSS,
        taxableSS,
        pension,
        rental,
        insuranceIncome,

        rothConversion: conversionFromPortfolio,
        rmd,

        spendFundingNeed,
        totalPortfolioDistribution,

        esopWithdrawal,
        portfolioWithdrawal,
        rothCashWithdrawal,
        conversionFromPortfolio,

        taxablePortfolioWithdrawal,
        taxableEsopWithdrawal,

        endPortfolio: taxDeferredPortfolio,
        endRoth: rothBalance,
        endEsop: esop,
        netWorth,
      });
    }

    return rows;
  }

  const results = useMemo<ResultRow[]>(
    () => buildProjection(),
    [state, projectedPortfolioAtRetirement, federalBrackets],
  );

  const esopTaxableResults = useMemo<ResultRow[]>(
    () => buildProjection(undefined, true),
    [state, projectedPortfolioAtRetirement, federalBrackets],
  );

  const esopTaxFreeResults = useMemo<ResultRow[]>(
    () => buildProjection(undefined, false),
    [state, projectedPortfolioAtRetirement, federalBrackets],
  );

  const firstYear = results[0] || null;
  const age67Row = results.find((row) => row.age === 67) || null;
  const row62 = results.find((row) => row.age === 62) || null;
  const finalYear = results[results.length - 1] || null;

  const minPortfolio = results.reduce(
    (min, row) => Math.min(min, row.endPortfolio),
    Number.POSITIVE_INFINITY,
  );

  const portfolioDepletedAge = results.find((row) => row.endPortfolio <= 0)?.age ?? null;
  const combinedDepletedAge =
    results.find((row) => row.endPortfolio + row.endRoth <= 0)?.age ?? null;

  const chartData = results.map((row) => ({
    age: row.age,
    Portfolio: Math.round(row.endPortfolio),
    Roth: Math.round(row.endRoth),
    ESOP: Math.round(row.endEsop),
    NetWorth: Math.round(row.netWorth),
  }));

  const scenarioSummaries = useMemo<ScenarioSummary[]>(() => {
    const scenarios = [
      { name: "Best case", returnRate: bestCaseReturn },
      { name: "Base case", returnRate: baseCaseReturn },
      { name: "Worst case", returnRate: worstCaseReturn },
    ];

    return scenarios.map((scenario) => {
      const rows = buildProjection(scenario.returnRate);
      const last = rows[rows.length - 1];
      const depletionAge = rows.find((row) => row.endPortfolio + row.endRoth <= 0)?.age ?? null;

      return {
        name: scenario.name,
        returnRate: scenario.returnRate,
        depletionAge,
        endingPortfolio: last?.endPortfolio ?? 0,
        endingRoth: last?.endRoth ?? 0,
        endingEsop: last?.endEsop ?? 0,
        endingNetWorth: last?.netWorth ?? 0,
      };
    });
  }, [results, bestCaseReturn, baseCaseReturn, worstCaseReturn]);

  const monteCarloSummary = useMemo(() => {
    const runs = Math.max(50, Math.floor(monteCarloRuns));
    let successes = 0;
    const endingValues: number[] = [];

    for (let i = 0; i < runs; i += 1) {
      const rows = buildProjection(randomNormal(monteCarloMeanReturn, monteCarloStdDev));
      const last = rows[rows.length - 1];
      const depleted = rows.find((row) => row.endPortfolio + row.endRoth <= 0);

      if (!depleted) successes += 1;
      endingValues.push(last?.netWorth ?? 0);
    }

    endingValues.sort((a, b) => a - b);

    return {
      successRate: (successes / runs) * 100,
      median: endingValues[Math.floor(endingValues.length / 2)] ?? 0,
      p10: endingValues[Math.floor(endingValues.length * 0.1)] ?? 0,
      p90: endingValues[Math.floor(endingValues.length * 0.9)] ?? 0,
      runs,
    };
  }, [results, monteCarloRuns, monteCarloMeanReturn, monteCarloStdDev]);

  const esopTaxableFirstYear = esopTaxableResults[0] || null;
  const esopTaxFreeFirstYear = esopTaxFreeResults[0] || null;
  const esopTaxableFinalYear = esopTaxableResults[esopTaxableResults.length - 1] || null;
  const esopTaxFreeFinalYear = esopTaxFreeResults[esopTaxFreeResults.length - 1] || null;

  const esopTaxableTotalFederalTax = esopTaxableResults.reduce((sum, row) => sum + row.federalTax, 0);
  const esopTaxFreeTotalFederalTax = esopTaxFreeResults.reduce((sum, row) => sum + row.federalTax, 0);

  const lifetimeFederalTax = results.reduce((sum, row) => sum + row.federalTax, 0);
  const lifetimeStateTax = results.reduce((sum, row) => sum + row.stateTax, 0);
  const lifetimeIRMAA = results.reduce((sum, row) => sum + row.irmaa, 0);
  const taxSpikeRow = results.reduce<ResultRow | null>((max, row) => (!max || row.federalTax + row.stateTax + row.irmaa > max.federalTax + max.stateTax + max.irmaa ? row : max), null);
  const irmaaTriggeredAge = results.find((row) => row.irmaa > 0)?.age ?? null;
  const rmdStartAge = results.find((row) => row.rmd > 0)?.age ?? null;
  const rothUsedEarlyAge = results.find((row) => row.age < 73 && row.rothCashWithdrawal > 0)?.age ?? null;
  const safeSpendingEstimate = combinedDepletedAge
    ? Math.max(0, monthlySpendAfter67 * 0.9)
    : monthlySpendAfter67;
  const recommendedRothConversion =
    irmaaTriggeredAge && irmaaTriggeredAge <= 65
      ? "Reduce conversions to avoid early IRMAA."
      : combinedDepletedAge
        ? "Reduce conversions and preserve taxable portfolio."
        : "Current conversion plan looks acceptable; compare 12% vs 22% bracket fills.";
  const healthLabel = combinedDepletedAge
    ? `Portfolio + Roth run out at age ${combinedDepletedAge}`
    : minPortfolio > projectedPortfolioAtRetirement * 0.75
      ? "Very strong"
      : minPortfolio > projectedPortfolioAtRetirement * 0.45 || (finalYear ? finalYear.endRoth > 0 : false)
        ? "Manageable"
        : "Needs attention";

  const selfChecksPassed = runSelfChecks();

  const endingHomeEquity = finalYear
    ? includeHomeInNetWorth
      ? homeAppreciationEnabled
        ? homeValueAtPayoff *
          Math.pow(1 + homeAppreciationRate / 100, Math.max(0, endAge - homePayoffAge))
        : endAge >= homePayoffAge
          ? homeValueAtPayoff
          : 0
      : 0
    : 0;

  const estimatedAfterTaxNetWorth = finalYear
    ? finalYear.endPortfolio * (1 - finalYear.topRate) +
      finalYear.endRoth +
      finalYear.endEsop +
      endingHomeEquity
    : 0;

  const saveScenario = () => {
    const name = scenarioName.trim();
    if (!name) {
      setImportMessage("Enter a scenario name first.");
      return;
    }

    const existing = JSON.parse(localStorage.getItem(SCENARIOS_KEY) || "{}") as Record<string, AppState>;
    existing[name] = state;
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify(existing));
    setSavedScenarios(Object.keys(existing).sort());
    setImportMessage(`Saved scenario: ${name}`);
  };

  const loadScenario = (name: string) => {
    const existing = JSON.parse(localStorage.getItem(SCENARIOS_KEY) || "{}") as Record<string, AppState>;
    if (!existing[name]) return;

    setState({ ...defaultState, ...existing[name] });
    setScenarioName(name);
    setImportMessage(`Loaded scenario: ${name}`);
  };

  const exportPlanJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "retirement_plan.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importPlanJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        setState({ ...defaultState, ...imported });
        setImportMessage("Imported plan successfully.");
      } catch {
        setImportMessage("Could not import file. Check that it is a valid JSON plan export.");
      }
    };
    reader.readAsText(file);
  };

  const row62WithoutRothTax =
    row62
      ? computeTaxForYear({
          age: 62,
          yearOffset: 62 - retireAge,
          totalSS: row62.totalSS,
          pension: row62.pension,
          conversion: 0,
          taxablePortfolioWithdrawal: row62.taxablePortfolioWithdrawal,
          taxableEsopWithdrawal: row62.taxableEsopWithdrawal,
          rental: row62.rental,
          rentalTaxableFlag: rentalTaxable,
        })
      : null;

  const row62WithoutSSTax =
    row62
      ? computeTaxForYear({
          age: 62,
          yearOffset: 62 - retireAge,
          totalSS: 0,
          pension: row62.pension,
          conversion: row62.rothConversion,
          taxablePortfolioWithdrawal: row62.taxablePortfolioWithdrawal,
          taxableEsopWithdrawal: row62.taxableEsopWithdrawal,
          rental: row62.rental,
          rentalTaxableFlag: rentalTaxable,
        })
      : null;

  const row62WithoutRmdTax =
    row62
      ? computeTaxForYear({
          age: 62,
          yearOffset: 62 - retireAge,
          totalSS: row62.totalSS,
          pension: row62.pension,
          conversion: row62.rothConversion,
          taxablePortfolioWithdrawal: Math.max(0, row62.taxablePortfolioWithdrawal - row62.rmd),
          taxableEsopWithdrawal: row62.taxableEsopWithdrawal,
          rental: row62.rental,
          rentalTaxableFlag: rentalTaxable,
        })
      : null;

  return (
    <div className="min-h-screen bg-slate-50 p-3 pb-24 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <style>{`

          .year-grid-shell {
            display: flex;
            height: 100%;
            min-height: 0;
            flex-direction: column;
            border: 1px solid rgb(226 232 240);
            border-radius: 0.75rem;
            overflow: hidden;
            background: white;
          }

          .year-grid-header-scroll {
            flex: 0 0 auto;
            width: 100%;
            overflow: hidden;
            background: rgb(248 250 252);
            border-bottom: 1px solid rgb(226 232 240);
          }

          .year-grid-body-scroll {
            flex: 1 1 auto;
            min-height: 0;
            width: 100%;
            overflow: auto;
            -webkit-overflow-scrolling: touch;
          }

          @media print {
            .year-grid-body-scroll {
              height: auto;
              overflow: visible;
            }

            .year-grid-header-scroll {
              overflow: visible;
            }
          }
        `}</style>

        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">Retirement plan tracker</h1>
          <p className="max-w-3xl text-slate-600">
            Adjust savings, ESOP, spending, income streams, Roth conversions, scenarios, and withdrawal order to see how taxes and cash needs affect your plan over time.
          </p>
        </div>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Plan save / load</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4 items-end">
            <div className="space-y-2">
              <Label>Scenario name</Label>
              <Input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} placeholder="e.g. Retire62 Base" />
            </div>

            <button
              type="button"
              onClick={saveScenario}
              className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm hover:bg-slate-50"
            >
              <Save className="h-4 w-4" />
              Save scenario
            </button>

            <div className="space-y-2">
              <Label>Load saved scenario</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={scenarioName}
                onChange={(e) => {
                  setScenarioName(e.target.value);
                  loadScenario(e.target.value);
                }}
              >
                <option value="">Select scenario</option>
                {savedScenarios.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportPlanJson}
                className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export plan
              </button>

              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" />
                Import plan
              </button>

              <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={importPlanJson} />
            </div>

            <div className="md:col-span-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              {importMessage ||
                "Scenarios save in this browser. Export/import lets you move a plan between devices. Cloud sync with Google Drive/login needs a backend and OAuth setup, so this app includes local save tools only."}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="Portfolio at retirement"
            value={fmtCurrency(projectedPortfolioAtRetirement)}
            subtitle={`At age ${retireAge}`}
            icon={PiggyBank}
            onClick={() => setActiveTab("inputs")}
          />
          <SummaryCard
            title="First-year distribution"
            value={firstYear ? fmtCurrency(firstYear.totalPortfolioDistribution) : "$0"}
            subtitle="Cash withdrawals + Roth + RMD"
            icon={DollarSign}
            onClick={() => setActiveTab("details")}
          />
          <SummaryCard
            title="Portfolio at 67"
            value={age67Row ? fmtCurrency(age67Row.endPortfolio) : "—"}
            subtitle="Tax-deferred balance after early years"
            icon={TrendingUp}
            onClick={() => setActiveTab("details")}
          />
          <SummaryCard
            title="Roth at 67"
            value={age67Row ? fmtCurrency(age67Row.endRoth) : "—"}
            subtitle="Roth balance after early years"
            icon={PiggyBank}
            onClick={() => setActiveTab("details")}
          />
          <SummaryCard
            title="Plan status"
            value={healthLabel}
            subtitle={finalYear ? `Ending net worth ${fmtCurrency(finalYear.netWorth)}` : ""}
            icon={Home}
            onClick={() => setActiveTab("projection")}
          />
        </div>

        <Card className={`rounded-2xl shadow-sm ${selfChecksPassed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <CardContent className="p-4 text-sm">
            {selfChecksPassed
              ? "Built-in calculation checks passed."
              : "One or more built-in calculation checks failed. Review tax and distribution logic before relying on results."}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="hidden w-full grid-cols-4 rounded-2xl bg-white p-1 shadow-sm md:grid">
            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={`rounded-xl px-4 py-3 text-sm font-medium ${activeTab === "summary" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("inputs")}
              className={`rounded-xl px-4 py-3 text-sm font-medium ${activeTab === "inputs" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              Inputs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("projection")}
              className={`rounded-xl px-4 py-3 text-sm font-medium ${activeTab === "projection" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              Projection
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`rounded-xl px-4 py-3 text-sm font-medium ${activeTab === "details" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              Year-by-year
            </button>
          </div>

          {activeTab === "summary" && (
          <div className="space-y-4">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Planner Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-slate-500">Safe spending estimate</p>
                  <p className="mt-1 text-2xl font-semibold">{fmtCurrency(safeSpendingEstimate)}/mo</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-slate-500">Recommended Roth conversion</p>
                  <p className="mt-1 text-sm font-medium">{recommendedRothConversion}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-slate-500">Depletion age</p>
                  <p className="mt-1 text-2xl font-semibold">{combinedDepletedAge ?? "Not depleted"}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-slate-500">Lifetime federal tax</p>
                  <p className="mt-1 text-2xl font-semibold">{fmtCurrency(lifetimeFederalTax)}</p>
                  <p className="mt-1 text-xs text-slate-500">State tax: {fmtCurrency(lifetimeStateTax)} | IRMAA: {fmtCurrency(lifetimeIRMAA)}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-slate-500">After-tax estate value</p>
                  <p className="mt-1 text-2xl font-semibold">{fmtCurrency(estimatedAfterTaxNetWorth)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Warning badges</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {portfolioDepletedAge ? <span className="rounded-full bg-red-100 px-3 py-2 text-sm font-medium text-red-800">Portfolio depleted at {portfolioDepletedAge}</span> : <span className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800">Portfolio not depleted</span>}
                {irmaaTriggeredAge ? <span className="rounded-full bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">IRMAA triggered at {irmaaTriggeredAge}</span> : <span className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800">No IRMAA triggered</span>}
                {rothUsedEarlyAge ? <span className="rounded-full bg-orange-100 px-3 py-2 text-sm font-medium text-orange-800">Roth used early at {rothUsedEarlyAge}</span> : <span className="rounded-full bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800">Roth preserved early</span>}
                {rmdStartAge ? <span className="rounded-full bg-blue-100 px-3 py-2 text-sm font-medium text-blue-800">RMD starts at {rmdStartAge}</span> : <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">No RMD projected</span>}
                {taxSpikeRow ? <span className="rounded-full bg-purple-100 px-3 py-2 text-sm font-medium text-purple-800">Tax spike at {taxSpikeRow.age}: {fmtCurrency(taxSpikeRow.federalTax + taxSpikeRow.stateTax + taxSpikeRow.irmaa)}</span> : null}
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Saved scenario compare</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
                {[
                  { label: "Conservative", row: scenarioSummaries.find((s) => s.name === "Worst case") },
                  { label: "Base", row: scenarioSummaries.find((s) => s.name === "Base case") },
                  { label: "Aggressive", row: scenarioSummaries.find((s) => s.name === "Best case") },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border p-4">
                    <div className="font-medium">{item.label}</div>
                    <div>Ending net worth: {fmtCurrency(item.row?.endingNetWorth ?? 0)}</div>
                    <div>Ending portfolio: {fmtCurrency(item.row?.endingPortfolio ?? 0)}</div>
                    <div>Depletion age: {item.row?.depletionAge ?? "Not depleted"}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm"
              >
                Print / Save PDF report
              </button>
              <button
                type="button"
                onClick={() => exportRowsToExcel(results)}
                className="rounded-xl border px-5 py-3 text-sm font-medium shadow-sm"
              >
                Download Excel
              </button>
            </div>
          </div>
          )}

          {activeTab === "inputs" && (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="rounded-2xl shadow-sm xl:col-span-1">
                <CardHeader>
                  <CardTitle>Timing</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
                  <NumberField label="Current age" value={currentAge} onChange={(v) => update("currentAge", v)} step={1} />
                  <NumberField label="Retirement age" value={retireAge} onChange={(v) => update("retireAge", v)} step={1} />
                  <NumberField label="Projection end age" value={endAge} onChange={(v) => update("endAge", v)} step={1} />
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm xl:col-span-2">
                <CardHeader>
                  <CardTitle>Savings and returns</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <NumberField label="Portfolio now" value={portfolioNow} onChange={(v) => update("portfolioNow", v)} />
                  <NumberField label="ESOP at retirement" value={esopAtRetirement} onChange={(v) => update("esopAtRetirement", v)} />
                  <NumberField label="Annual contribution" value={annualContribution} onChange={(v) => update("annualContribution", v)} />
                  <NumberField label="Pre-retirement return %" value={preRetirementReturn} onChange={(v) => update("preRetirementReturn", v)} step={0.1} />
                  <div className="space-y-2 md:col-span-2 xl:col-span-4">
                    <div className="flex items-center justify-between">
                      <Label>Post-retirement return</Label>
                      <span className="text-sm text-slate-500">{fmtPercent(postRetirementReturn)}</span>
                    </div>
                    <Slider value={[postRetirementReturn]} min={0} max={10} step={0.1} onValueChange={(v) => update("postRetirementReturn", v[0])} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-4">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Spending</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <NumberField label="Monthly spending until 67" value={monthlySpendBefore67} onChange={(v) => update("monthlySpendBefore67", v)} />
                  <NumberField label="Monthly spending after 67" value={monthlySpendAfter67} onChange={(v) => update("monthlySpendAfter67", v)} />
                  <NumberField label="Monthly spending after 77" value={monthlySpendAfter77} onChange={(v) => update("monthlySpendAfter77", v)} />
                  <div className="flex items-center justify-between rounded-2xl border p-3">
                    <div>
                      <Label>Inflate spending each year</Label>
                      <p className="text-sm text-slate-500">Use this if spending inputs are in today’s dollars.</p>
                    </div>
                    <Switch checked={expenseInflationEnabled} onCheckedChange={(v) => update("expenseInflationEnabled", v)} />
                  </div>
                  <NumberField label="Expense inflation rate %" value={expenseInflationRate} onChange={(v) => update("expenseInflationRate", v)} step={0.1} />
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>One-time expenses</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <NumberField label="Car age" value={carExpenseAge} onChange={(v) => update("carExpenseAge", v)} step={1} />
                  <NumberField label="Car amount" value={carExpenseAmount} onChange={(v) => update("carExpenseAmount", v)} />
                  <NumberField label="Remodel age" value={remodelExpenseAge} onChange={(v) => update("remodelExpenseAge", v)} step={1} />
                  <NumberField label="Remodel amount" value={remodelExpenseAmount} onChange={(v) => update("remodelExpenseAmount", v)} />
                  <NumberField label="Medical event age" value={medicalExpenseAge} onChange={(v) => update("medicalExpenseAge", v)} step={1} />
                  <NumberField label="Medical event amount" value={medicalExpenseAmount} onChange={(v) => update("medicalExpenseAmount", v)} />
                  <NumberField label="Family help age" value={familyHelpAge} onChange={(v) => update("familyHelpAge", v)} step={1} />
                  <NumberField label="Family help amount" value={familyHelpAmount} onChange={(v) => update("familyHelpAmount", v)} />
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Federal tax settings</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Filing status</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={taxFilingStatus} onChange={(e) => update("taxFilingStatus", e.target.value as FilingStatus)}>
                      <option value="mfj">Married filing jointly</option>
                      <option value="single">Single</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>State tax location</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-3 text-sm" value={stateTaxRegion} onChange={(e) => update("stateTaxRegion", e.target.value as AppState["stateTaxRegion"])}>
                      <option value="wa">Washington - none</option>
                      <option value="ca">California - estimate</option>
                      <option value="id">Idaho - estimate</option>
                      <option value="az">Arizona - estimate</option>
                    </select>
                  </div>
                  <NumberField label="Standard deduction" value={federalDeduction} onChange={(v) => update("federalDeduction", v)} step={100} />
                  <NumberField label="Bracket inflation rate %" value={inflationRate} onChange={(v) => update("inflationRate", v)} step={0.1} />
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Withdrawal strategy</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Withdrawal order</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={withdrawalStrategy} onChange={(e) => update("withdrawalStrategy", e.target.value as WithdrawalStrategy)}>
                      <option value="esop_first_roth_last">ESOP first, Roth last</option>
                      <option value="portfolio_first_roth_last">Portfolio first, Roth last</option>
                      <option value="pro_rata_roth_last">Pro rata, Roth last</option>
                      <option value="esop_first_roth_early">ESOP first, Roth earlier</option>
                      <option value="portfolio_first_roth_early">Portfolio first, Roth earlier</option>
                    </select>
                  </div>
                  <p className="text-sm text-slate-500">
                    Tax-deferred portfolio withdrawals and taxable ESOP withdrawals are included in the federal tax calculation.
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Roth conversions</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex items-center justify-between rounded-2xl border p-3">
                    <div>
                      <Label>Auto conversion mode</Label>
                      <p className="text-sm text-slate-500">Fill a target bracket automatically each year.</p>
                    </div>
                    <Switch checked={autoRothMode} onCheckedChange={(v) => update("autoRothMode", v)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Target top bracket</Label>
                    <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={String(targetTopBracket)} onChange={(e) => update("targetTopBracket", Number(e.target.value))}>
                      <option value="0.12">12%</option>
                      <option value="0.22">22%</option>
                      <option value="0.24">24%</option>
                    </select>
                  </div>
                  <NumberField label="Annual conversion before 67" value={rothConversionBefore67} onChange={(v) => update("rothConversionBefore67", v)} />
                  <NumberField label="Annual conversion after 67" value={rothConversionAfter67} onChange={(v) => update("rothConversionAfter67", v)} />
                  <NumberField label="Stop conversion at age" value={rothConversionStopAge} onChange={(v) => update("rothConversionStopAge", v)} step={1} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="rounded-2xl shadow-sm xl:col-span-2">
                <CardHeader>
                  <CardTitle>Income streams</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <NumberField label="Your SS start age" value={ssUserAge} onChange={(v) => update("ssUserAge", v)} step={1} />
                  <NumberField label="Your SS monthly" value={ssUserMonthly} onChange={(v) => update("ssUserMonthly", v)} />
                  <NumberField label="Spouse SS start age" value={ssSpouseAge} onChange={(v) => update("ssSpouseAge", v)} step={1} />
                  <NumberField label="Spouse SS monthly" value={ssSpouseMonthly} onChange={(v) => update("ssSpouseMonthly", v)} />

                  <div className="flex items-center justify-between rounded-2xl border p-3 md:col-span-2 xl:col-span-2">
                    <div>
                      <Label>Inflate Social Security each year</Label>
                      <p className="text-sm text-slate-500">Applies an annual COLA-style increase after benefits start.</p>
                    </div>
                    <Switch checked={ssInflationEnabled} onCheckedChange={(v) => update("ssInflationEnabled", v)} />
                  </div>

                  <NumberField label="Social Security inflation rate %" value={ssInflationRate} onChange={(v) => update("ssInflationRate", v)} step={0.1} />
                  <NumberField label="Pension start age" value={pensionAge} onChange={(v) => update("pensionAge", v)} step={1} />
                  <NumberField label="Pension monthly" value={pensionMonthly} onChange={(v) => update("pensionMonthly", v)} />
                  <NumberField label="Rental monthly" value={rentalMonthly} onChange={(v) => update("rentalMonthly", v)} />
                  <NumberField label="Policy 1 age" value={policy1Age} onChange={(v) => update("policy1Age", v)} step={1} />
                  <NumberField label="Policy 1 lump sum" value={policy1Value} onChange={(v) => update("policy1Value", v)} />
                  <NumberField label="Policy 2 age" value={policy2Age} onChange={(v) => update("policy2Age", v)} step={1} />
                  <NumberField label="Policy 2 lump sum" value={policy2Value} onChange={(v) => update("policy2Value", v)} />

                  <div className="flex items-center justify-between rounded-2xl border p-3">
                    <div>
                      <Label>Rental taxable</Label>
                      <p className="text-sm text-slate-500">Turn on only if it should be included in taxable income.</p>
                    </div>
                    <Switch checked={rentalTaxable} onCheckedChange={(v) => update("rentalTaxable", v)} />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border p-3">
                    <div>
                      <Label>ESOP taxable</Label>
                      <p className="text-sm text-slate-500">Turn on if ESOP withdrawals are taxed like ordinary income.</p>
                    </div>
                    <Switch checked={esopTaxable} onCheckedChange={(v) => update("esopTaxable", v)} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border p-3">
                    <div>
                      <Label>Long-term care scenario</Label>
                      <p className="text-sm text-slate-500">Adds a future annual care cost.</p>
                    </div>
                    <Switch checked={longTermCareEnabled} onCheckedChange={(v) => update("longTermCareEnabled", v)} />
                  </div>
                  <NumberField label="LTC start age" value={longTermCareStartAge} onChange={(v) => update("longTermCareStartAge", v)} step={1} />
                  <NumberField label="LTC years" value={longTermCareYears} onChange={(v) => update("longTermCareYears", v)} step={1} />
                  <NumberField label="LTC annual cost" value={longTermCareAnnualCost} onChange={(v) => update("longTermCareAnnualCost", v)} />
                  <NumberField label="Spouse-survivor start age" value={spouseDeathAge} onChange={(v) => update("spouseDeathAge", v)} step={1} />
                  <NumberField label="Survivor spending %" value={survivorSpendingPercent} onChange={(v) => update("survivorSpendingPercent", v)} step={1} />
                  <div className="flex items-center justify-between rounded-2xl border p-3">
                    <div>
                      <Label>Survivor keeps higher SS</Label>
                      <p className="text-sm text-slate-500">Use higher of two Social Security benefits.</p>
                    </div>
                    <Switch checked={survivorKeepsHigherSS} onCheckedChange={(v) => update("survivorKeepsHigherSS", v)} />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Home value</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <NumberField label="Home paid off age" value={homePayoffAge} onChange={(v) => update("homePayoffAge", v)} step={1} />
                  <NumberField label="Home value at payoff" value={homeValueAtPayoff} onChange={(v) => update("homeValueAtPayoff", v)} />
                  <div className="flex items-center justify-between rounded-2xl border p-3">
                    <div>
                      <Label>Include home in net worth</Label>
                      <p className="text-sm text-slate-500">Useful for backup-option planning.</p>
                    </div>
                    <Switch checked={includeHomeInNetWorth} onCheckedChange={(v) => update("includeHomeInNetWorth", v)} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border p-3">
                    <div>
                      <Label>Appreciate home value annually</Label>
                      <p className="text-sm text-slate-500">Apply annual appreciation after payoff.</p>
                    </div>
                    <Switch checked={homeAppreciationEnabled} onCheckedChange={(v) => update("homeAppreciationEnabled", v)} />
                  </div>
                  <NumberField label="Home appreciation rate %" value={homeAppreciationRate} onChange={(v) => update("homeAppreciationRate", v)} step={0.1} />
                </CardContent>
              </Card>
            </div>
          </div>
          )}

          {activeTab === "projection" && (
          <div className="space-y-4">
            {row62 ? (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Tax breakdown and marginal impact at age 62</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-4 text-sm">
                  <div className="rounded-xl border p-3">
                    <div className="font-medium">Roth conversion impact</div>
                    <div>{fmtCurrency(row62.federalTax - (row62WithoutRothTax?.federalTax ?? row62.federalTax))}</div>
                    <div className="text-xs text-slate-500">
                      Last-dollar rate: {fmtPercent(row62.topRate * 100)}
                    </div>
                    <div className="text-xs text-slate-500">
                      IRMAA impact: {fmtCurrency(row62.irmaa - (row62WithoutRothTax?.irmaa ?? row62.irmaa))}
                    </div>
                  </div>

                  <div className="rounded-xl border p-3">
                    <div className="font-medium">Social Security impact</div>
                    <div>{fmtCurrency(row62.federalTax - (row62WithoutSSTax?.federalTax ?? row62.federalTax))}</div>
                    <div className="text-xs text-slate-500">
                      Taxable SS: {fmtCurrency(row62.taxableSS)}
                    </div>
                    <div className="text-xs text-slate-500">
                      IRMAA impact: {fmtCurrency(row62.irmaa - (row62WithoutSSTax?.irmaa ?? row62.irmaa))}
                    </div>
                  </div>

                  <div className="rounded-xl border p-3">
                    <div className="font-medium">RMD impact</div>
                    <div>{fmtCurrency(row62.federalTax - (row62WithoutRmdTax?.federalTax ?? row62.federalTax))}</div>
                    <div className="text-xs text-slate-500">
                      RMD: {fmtCurrency(row62.rmd)}
                    </div>
                    <div className="text-xs text-slate-500">
                      IRMAA impact: {fmtCurrency(row62.irmaa - (row62WithoutRmdTax?.irmaa ?? row62.irmaa))}
                    </div>
                  </div>

                  <div className="rounded-xl border p-3">
                    <div className="font-medium">Total federal tax</div>
                    <div>{fmtCurrency(row62.federalTax)}</div>
                    <div className="text-xs text-slate-500">
                      Taxable income: {fmtCurrency(row62.taxableIncome)}
                    </div>
                    <div className="text-xs text-slate-500">
                      IRMAA: {fmtCurrency(row62.irmaa)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>ESOP taxable vs tax-free impact</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
                <div className="rounded-xl border p-3">
                  <div className="font-medium">Taxable ESOP</div>
                  <div>Age 62 federal tax: {fmtCurrency(esopTaxableFirstYear?.federalTax ?? 0)}</div>
                  <div>Total federal tax: {fmtCurrency(esopTaxableTotalFederalTax)}</div>
                  <div>Ending net worth: {fmtCurrency(esopTaxableFinalYear?.netWorth ?? 0)}</div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="font-medium">Tax-free ESOP</div>
                  <div>Age 62 federal tax: {fmtCurrency(esopTaxFreeFirstYear?.federalTax ?? 0)}</div>
                  <div>Total federal tax: {fmtCurrency(esopTaxFreeTotalFederalTax)}</div>
                  <div>Ending net worth: {fmtCurrency(esopTaxFreeFinalYear?.netWorth ?? 0)}</div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="font-medium">Difference</div>
                  <div>
                    Age 62 tax increase:{" "}
                    {fmtCurrency((esopTaxableFirstYear?.federalTax ?? 0) - (esopTaxFreeFirstYear?.federalTax ?? 0))}
                  </div>
                  <div>Total tax increase: {fmtCurrency(esopTaxableTotalFederalTax - esopTaxFreeTotalFederalTax)}</div>
                  <div>
                    Net worth change:{" "}
                    {fmtCurrency((esopTaxableFinalYear?.netWorth ?? 0) - (esopTaxFreeFinalYear?.netWorth ?? 0))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Scenario compare</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <NumberField label="Best case return %" value={bestCaseReturn} onChange={(v) => update("bestCaseReturn", v)} step={0.1} />
                  <NumberField label="Base case return %" value={baseCaseReturn} onChange={(v) => update("baseCaseReturn", v)} step={0.1} />
                  <NumberField label="Worst case return %" value={worstCaseReturn} onChange={(v) => update("worstCaseReturn", v)} step={0.1} />

                  <div className="md:col-span-3 grid gap-3 md:grid-cols-3">
                    {scenarioSummaries.map((scenario) => (
                      <div key={scenario.name} className="rounded-xl border p-3 text-sm">
                        <div className="font-medium">
                          {scenario.name} ({fmtPercent(scenario.returnRate)})
                        </div>
                        <div>Ending portfolio: {fmtCurrency(scenario.endingPortfolio)}</div>
                        <div>Ending Roth: {fmtCurrency(scenario.endingRoth)}</div>
                        <div>Ending ESOP: {fmtCurrency(scenario.endingEsop)}</div>
                        <div>Ending net worth: {fmtCurrency(scenario.endingNetWorth)}</div>
                        <div>
                          {scenario.depletionAge
                            ? `Portfolio + Roth depleted at ${scenario.depletionAge}`
                            : "Portfolio + Roth not depleted"}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Monte Carlo</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <NumberField label="Runs" value={monteCarloRuns} onChange={(v) => update("monteCarloRuns", v)} step={10} min={50} />
                  <NumberField label="Mean return %" value={monteCarloMeanReturn} onChange={(v) => update("monteCarloMeanReturn", v)} step={0.1} />
                  <NumberField label="Std dev %" value={monteCarloStdDev} onChange={(v) => update("monteCarloStdDev", v)} step={0.1} />

                  <div className="md:col-span-3 rounded-xl border p-3 text-sm">
                    <div className="font-medium">Success rate: {fmtPercent(monteCarloSummary.successRate)}</div>
                    <div>Median ending net worth: {fmtCurrency(monteCarloSummary.median)}</div>
                    <div>10th percentile: {fmtCurrency(monteCarloSummary.p10)}</div>
                    <div>90th percentile: {fmtCurrency(monteCarloSummary.p90)}</div>
                    <div>Runs: {monteCarloSummary.runs}</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Portfolio, Roth, ESOP, and net worth over time</CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-hidden">
                <div className="h-[420px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="age" />
                      <YAxis tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} />
                      <Tooltip formatter={(value) => fmtCurrency(Number(value))} />
                      <Legend />
                      <Line type="monotone" dataKey="Portfolio" strokeWidth={2} dot={false} stroke="#2563eb" />
                      <Line type="monotone" dataKey="Roth" strokeWidth={2} dot={false} stroke="#16a34a" />
                      <Line type="monotone" dataKey="ESOP" strokeWidth={2} dot={false} stroke="#f59e0b" />
                      <Line type="monotone" dataKey="NetWorth" strokeWidth={2} dot={false} stroke="#7c3aed" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-slate-500">Minimum tax-deferred portfolio</p>
                  <p className="mt-1 text-2xl font-semibold">{fmtCurrency(minPortfolio)}</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-slate-500">Ending portfolio balance</p>
                  <p className="mt-1 text-2xl font-semibold">{finalYear ? fmtCurrency(finalYear.endPortfolio) : "—"}</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-slate-500">Ending Roth balance</p>
                  <p className="mt-1 text-2xl font-semibold">{finalYear ? fmtCurrency(finalYear.endRoth) : "—"}</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-slate-500">Ending ESOP balance</p>
                  <p className="mt-1 text-2xl font-semibold">{finalYear ? fmtCurrency(finalYear.endEsop) : "—"}</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-slate-500">Remaining ESOP at 67</p>
                  <p className="mt-1 text-2xl font-semibold">{age67Row ? fmtCurrency(age67Row.endEsop) : "—"}</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-slate-500">First-year tax + IRMAA</p>
                  <p className="mt-1 text-2xl font-semibold">{firstYear ? fmtCurrency(firstYear.federalTax + firstYear.irmaa) : "—"}</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-slate-500">Portfolio depletion age</p>
                  <p className="mt-1 text-2xl font-semibold">{portfolioDepletedAge ?? "Not depleted"}</p>
                  <p className="mt-1 text-sm text-slate-500">Tax-deferred portfolio only</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-5">
                  <p className="text-sm text-slate-500">Portfolio + Roth depletion age</p>
                  <p className="mt-1 text-2xl font-semibold">{combinedDepletedAge ?? "Not depleted"}</p>
                  <p className="mt-1 text-sm text-slate-500">Combined investable retirement assets</p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm md:col-span-2 xl:col-span-4">
                <CardContent className="p-5">
                  <p className="text-sm text-slate-500">Estimated after-tax net worth</p>
                  <p className="mt-1 text-2xl font-semibold">{fmtCurrency(estimatedAfterTaxNetWorth)}</p>
                  <p className="mt-1 text-sm text-slate-500">Uses final-year marginal federal rate on tax-deferred assets</p>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl shadow-sm border-amber-200 bg-amber-50">
              <CardContent className="flex gap-3 p-5 text-amber-900">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="text-sm">
                  This version includes federal tax on Roth conversions, RMDs, tax-deferred portfolio withdrawals, and taxable ESOP withdrawals. It also includes provisional-income Social Security taxation, IRMAA, inflation-adjusted brackets, local scenario save/load, JSON export/import, and Excel export. It does not model state tax or the actual two-year IRMAA lookback.
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          {activeTab === "details" && (
          <div className="h-[calc(100vh-180px)] overflow-hidden">
            <Card className="flex h-full w-full flex-col rounded-2xl shadow-sm">
              <CardHeader className="shrink-0 flex flex-row items-center justify-between gap-4">
                <CardTitle>Year-by-year cash flow and tax view</CardTitle>
                <button
                  type="button"
                  onClick={() => exportRowsToExcel(results)}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Download to Excel
                </button>
              </CardHeader>

              <CardContent>
                {(() => {
                  const headers = [
                    "Age",
                    "Spend",
                    "Spend gap",
                    "One-time",
                    "LTC",
                    "Social Security",
                    "Taxable SS",
                    "Pension",
                    "Rental",
                    "Insurance",
                    "Taxable income",
                    "Federal tax",
                    "State tax",
                    "IRMAA",
                    "Top bracket",
                    "Taxable portfolio",
                    "Taxable ESOP",
                    "Roth conv.",
                    "RMD",
                    "Total distribution",
                    "ESOP used",
                    "Portfolio used",
                    "Roth used",
                    "Portfolio to Roth",
                    "End portfolio",
                    "End Roth",
                    "End ESOP",
                    "Net worth",
                  ];

                  return (
                    <div className="year-grid-shell">
                      <div ref={yearHeaderRef} className="year-grid-header-scroll">
                        <div className="year-grid">
                          <div className="year-grid-row">
                            {headers.map((label, index) => (
                              <div
                                key={label}
                                className={`year-grid-cell year-grid-header ${index === 0 ? "year-grid-age" : ""}`}
                              >
                                {label}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div
                        className="year-grid-body-scroll"
                        onScroll={(e) => {
                          if (yearHeaderRef.current) {
                            yearHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft;
                          }
                        }}
                      >
                        <div className="year-grid">
                          {results.map((row) => {
                            const cells = [
                              row.age,
                              fmtCurrency(row.annualSpend),
                              fmtCurrency(row.spendFundingNeed),
                              fmtCurrency(row.oneTimeExpense),
                              fmtCurrency(row.longTermCareExpense),
                              fmtCurrency(row.totalSS),
                              fmtCurrency(row.taxableSS),
                              fmtCurrency(row.pension),
                              fmtCurrency(row.rental),
                              fmtCurrency(row.insuranceIncome),
                              fmtCurrency(row.taxableIncome),
                              fmtCurrency(row.federalTax),
                              fmtCurrency(row.stateTax),
                              fmtCurrency(row.irmaa),
                              fmtPercent(row.topRate * 100),
                              fmtCurrency(row.taxablePortfolioWithdrawal),
                              fmtCurrency(row.taxableEsopWithdrawal),
                              fmtCurrency(row.rothConversion),
                              fmtCurrency(row.rmd),
                              fmtCurrency(row.totalPortfolioDistribution),
                              fmtCurrency(row.esopWithdrawal),
                              fmtCurrency(row.portfolioWithdrawal),
                              fmtCurrency(row.rothCashWithdrawal),
                              fmtCurrency(row.conversionFromPortfolio),
                              fmtCurrency(row.endPortfolio),
                              fmtCurrency(row.endRoth),
                              fmtCurrency(row.endEsop),
                              fmtCurrency(row.netWorth),
                            ];

                            return (
                              <div className="year-grid-row" key={row.age}>
                                {cells.map((cell, index) => (
                                  <div
                                    key={`${row.age}-${index}`}
                                    className={`year-grid-cell ${index === 0 ? "year-grid-age" : ""}`}
                                  >
                                    {cell}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
          )}
        <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 gap-1 border-t bg-white/95 p-2 shadow-lg backdrop-blur md:hidden">
          {([
            ["summary", "Summary"],
            ["inputs", "Inputs"],
            ["projection", "Projection"],
            ["details", "Years"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value as "summary" | "inputs" | "projection" | "details")}
              className={`rounded-xl px-2 py-3 text-xs font-medium ${activeTab === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
