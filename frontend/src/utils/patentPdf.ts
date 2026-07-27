import { patentAnalysisApi } from '../services/patentAnalysisApi';

const PDF_METADATA_KEYS = ['ocr_pdf_path', 'pdf_path', 'pdf_url'] as const;

export const normalizePatentPublicationNumber = (value: string) => (
  value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
);

const getBrowserPdfUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/raid/')) return null;
  if (trimmed.startsWith('/')) return trimmed;
  return null;
};

export const hasPatentPdfSource = (metadata: Record<string, any> | null | undefined): boolean => (
  Boolean(metadata && PDF_METADATA_KEYS.some((key) => {
    const value = metadata[key];
    return typeof value === 'string' && Boolean(value.trim());
  }))
);

export const resolvePatentPdfDocument = (
  metadata: Record<string, any> | null | undefined,
  publicationNumber: string | null | undefined,
  params?: { ownerId?: string },
): string | null => {
  if (!metadata || !publicationNumber || !hasPatentPdfSource(metadata)) return null;

  for (const key of PDF_METADATA_KEYS) {
    const directUrl = getBrowserPdfUrl(metadata[key]);
    if (directUrl) return directUrl;
  }

  return patentAnalysisApi.getPatentPdfUrl(
    normalizePatentPublicationNumber(publicationNumber),
    params,
  );
};

export const getPatentPdfFilename = (publicationNumber?: string | null): string => {
  const filenameBase = publicationNumber || 'patent-document';
  return `${filenameBase.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
};

const saveBlob = (blob: Blob, filename: string) => {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename.replace(/[\\/]/g, '_');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
};

export const downloadPatentPdfFile = async (
  publicationNumber: string,
  params?: { ownerId?: string },
): Promise<void> => {
  const normalizedPublicationNumber = normalizePatentPublicationNumber(publicationNumber);
  const result = await patentAnalysisApi.downloadPatentPdf(normalizedPublicationNumber, params);
  saveBlob(result.blob, result.filename || getPatentPdfFilename(publicationNumber));
};
