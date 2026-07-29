export const normalizeMolBlockForClipboard = (
  value?: string | null,
): string => {
  if (typeof value !== 'string') return '';

  const normalizedLineEndings = value.replace(/\r\n?/g, '\n').trimEnd();
  if (!normalizedLineEndings.trim()) return '';

  const withoutLeadingBlankLines = normalizedLineEndings.replace(
    /^(?:[ \t]*\n)+/,
    '',
  );

  if (/^[ \t]*RDKit\b/i.test(withoutLeadingBlankLines)) {
    return `\n${withoutLeadingBlankLines}`;
  }

  return normalizedLineEndings.trim();
};
