/**
 * 국가코드(country.country)를 사람이 읽는 표기로 바꾸는 공통 규칙.
 *
 * DB에는 `KR`, `US`처럼 ISO 3166-1 alpha-2 코드가 들어가지만 EP(유럽특허청),
 * WO(PCT)처럼 국가가 아닌 특허 제도 코드도 섞여 있다. 그래서 ISO 변환만으로는
 * 부족하고, 아래 표에 제도 코드까지 함께 둔다.
 *
 * 국기는 유니코드 이모지가 아니라 `flag-icons` 패키지의 SVG를 쓴다. Windows의
 * Chrome·Edge는 regional indicator 두 글자를 합자로 그리지 않아 `🇰🇷`가 `KR` 글자로
 * 보인다 — 사내 PC 상당수가 그 조합이라 이모지로는 아무도 국기를 못 본다. SVG는 번들에
 * 들어가므로 인트라넷·오프라인에서도 CDN이 필요 없다.
 */

export type CountryLabel = {
  /** 대문자로 정규화한 원본 코드. */
  code: string;
  /** 좁은 칸에 쓰는 짧은 한국어 이름. 표를 모르면 코드를 그대로 돌려준다. */
  name: string;
  /** Tooltip 등 넓은 자리에 쓰는 정식 명칭. */
  fullName: string;
  /**
   * flag-icons의 국기 클래스(`fi-kr`). 국기가 없는 제도 코드(WO·EA…)와 사전에 없는
   * 코드는 null이며, 그리는 쪽이 코드 배지로 대신한다.
   */
  flagClass: string | null;
  /** 표에 있는 코드인지. false면 name === code다. */
  known: boolean;
};

type CountryEntry = {
  name: string;
  /** 짧은 이름과 다를 때만 채운다. */
  fullName?: string;
  /**
   * ISO 코드와 flag-icons의 파일명이 다를 때만 채운다. 국기가 아예 없는 제도 코드는
   * `null`로 둔다 — 필드를 비우면 코드로 유추해 없는 파일을 가리키게 된다.
   */
  flagCode?: string | null;
};

/**
 * 표기 사전. 짧은 이름은 표의 국가 컬럼에 그대로 들어가므로 4자 이내로 둔다.
 */
const COUNTRY_TABLE: Record<string, CountryEntry> = {
  // 특허 제도 코드 (ISO 국가가 아니다)
  // 표의 국가 칸이 좁아 이름은 '유럽'까지만 둔다. 정식 명칭과 코드는 Tooltip이 보여 준다.
  EP: { name: '유럽', fullName: '유럽특허청(EPO)', flagCode: 'eu' },
  WO: { name: 'PCT', fullName: 'PCT 국제출원(WIPO)', flagCode: null },
  EA: { name: '유라시아', fullName: '유라시아특허청(EAPO)', flagCode: null },
  AP: { name: 'ARIPO', fullName: '아프리카지역공업소유권기구(ARIPO)', flagCode: null },
  OA: { name: 'OAPI', fullName: '아프리카지식재산기구(OAPI)', flagCode: null },
  GC: { name: 'GCC', fullName: '걸프협력회의 특허청(GCC)', flagCode: null },

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

const normalizeCode = (value: string | null | undefined): string => (value ?? '')
  .trim()
  .toUpperCase();

const UNKNOWN: CountryLabel = {
  code: '', name: '-', fullName: '-', flagClass: null, known: false,
};

/**
 * 국가코드 하나를 표기 정보로 바꾼다. 사전에 없으면 코드를 그대로 이름으로 쓴다.
 * 모르는 코드가 화면에서 사라지면 데이터 오류를 못 보게 되므로 감추지 않는다.
 */
export const getCountryLabel = (value: string | null | undefined): CountryLabel => {
  const code = normalizeCode(value);
  if (!code) return UNKNOWN;

  const entry = COUNTRY_TABLE[code];
  if (!entry) {
    return { code, name: code, fullName: code, flagClass: null, known: false };
  }

  // flagCode를 적지 않은 국가는 ISO 코드 소문자가 그대로 파일명이다(kr → fi-kr).
  const flagCode = entry.flagCode === undefined
    ? (/^[A-Z]{2}$/.test(code) ? code.toLowerCase() : null)
    : entry.flagCode;

  return {
    code,
    name: entry.name,
    fullName: entry.fullName ?? entry.name,
    flagClass: flagCode ? `fi-${flagCode}` : null,
    known: true,
  };
};

/** Select 옵션의 글자 부분. 국기는 그리는 쪽이 SVG로 따로 붙인다. */
export const formatCountryOptionLabel = (value: string | null | undefined): string => {
  const { code, name, known } = getCountryLabel(value);
  if (!code) return '-';
  if (!known) return code;
  return `${code} · ${name}`;
};

/**
 * Select 검색에 쓰는 문자열. label이 ReactNode가 되면 antd의 optionFilterProp을 쓸 수
 * 없으므로, 코드·한글 이름을 함께 담은 이 값을 filterOption이 본다.
 */
export const countryOptionSearchText = (value: string | null | undefined): string => {
  const { code, name, fullName } = getCountryLabel(value);
  return `${code} ${name} ${fullName}`.toLowerCase();
};
