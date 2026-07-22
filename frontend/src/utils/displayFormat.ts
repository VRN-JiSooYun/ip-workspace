export const formatNumberWithComma = (value: unknown, options: { fractionDigits?: number } = {}) => {
  if (value === null || value === undefined || value === '') return '-';

  const numericValue = typeof value === 'number'
    ? value
    : Number(String(value).replace(/,/g, ''));

  if (!Number.isFinite(numericValue)) return String(value);

  const formattedValue = typeof options.fractionDigits === 'number'
    ? numericValue.toFixed(options.fractionDigits)
    : String(numericValue);
  const [integerPart, fractionPart] = formattedValue.split('.');
  const formattedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return fractionPart === undefined
    ? formattedIntegerPart
    : `${formattedIntegerPart}.${fractionPart}`;
};

export const formatDisplayDate = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';

  const text = String(value).trim();
  if (!text || text === '-') return '-';

  const normalizeDateTime = (
    _: string,
    year: string,
    month: string,
    day: string,
    hour: string,
    minute: string,
  ) => `${year.length === 2 ? `20${year}` : year}.${month}.${day} ${hour}:${minute}`;

  return text
    .replace(/\b(\d{4})[-/.](\d{2})[-/.](\d{2})\.?[T\s]+(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?(?!\d)/g, normalizeDateTime)
    .replace(/\b(\d{2})[-/.](\d{2})[-/.](\d{2})\.?[T\s]+(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?(?!\d)/g, normalizeDateTime)
    .replace(/\b(\d{4})[-/.](\d{2})[-/.](\d{2})\.?(?!\d)/g, '$1.$2.$3')
    .replace(/\b(\d{2})[-/.](\d{2})[-/.](\d{2})\.?(?!\d)/g, '20$1.$2.$3');
};
