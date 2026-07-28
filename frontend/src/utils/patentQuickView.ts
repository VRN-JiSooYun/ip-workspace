import type { Patent } from '../types/patent';
import {
  mapPatentListItem,
  type PatentDetailResponse,
} from '../services/patentAnalysisApi';

export type PatentQuickViewData = {
  publicationNumber: string;
  publicationDate: string;
  title: string;
  filingDate: string;
  targets: string;
  applicants: string;
  abstract: string;
  scaffoldSvg: string;
  genusMarkushSvg: string;
};

const getDisplayText = (
  source: Record<string, any> | null | undefined,
  keys: string[],
  fallback = '',
): string => {
  if (!source) return fallback;

  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      const items = value
        .map((item) => String(item ?? '').trim())
        .filter(Boolean);
      if (items.length > 0) return items.join(', ');
      continue;
    }
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return fallback;
};

const decodeSvgEntities = (value: string): string => (
  value
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
);

const normalizeStructureSvg = (value: unknown): string => {
  const candidate = Array.isArray(value)
    ? value.find((item) => typeof item === 'string' && Boolean(item.trim()))
    : value;
  if (typeof candidate !== 'string' || !candidate.trim()) return '';

  let text = candidate.trim();
  const dataUrlMatch = text.match(/^data:image\/svg\+xml(?:;charset=[^;,]+)?(;base64)?,(.*)$/i);
  if (dataUrlMatch) {
    try {
      text = dataUrlMatch[1]
        ? window.atob(dataUrlMatch[2])
        : decodeURIComponent(dataUrlMatch[2]);
    } catch {
      return '';
    }
  } else if (/%3C(?:svg|%3Fxml)/i.test(text)) {
    try {
      text = decodeURIComponent(text);
    } catch {
      // Continue with the original value.
    }
  }

  text = decodeSvgEntities(text);
  const svgStartIndex = text.search(/<svg[\s>]/i);
  if (svgStartIndex < 0) return '';
  const svgEndIndex = text.toLowerCase().indexOf('</svg>', svgStartIndex);
  return svgEndIndex >= 0
    ? text.slice(svgStartIndex, svgEndIndex + '</svg>'.length)
    : '';
};

const getStructureSvg = (
  source: Record<string, any> | null | undefined,
  keys: string[],
): string => {
  if (!source) return '';
  for (const key of keys) {
    const svg = normalizeStructureSvg(source[key]);
    if (svg) return svg;
  }
  return '';
};

export const mapPatentQuickViewData = (
  patent: Patent,
  detail: PatentDetailResponse | null,
): PatentQuickViewData => {
  const metadata = detail?.metadata;
  const mappedMetadata = metadata ? mapPatentListItem(metadata, 0) : null;

  return {
    publicationNumber: getDisplayText(
      metadata,
      ['publication_number', 'publicationNumber', 'patent_number'],
      detail?.publicationNumber || patent.patentNumber,
    ),
    publicationDate: getDisplayText(
      metadata,
      ['publication_date', 'publicationDate', 'pub_date'],
      patent.publicationDate,
    ),
    title: getDisplayText(
      metadata,
      ['title', 'patent_title', 'invention_title', 'name'],
      patent.title,
    ),
    filingDate: getDisplayText(
      metadata,
      ['filling_date', 'filing_date', 'application_date', 'applicationDate'],
      '-',
    ),
    targets: getDisplayText(
      metadata,
      ['target', 'protein_target', 'target_name'],
      patent.target,
    ),
    applicants: getDisplayText(
      metadata,
      ['applicant', 'assignee', 'applicants'],
      patent.applicant,
    ),
    abstract: getDisplayText(metadata, ['abstract'], patent.abstract),
    scaffoldSvg: getStructureSvg(metadata, [
      'key_scaffold_img',
      'key_scaffold_svg',
      'key_scaffold',
      'scaffold_svg',
      'scaffold_img',
      'parent_scaffold_svg',
    ]) || mappedMetadata?.keyScaffoldSvg || patent.keyScaffoldSvg || '',
    genusMarkushSvg: getStructureSvg(metadata, [
      'genus_markush_img',
      'genus_markush_svg',
      'genus_markush',
      'genus_markush_structure',
      'markush_svg',
    ]),
  };
};
