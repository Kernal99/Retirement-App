"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  withdrawalStrategy: WithdrawalStrategy;
};

type Bracket = {
  limit: number;
  rate: number;
};

type ResultRow = {
  age: number;
  annualSpend: number;
  federalTax: number;
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

type OptimizerRow = {
  age: number;
  recommendedConversion: number;
  targetBracket: string;
  irmaaSafe: boolean;
  withdrawalMix: string;
  recommendedStrategy: string;
  reason: string;
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

function SummaryCard({ title, value, subtitle, icon: Icon }: SummaryCardProps) {
  return (
    <Card className="rounded-2xl shadow-sm">
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


function getIRMAAThreshold(age: number, filingStatus: FilingStatus) {
  if (age < 65) return Number.POSITIVE_INFINITY;
  return filingStatus === "single" ? 106000 : 212000;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
  const importRef = useRef<HTMLInputElement | null>(null);

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
    const irmaa = calcIRMAA(params.age, taxFilingStatus, otherIncome + taxableSS);

    return {
      federalTax: taxResult.tax,
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

      const annualSpend = expenseInflationEnabled
        ? spendBase * Math.pow(1 + expenseInflationRate / 100, spendInflationYears)
        : spendBase;

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

      const totalSS = userSS + spouseSS;
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
        let remainingCashNeed = spendFundingNeed + federalTax + irmaa;

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
          Math.abs(taxCalc.irmaa - irmaa) < 1;

        federalTax = taxCalc.federalTax;
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
        federalTax,
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

  const optimizerRows = useMemo<OptimizerRow[]>(() => {
    return results.map((row) => {
      const yearOffset = row.age - retireAge;
      const inflatedBrackets = getInflatedBrackets(yearOffset);
      const bracket12 = inflatedBrackets.find((bracket) => bracket.rate === 0.12);
      const bracket22 = inflatedBrackets.find((bracket) => bracket.rate === 0.22);

      const currentConversion = row.rothConversion;
      const taxableIncomeWithoutConversion = Math.max(0, row.taxableIncome - currentConversion);
      const irmaaThreshold = getIRMAAThreshold(row.age, taxFilingStatus);
      const roughMagiWithoutConversion = Math.max(
        0,
        row.taxableIncome + getInflatedDeduction(yearOffset) - currentConversion,
      );

      const roomTo12 =
        bracket12 && Number.isFinite(bracket12.limit)
          ? Math.max(0, bracket12.limit - taxableIncomeWithoutConversion)
          : 0;

      const roomTo22 =
        bracket22 && Number.isFinite(bracket22.limit)
          ? Math.max(0, bracket22.limit - taxableIncomeWithoutConversion)
          : 0;

      const roomBeforeIRMAA = Number.isFinite(irmaaThreshold)
        ? Math.max(0, irmaaThreshold - roughMagiWithoutConversion)
        : Number.POSITIVE_INFINITY;

      let recommendedConversion = 0;
      let targetBracket = "Avoid conversion";

      if (row.age < 67) {
        recommendedConversion = Math.min(roomTo22, roomBeforeIRMAA);
        targetBracket = "Fill 22% bracket";
      } else if (row.age < 73) {
        recommendedConversion = Math.min(roomTo12 || roomTo22, roomBeforeIRMAA);
        targetBracket = row.age >= 65 ? "IRMAA-safe 12%/22%" : "Fill 12% or low 22%";
      } else {
        recommendedConversion = Math.min(roomTo12, roomBeforeIRMAA);
        targetBracket = "RMD years: low-bracket room only";
      }

      recommendedConversion = clampNumber(
        recommendedConversion,
        0,
        Math.max(0, row.endPortfolio + row.rothConversion),
      );

      const irmaaSafe = row.irmaa === 0 && recommendedConversion <= roomBeforeIRMAA;
      const rothBeingUsed = row.rothCashWithdrawal > 0;
      const portfolioLow = row.endPortfolio <= 0;
      const rmdActive = row.rmd > 0;

      let withdrawalMix = "Use ESOP/taxable assets first; preserve Roth";
      let recommendedStrategy = "Balanced tax smoothing";
      let reason = "Use taxable income capacity without forcing unnecessary Roth withdrawals.";

      if (portfolioLow && row.endRoth > 0) {
        withdrawalMix = "Roth is funding spending because taxable portfolio is depleted";
        recommendedStrategy = "Reduce conversions / preserve taxable portfolio";
        reason = "Taxable assets are depleted before late retirement, which can make the plan too Roth-dependent.";
      } else if (row.age < 67) {
        withdrawalMix = "Use ESOP + controlled portfolio withdrawals; convert to Roth";
        recommendedStrategy = "Golden-window Roth conversions";
        reason = "Early years usually have lower brackets before pension, Medicare, and RMD pressure.";
      } else if (row.age >= 65 && row.irmaa > 0) {
        withdrawalMix = "Reduce conversion/ESOP stacking; avoid IRMAA cliff";
        recommendedStrategy = "IRMAA-safe income cap";
        reason = "Medicare surcharges are already triggered in this year.";
      } else if (rmdActive) {
        withdrawalMix = "Spend RMD first, then taxable/ESOP, Roth last";
        recommendedStrategy = "RMD-first Roth preservation";
        reason = "RMD is mandatory and taxable, so use it before adding optional taxable income.";
      } else if (rothBeingUsed && row.age < 73) {
        withdrawalMix = "Avoid Roth use if taxable assets remain";
        recommendedStrategy = "Preserve Roth for later";
        reason = "Early Roth withdrawals reduce tax-free compounding and legacy value.";
      }

      return {
        age: row.age,
        recommendedConversion,
        targetBracket,
        irmaaSafe,
        withdrawalMix,
        recommendedStrategy,
        reason,
      };
    });
  }, [results, retireAge, taxFilingStatus, federalBrackets, inflationRate]);

  const optimizerCurrentYear = optimizerRows.find((row) => row.age === retireAge) || optimizerRows[0] || null;
  const optimizerBadge = optimizerCurrentYear?.recommendedStrategy || "Balanced tax smoothing";
  const totalRecommendedConversions = optimizerRows.reduce((sum, row) => sum + row.recommendedConversion, 0);

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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
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
              className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50"
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
                className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export plan
              </button>

              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50"
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
          <SummaryCard title="Portfolio at retirement" value={fmtCurrency(projectedPortfolioAtRetirement)} subtitle={`At age ${retireAge}`} icon={PiggyBank} />
          <SummaryCard title="First-year distribution" value={firstYear ? fmtCurrency(firstYear.totalPortfolioDistribution) : "$0"} subtitle="Cash withdrawals + Roth + RMD" icon={DollarSign} />
          <SummaryCard title="Portfolio at 67" value={age67Row ? fmtCurrency(age67Row.endPortfolio) : "—"} subtitle="Tax-deferred balance after early years" icon={TrendingUp} />
          <SummaryCard title="Roth at 67" value={age67Row ? fmtCurrency(age67Row.endRoth) : "—"} subtitle="Roth balance after early years" icon={PiggyBank} />
          <SummaryCard title="Plan status" value={healthLabel} subtitle={finalYear ? `Ending net worth ${fmtCurrency(finalYear.netWorth)}` : ""} icon={Home} />
        </div>

        <Card className={`rounded-2xl shadow-sm ${selfChecksPassed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <CardContent className="p-4 text-sm">
            {selfChecksPassed
              ? "Built-in calculation checks passed."
              : "One or more built-in calculation checks failed. Review tax and distribution logic before relying on results."}
          </CardContent>
        </Card>

        <Tabs defaultValue="inputs" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 rounded-2xl">
            <TabsTrigger value="inputs">Inputs</TabsTrigger>
            <TabsTrigger value="projection">Projection</TabsTrigger>
            <TabsTrigger value="details">Year-by-year</TabsTrigger>
          </TabsList>

          <TabsContent value="inputs" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="projection" className="space-y-4">

            <Card className="rounded-2xl shadow-sm border-emerald-200 bg-emerald-50">
              <CardHeader>
                <CardTitle>Withdrawal and Roth conversion optimizer</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-4">
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-sm text-slate-500">Recommended strategy badge</p>
                  <p className="mt-1 text-lg font-semibold">{optimizerBadge}</p>
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-sm text-slate-500">Current-year Roth conversion target</p>
                  <p className="mt-1 text-2xl font-semibold">{fmtCurrency(optimizerCurrentYear?.recommendedConversion ?? 0)}</p>
                  <p className="mt-1 text-xs text-slate-500">{optimizerCurrentYear?.targetBracket}</p>
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-sm text-slate-500">IRMAA status</p>
                  <p className="mt-1 text-lg font-semibold">{optimizerCurrentYear?.irmaaSafe ? "IRMAA-safe" : "IRMAA caution"}</p>
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-sm text-slate-500">Total suggested conversions</p>
                  <p className="mt-1 text-2xl font-semibold">{fmtCurrency(totalRecommendedConversions)}</p>
                </div>
                <div className="xl:col-span-4 rounded-xl border bg-white p-4">
                  <p className="text-sm text-slate-500">Recommended withdrawal mix</p>
                  <p className="mt-1 font-medium">{optimizerCurrentYear?.withdrawalMix}</p>
                  <p className="mt-1 text-sm text-slate-500">{optimizerCurrentYear?.reason}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Optimizer by year</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[420px] overflow-auto">
                <Table className="min-w-[1100px] text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Age</TableHead>
                      <TableHead>Recommended conversion</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>IRMAA safe</TableHead>
                      <TableHead>Withdrawal mix</TableHead>
                      <TableHead>Strategy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {optimizerRows.map((row) => (
                      <TableRow key={row.age}>
                        <TableCell className="font-medium">{row.age}</TableCell>
                        <TableCell>{fmtCurrency(row.recommendedConversion)}</TableCell>
                        <TableCell>{row.targetBracket}</TableCell>
                        <TableCell>{row.irmaaSafe ? "Yes" : "Caution"}</TableCell>
                        <TableCell>{row.withdrawalMix}</TableCell>
                        <TableCell>{row.recommendedStrategy}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>


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
              <CardContent>
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
          </TabsContent>

          <TabsContent value="details">
            <Card className="rounded-2xl shadow-sm w-full">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>Year-by-year cash flow and tax view</CardTitle>
                <button
                  type="button"
                  onClick={() => exportRowsToExcel(results)}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Download to Excel
                </button>
              </CardHeader>

              <CardContent className="w-full overflow-x-auto">
                <Table className="w-full min-w-[2250px] text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-30 bg-white border-r" rowSpan={2}>
                        Age
                      </TableHead>
                      <TableHead colSpan={2} className="text-center">Spending</TableHead>
                      <TableHead colSpan={5} className="text-center">Income</TableHead>
                      <TableHead colSpan={6} className="text-center">Taxes</TableHead>
                      <TableHead colSpan={7} className="text-center">Withdrawals</TableHead>
                      <TableHead colSpan={4} className="text-center">Ending Balances</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead>Spend</TableHead>
                      <TableHead>Spend gap</TableHead>

                      <TableHead>Social Security</TableHead>
                      <TableHead>Taxable SS</TableHead>
                      <TableHead>Pension</TableHead>
                      <TableHead>Rental</TableHead>
                      <TableHead>Insurance</TableHead>

                      <TableHead>Taxable income</TableHead>
                      <TableHead>Federal tax</TableHead>
                      <TableHead>IRMAA</TableHead>
                      <TableHead>Top bracket</TableHead>
                      <TableHead>Taxable portfolio</TableHead>
                      <TableHead>Taxable ESOP</TableHead>

                      <TableHead>Roth conv.</TableHead>
                      <TableHead>RMD</TableHead>
                      <TableHead>Total distribution</TableHead>
                      <TableHead>ESOP used</TableHead>
                      <TableHead>Portfolio used</TableHead>
                      <TableHead>Roth used</TableHead>
                      <TableHead>Portfolio to Roth</TableHead>

                      <TableHead>End portfolio</TableHead>
                      <TableHead>End Roth</TableHead>
                      <TableHead>End ESOP</TableHead>
                      <TableHead>Net worth</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {results.map((row) => (
                      <TableRow key={row.age}>
                        <TableCell className="sticky left-0 z-20 bg-white border-r font-medium">{row.age}</TableCell>
                        <TableCell>{fmtCurrency(row.annualSpend)}</TableCell>
                        <TableCell>{fmtCurrency(row.spendFundingNeed)}</TableCell>

                        <TableCell>{fmtCurrency(row.totalSS)}</TableCell>
                        <TableCell>{fmtCurrency(row.taxableSS)}</TableCell>
                        <TableCell>{fmtCurrency(row.pension)}</TableCell>
                        <TableCell>{fmtCurrency(row.rental)}</TableCell>
                        <TableCell>{fmtCurrency(row.insuranceIncome)}</TableCell>

                        <TableCell>{fmtCurrency(row.taxableIncome)}</TableCell>
                        <TableCell>{fmtCurrency(row.federalTax)}</TableCell>
                        <TableCell>{fmtCurrency(row.irmaa)}</TableCell>
                        <TableCell>{fmtPercent(row.topRate * 100)}</TableCell>
                        <TableCell>{fmtCurrency(row.taxablePortfolioWithdrawal)}</TableCell>
                        <TableCell>{fmtCurrency(row.taxableEsopWithdrawal)}</TableCell>

                        <TableCell>{fmtCurrency(row.rothConversion)}</TableCell>
                        <TableCell>{fmtCurrency(row.rmd)}</TableCell>
                        <TableCell>{fmtCurrency(row.totalPortfolioDistribution)}</TableCell>
                        <TableCell>{fmtCurrency(row.esopWithdrawal)}</TableCell>
                        <TableCell>{fmtCurrency(row.portfolioWithdrawal)}</TableCell>
                        <TableCell>{fmtCurrency(row.rothCashWithdrawal)}</TableCell>
                        <TableCell>{fmtCurrency(row.conversionFromPortfolio)}</TableCell>

                        <TableCell>{fmtCurrency(row.endPortfolio)}</TableCell>
                        <TableCell>{fmtCurrency(row.endRoth)}</TableCell>
                        <TableCell>{fmtCurrency(row.endEsop)}</TableCell>
                        <TableCell>{fmtCurrency(row.netWorth)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
