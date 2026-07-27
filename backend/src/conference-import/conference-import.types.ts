export type ConferenceImportIssueDraft = {
  sourceFile: string;
  rowNumber: number | null;
  entityType: string;
  severity: 'WARNING' | 'ERROR';
  errorCode: string;
  message: string;
  sourceSnapshot?: Record<string, string | number | boolean | null>;
};

export type ConferenceExcelProfile =
  | 'LEGACY_EXPORT'
  | 'DETAIL'
  | 'POSTER'
  | 'DOCUMENT'
  | 'VIDEO';

export type ConferenceExcelInspection = {
  sourceFile: string;
  conferenceKey: string;
  profile: ConferenceExcelProfile;
  headers: string[];
  rowCount: number;
  skippedParticipationColumns: string[];
  issues: ConferenceImportIssueDraft[];
};

export type ConferenceExcelSource = {
  sourceFile: string;
  conferenceKey: string;
  profile: ConferenceExcelProfile;
};

export type ConferenceExcelRow = {
  rowNumber: number;
  values: Record<string, string>;
};
