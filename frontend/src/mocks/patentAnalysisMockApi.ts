import patentData608ApiRaw from './WO2026087635A1_PATENT_DATA_API.json';
import embodimentList608ApiRaw from './WO2026087635A1_EMBODIMENT_LIST_API.json';
import patentData609Raw from './WO2026090333A1_PATENT_DATA.json';
import embodimentList609ApiRaw from './WO2026090333A1_EMBODIMENT_LIST_API.json';

export type MockApiTuple<T> = [boolean, boolean, T];

export const mockPatentData608Api = patentData608ApiRaw as MockApiTuple<Record<string, any>>;
export const mockEmbodimentList608Api = embodimentList608ApiRaw as MockApiTuple<Record<string, any>>;
export const mockPatentData609 = patentData609Raw as Record<string, any>;
export const mockEmbodimentList609Api = embodimentList609ApiRaw as MockApiTuple<Record<string, any>>;

export const getMockApiPayload = <T>(response: unknown): T | null => {
  if (Array.isArray(response) && response.length > 2) {
    return (response[2] ?? null) as T | null;
  }
  if (response && typeof response === 'object' && 'result' in (response as Record<string, unknown>)) {
    return ((response as Record<string, any>).result ?? null) as T | null;
  }
  return null;
};

export const mergeEmbodimentPayload = (
  patentPayload: Record<string, any>,
  embodimentPayload: Record<string, any> | null
) => ({
  ...patentPayload,
  modified_partial_rows: embodimentPayload?.modified_partial_rows ?? patentPayload.modified_partial_rows ?? [],
  modified_total_rows: embodimentPayload?.modified_total_rows ?? patentPayload.modified_total_rows ?? [],
  partial_rows: embodimentPayload?.partial_rows ?? patentPayload.partial_rows ?? [],
  total_rows: embodimentPayload?.total_rows ?? patentPayload.total_rows ?? [],
});

export const getPatentData608Payload = () => getMockApiPayload<Record<string, any>>(mockPatentData608Api) ?? {};
export const getEmbodimentList608Payload = () => getMockApiPayload<Record<string, any>>(mockEmbodimentList608Api) ?? {};
export const getPatentData609Payload = () => getMockApiPayload<Record<string, any>>(mockPatentData609) ?? {};
export const getEmbodimentList609Payload = () => getMockApiPayload<Record<string, any>>(mockEmbodimentList609Api) ?? {};

export const getPrototypeMockDataset = (params?: { patentId?: string; patentNumber?: string }) => {
  const scenarios = [
    {
      publicationNumber: 'WO2026090333A1',
      patent: getPatentData609Payload(),
      embodiment: getEmbodimentList609Payload(),
      pdfDocument: '/WO2026090333A1.pdf',
    },
    {
      publicationNumber: 'WO2026087635A1',
      patent: getPatentData608Payload(),
      embodiment: getEmbodimentList608Payload(),
      pdfDocument: '/WO2026087635A1.pdf',
    },
  ];

  const normalizedPatentNumber = (params?.patentNumber ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const matchedByNumber = scenarios.find((scenario) => scenario.publicationNumber === normalizedPatentNumber);
  if (matchedByNumber) {
    return {
      ...matchedByNumber,
      patentResult: mergeEmbodimentPayload(matchedByNumber.patent, matchedByNumber.embodiment),
    };
  }

  const numericId = Number(params?.patentId);
  const scenarioIndex = Number.isFinite(numericId) && numericId > 0
    ? (numericId - 1) % scenarios.length
    : 0;
  const selectedScenario = scenarios[scenarioIndex];

  return {
    ...selectedScenario,
    patentResult: mergeEmbodimentPayload(selectedScenario.patent, selectedScenario.embodiment),
  };
};
