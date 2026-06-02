export type PatentInsightTimePoint = {
  year: number;
  count: number;
};

export type PatentInsightCountItem = {
  name: string;
  count: number;
};

export type PatentInsightApplicantItem = {
  applicant: string;
  count: number;
};

export type PatentInsightHeatmapItem = {
  target: string;
  year: number;
  count: number;
  applicant?: string;
};

export type PatentInsightStatistics = {
  totalCount: number;
  filteredCount: number;
  countAcrossTime: PatentInsightTimePoint[];
  patentPerOffice: PatentInsightCountItem[];
  filingLanguageCounts: PatentInsightCountItem[];
  patentTypeCounts: PatentInsightCountItem[];
  patentCountByApplicant: PatentInsightApplicantItem[];
  patentCountByTargetAndApplicant: PatentInsightHeatmapItem[];
};

const targets = [
  'ACE2', 'ALK', 'AR', 'BTK', 'CD19', 'CD20', 'CD3', 'CD33', 'CDK2', 'CDK4',
  'CDK6', 'CTLA4', 'EGFR', 'FLT3', 'HER2', 'IL-6', 'JAK1', 'JAK2', 'KIT',
  'MET', 'PARP', 'PD-1', 'PD-L1', 'PI3K', 'PSMA', 'STING', 'TNF', 'VEGF',
];

const heatmapYears = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

const targetBoosts: Record<string, number> = {
  EGFR: 170,
  'PD-1': 145,
  'PD-L1': 135,
  HER2: 110,
  MET: 125,
  CD3: 95,
  STING: 80,
};

export const mockPatentInsightStatistics: PatentInsightStatistics = {
  totalCount: 426028,
  filteredCount: 1899,
  countAcrossTime: [
    { year: 1978, count: 1 },
    { year: 1979, count: 27 },
    { year: 1980, count: 66 },
    { year: 1981, count: 73 },
    { year: 1982, count: 111 },
    { year: 1983, count: 144 },
    { year: 1984, count: 189 },
    { year: 1985, count: 233 },
    { year: 1986, count: 329 },
    { year: 1987, count: 411 },
    { year: 1988, count: 638 },
    { year: 1989, count: 831 },
    { year: 1990, count: 1050 },
    { year: 1991, count: 1420 },
    { year: 1992, count: 2025 },
    { year: 1993, count: 2290 },
    { year: 1994, count: 3124 },
    { year: 1995, count: 3636 },
    { year: 1996, count: 4449 },
    { year: 1997, count: 4707 },
    { year: 1998, count: 5796 },
    { year: 1999, count: 6810 },
    { year: 2000, count: 8696 },
    { year: 2001, count: 10276 },
    { year: 2002, count: 11604 },
    { year: 2003, count: 12640 },
    { year: 2004, count: 12860 },
    { year: 2005, count: 14119 },
    { year: 2006, count: 15765 },
    { year: 2007, count: 16896 },
    { year: 2008, count: 17450 },
    { year: 2009, count: 16826 },
    { year: 2010, count: 15329 },
    { year: 2011, count: 13942 },
    { year: 2012, count: 13608 },
    { year: 2013, count: 12464 },
    { year: 2014, count: 13463 },
    { year: 2015, count: 12241 },
    { year: 2016, count: 13057 },
    { year: 2017, count: 13962 },
    { year: 2018, count: 14131 },
    { year: 2019, count: 14809 },
    { year: 2020, count: 16713 },
    { year: 2021, count: 19079 },
    { year: 2022, count: 20363 },
    { year: 2023, count: 20591 },
    { year: 2024, count: 18809 },
    { year: 2025, count: 14695 },
    { year: 2026, count: 3281 },
  ],
  patentPerOffice: [
    { name: 'WO', count: 426028 },
    { name: 'US', count: 7200 },
    { name: 'KR', count: 2130 },
  ],
  filingLanguageCounts: [
    { name: 'English', count: 310660 },
    { name: '中文', count: 23397 },
    { name: 'Japanese', count: 22237 },
    { name: 'Korean', count: 10902 },
    { name: '기타', count: 58833 },
  ],
  patentTypeCounts: [
    { name: 'method of treatment', count: 203400 },
    { name: 'substance', count: 183920 },
    { name: 'null', count: 18200 },
    { name: 'crystal', count: 9800 },
    { name: 'salt', count: 5800 },
    { name: 'method', count: 3110 },
    { name: 'biomarker', count: 2100 },
  ],
  patentCountByApplicant: [
    { applicant: 'Novartis AG', count: 3776 },
    { applicant: 'The Regents Of The University Of California', count: 3541 },
    { applicant: 'Merck & Co., Inc.', count: 2589 },
    { applicant: 'Astrazeneca AB', count: 2452 },
    { applicant: 'Bristol-Myers Squibb Company', count: 2395 },
    { applicant: 'F. Hoffmann-La Roche AG', count: 2338 },
    { applicant: 'Pfizer Inc.', count: 2110 },
    { applicant: 'Janssen Pharmaceutica NV', count: 1964 },
    { applicant: 'Eli Lilly and Company', count: 1855 },
    { applicant: 'Genentech, Inc.', count: 1732 },
  ],
  patentCountByTargetAndApplicant: targets.flatMap((target, targetIndex) =>
    heatmapYears.map((year, yearIndex) => {
      const yearBoost = year >= 2021 && year <= 2024 ? 70 : year >= 2018 ? 34 : 8;
      const wave = Math.max(0, Math.round(Math.sin((targetIndex + yearIndex) / 3) * 22));
      const baseline = 8 + ((targetIndex * 7 + yearIndex * 11) % 26);
      return {
        target,
        year,
        count: baseline + wave + yearBoost + (targetBoosts[target] ?? 0),
      };
    }),
  ),
};
