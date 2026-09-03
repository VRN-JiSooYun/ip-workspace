/**
 * 국가코드(country.country)를 사람이 읽는 표기로 바꾸는 공통 규칙.
 *
 * DB에는 `KR`, `US`처럼 ISO 3166-1 alpha-2 코드가 들어가지만 EP(유럽특허청),
 * WO(PCT)처럼 국가가 아닌 특허 제도 코드도 섞여 있다. 그래서 ISO 변환만으로는
 * 부족하고, 아래 표에 제도 코드까지 함께 둔다.
 */

export type CountryLabel = {
  /** 대문자로 정규화한 원본 코드. */
  code: string;
  /** 좁은 칸에 쓰는 짧은 한국어 이름. 표를 모르면 코드를 그대로 돌려준다. */
  name: string;
  /** Tooltip 등 넓은 자리에 쓰는 정식 명칭. */
  fullName: string;
  /** 국기 이모지. 표에 없는 코드는 빈 문자열. */
  flag: string;
  /** 표에 있는 코드인지. false면 name === code다. */
  known: boolean;
};

type CountryEntry = {
  name: string;
  /** 짧은 이름과 다를 때만 채운다. */
  fullName?: string;
  /** 국가가 아니어서 코드에서 국기를 만들 수 없는 경우에만 채운다. */
  flag?: string;
};

/**
 * 표기 사전. 짧은 이름은 표의 국가 컬럼에 그대로 들어가므로 4자 이내로 둔다.
 */
const COUNTRY_TABLE: Record<string, CountryEntry> = {
  // 특허 제도 코드 (ISO 국가가 아니다)
  EP: { name: '유럽(EP)', fullName: '유럽특허청(EPO)', flag: '🇪🇺' },
  WO: { name: 'PCT', fullName: 'PCT 국제출원(WIPO)', flag: '🌐' },
  EA: { name: '유라시아', fullName: '유라시아특허청(EAPO)', flag: '🌐' },
  AP: { name: 'ARIPO', fullName: '아프리카지역공업소유권기구(ARIPO)', flag: '🌐' },
  OA: { name: 'OAPI', fullName: '아프리카지식재산기구(OAPI)', flag: '🌐' },
  GC: { name: 'GCC', fullName: '걸프협력회의 특허청(GCC)', flag: '🌐' },

  // 아시아
  KR: { name: '한국', fullName: '대한민국' },
  JP: { name: '일본' },
  CN: { name: '중국' },
  TW: { name: '대만' },
  HK: { name: '홍콩' },
  SG: { name: '싱가포르' },
  IN: { name: '인도' },
  ID: { name: '인도네시아' },
  MY: { name: '말레이시아' },
  TH: { name: '태국' },
  VN: { name: '베트남' },
  PH: { name: '필리핀' },
  IL: { name: '이스라엘' },
  SA: { name: '사우디', fullName: '사우디아라비아' },
  AE: { name: 'UAE', fullName: '아랍에미리트' },
  TR: { name: '튀르키예' },
  KP: { name: '북한', fullName: '조선민주주의인민공화국' },

  // 아메리카
  US: { name: '미국' },
  CA: { name: '캐나다' },
  MX: { name: '멕시코' },
  BR: { name: '브라질' },
  AR: { name: '아르헨티나' },
  CL: { name: '칠레' },
  CO: { name: '콜롬비아' },
  PE: { name: '페루' },

  // 유럽
  GB: { name: '영국' },
  DE: { name: '독일' },
  FR: { name: '프랑스' },
  IT: { name: '이탈리아' },
  ES: { name: '스페인' },
  NL: { name: '네덜란드' },
  BE: { name: '벨기에' },
  CH: { name: '스위스' },
  AT: { name: '오스트리아' },
  SE: { name: '스웨덴' },
  NO: { name: '노르웨이' },
  DK: { name: '덴마크' },
  FI: { name: '핀란드' },
  IE: { name: '아일랜드' },
  PL: { name: '폴란드' },
  CZ: { name: '체코' },
  SK: { name: '슬로바키아' },
  HU: { name: '헝가리' },
  PT: { name: '포르투갈' },
  GR: { name: '그리스' },
  RO: { name: '루마니아' },
  BG: { name: '불가리아' },
  UA: { name: '우크라이나' },
  RU: { name: '러시아' },
  RS: { name: '세르비아' },
  HR: { name: '크로아티아' },
  SI: { name: '슬로베니아' },
  LT: { name: '리투아니아' },
  LV: { name: '라트비아' },
  EE: { name: '에스토니아' },
  LU: { name: '룩셈부르크' },
  IS: { name: '아이슬란드' },

  // 오세아니아·아프리카
  AU: { name: '호주' },
  NZ: { name: '뉴질랜드' },
  ZA: { name: '남아공', fullName: '남아프리카공화국' },
  EG: { name: '이집트' },
  MA: { name: '모로코' },
  NG: { name: '나이지리아' },
  KE: { name: '케냐' },
};

const REGIONAL_INDICATOR_BASE = 0x1f1e6; // 🇦
const LATIN_A = 'A'.charCodeAt(0);

/** ISO alpha-2 코드를 regional indicator 두 글자(=국기 이모지)로 바꾼다. */
const toFlagEmoji = (code: string): string => String.fromCodePoint(
  ...[...code].map((letter) => REGIONAL_INDICATOR_BASE + (letter.charCodeAt(0) - LATIN_A)),
);

const normalizeCode = (value: string | null | undefined): string => (value ?? '')
  .trim()
  .toUpperCase();

const UNKNOWN: CountryLabel = { code: '', name: '-', fullName: '-', flag: '', known: false };

/**
 * 국가코드 하나를 표기 정보로 바꾼다. 사전에 없으면 코드를 그대로 이름으로 쓴다.
 * 모르는 코드가 화면에서 사라지면 데이터 오류를 못 보게 되므로 감추지 않는다.
 */
export const getCountryLabel = (value: string | null | undefined): CountryLabel => {
  const code = normalizeCode(value);
  if (!code) return UNKNOWN;

  const entry = COUNTRY_TABLE[code];
  if (!entry) {
    return { code, name: code, fullName: code, flag: '', known: false };
  }

  return {
    code,
    name: entry.name,
    fullName: entry.fullName ?? entry.name,
    flag: entry.flag ?? (/^[A-Z]{2}$/.test(code) ? toFlagEmoji(code) : ''),
    known: true,
  };
};

/** Select처럼 문자열 label만 받는 자리에 쓰는 한 줄 표기. 검색어로 코드·한글 모두 걸린다. */
export const formatCountryOptionLabel = (value: string | null | undefined): string => {
  const { code, name, flag, known } = getCountryLabel(value);
  if (!code) return '-';
  if (!known) return code;
  return `${flag ? `${flag} ` : ''}${code} · ${name}`;
};

let flagEmojiSupport: boolean | null = null;

/**
 * 국기 이모지를 실제로 그릴 수 있는 환경인지 한 번만 재본다.
 *
 * Windows Chrome은 regional indicator 글리프를 합치지 않고 `US`처럼 알파벳 두 자로
 * 그린다. 그대로 두면 코드가 중복 노출되므로, 이 경우 국기를 빼고 코드 배지만 쓴다.
 * 판정은 "국기 한 개의 폭이 regional indicator 한 글자와 비슷한가"로 한다.
 */
export const supportsFlagEmoji = (): boolean => {
  if (flagEmojiSupport !== null) return flagEmojiSupport;
  if (typeof document === 'undefined') return false;

  try {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) {
      flagEmojiSupport = false;
      return flagEmojiSupport;
    }
    context.font = '32px sans-serif';
    const single = context.measureText('\u{1F1FA}').width; // 🇺 한 글자
    const pair = context.measureText('\u{1F1FA}\u{1F1F8}').width; // 🇺🇸
    flagEmojiSupport = pair > 0 && pair < single * 1.5;
  } catch {
    flagEmojiSupport = false;
  }

  return flagEmojiSupport;
};
