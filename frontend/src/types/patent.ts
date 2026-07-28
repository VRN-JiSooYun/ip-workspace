export interface Patent {
  id: string;
  patentNumber: string;
  title: string;
  applicant: string;
  publicationDate: string;
  target: string;
  status: string;
  isFavorite: boolean;
  embodimentCount?: number | null;
  keyScaffoldSvg?: string;
  aiKeyCompoundSvg?: string;
  analysisDate?: string;
  keyCompoundSmiles: string;
  abstract: string;
}
