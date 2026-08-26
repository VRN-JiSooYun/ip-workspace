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

export type DisplayDateTimeFormat = string;

/**
 * 날짜와 시간을 지정한 format에 맞춰 표시한다.
 * 지원 토큰: YYYY, YY, MM, M, DD, D, HH, H, mm, m, ss, s.
 * format을 생략하면 기존 날짜 표시 규칙인 YYYY.MM.DD를 쓴다.
 */
export const formatDisplayDateTime = (
  value: unknown,
  format: DisplayDateTimeFormat = 'YYYY.MM.DD',
) => {
  if (value === null || value === undefined || value === '') return '-';

  const text = String(value).trim();
  if (!text || text === '-') return '-';

  const dateTimePart = text.match(
    /^(\d{4}|\d{2})[-/.](\d{2})[-/.](\d{2})(?:\.?[T\s]+(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?/,
  );
  if (!dateTimePart) return formatDisplayDate(value);

  const [, rawYear, month, day, rawHour, rawMinute, rawSecond] = dateTimePart;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  const hour = rawHour ?? '00';
  const minute = rawMinute ?? '00';
  const second = rawSecond ?? '00';
  const tokenValues: Record<string, string> = {
    YYYY: year,
    YY: year.slice(-2),
    MM: month,
    M: String(Number(month)),
    DD: day,
    D: String(Number(day)),
    HH: hour,
    H: String(Number(hour)),
    mm: minute,
    m: String(Number(minute)),
    ss: second,
    s: String(Number(second)),
  };

  return format.replace(
    /YYYY|YY|MM|DD|HH|mm|ss|M|D|H|m|s/g,
    (token) => tokenValues[token],
  );
};
