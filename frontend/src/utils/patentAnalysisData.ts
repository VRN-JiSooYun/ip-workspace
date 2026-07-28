export const mergeEmbodimentPayload = (
  patentPayload: Record<string, any>,
  embodimentPayload: Record<string, any> | null,
): Record<string, any> => ({
  ...patentPayload,
  modified_partial_rows: embodimentPayload?.modified_partial_rows ?? patentPayload.modified_partial_rows ?? [],
  modified_total_rows: embodimentPayload?.modified_total_rows ?? patentPayload.modified_total_rows ?? [],
  partial_rows: embodimentPayload?.partial_rows ?? patentPayload.partial_rows ?? [],
  total_rows: embodimentPayload?.total_rows ?? patentPayload.total_rows ?? [],
});
