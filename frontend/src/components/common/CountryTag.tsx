import React from 'react';
import { Tooltip } from 'antd';
import 'flag-icons/css/flag-icons.min.css';
import {
  countryOptionSearchText,
  formatCountryOptionLabel,
  getCountryLabel,
} from '../../utils/countryLabel';
import './CountryTag.css';

/**
 * 지구본 이모지(U+1F310).
 *
 * 국기 이모지와 달리 이건 regional indicator 합자가 아니라 글리프 하나라, Windows를
 * 포함해 어느 OS에서나 그려진다 — 국기를 SVG로 바꾼 이유가 여기에는 해당하지 않는다.
 */
const GLOBE = '\u{1F310}';

type CountryFlagProps = {
  /** country.country 원문 코드(KR, US, EP …). */
  code: string | null | undefined;
};

/**
 * 코드 앞에 붙는 표식. 세 갈래다.
 *
 *   1. 국가      → flag-icons의 SVG 국기 (`fi fi-kr`)
 *   2. 제도 코드 → 지구본 아이콘. WO(PCT)·EA·OAPI처럼 한 나라를 가리키지 않는 코드라
 *                  국기를 붙일 수 없다. 아무것도 안 그리면 국기를 못 불러온 것처럼 보인다
 *   3. 모르는 코드 → 코드 배지. 사전에 없는 값이라는 사실이 화면에 남아야 한다
 */
export const CountryFlag: React.FC<CountryFlagProps> = ({ code }) => {
  const { flagClass, known, code: normalized } = getCountryLabel(code);
  if (!normalized) return null;

  if (flagClass) return <span className={`fi ${flagClass} country-tag-flag`} aria-hidden />;
  if (known) return <span className="country-tag-globe" aria-hidden>{GLOBE}</span>;
  return <span className="country-tag-code" aria-hidden>{normalized}</span>;
};

type CountryTagProps = CountryFlagProps & {
  /** 국기를 빼고 이름만 쓰는 좁은 자리를 위한 옵션. */
  showFlag?: boolean;
};

/** 국가 컬럼 공통 표기. 국기 + 한국어 이름을 보이고 원본 코드는 Tooltip으로 남긴다. */
export const CountryTag: React.FC<CountryTagProps> = ({ code, showFlag = true }) => {
  const country = getCountryLabel(code);

  if (!country.code) return <>-</>;
  if (!country.known) {
    // 사전에 없는 코드는 번역하지 않고 원문 그대로 둔다(데이터 확인용).
    return <span className="country-tag">{country.code}</span>;
  }

  return (
    <Tooltip title={`${country.fullName} (${country.code})`}>
      <span className="country-tag">
        {showFlag && <CountryFlag code={country.code} />}
        <span className="country-tag-name">{country.name}</span>
      </span>
    </Tooltip>
  );
};

export default CountryTag;

/** Select 옵션 하나. label이 ReactNode라 검색은 `search`가 대신한다. */
export type CountrySelectOption<V> = {
  value: V;
  label: React.ReactNode;
  search: string;
};

/**
 * 국가 Select의 옵션. 국기는 글자가 아니라 SVG라 label이 ReactNode가 되고, 그래서
 * antd의 `optionFilterProp="label"` 대신 아래 `filterCountryOption`을 함께 쓴다.
 */
export const buildCountryOption = <V,>(
  value: V,
  code: string,
): CountrySelectOption<V> => ({
  value,
  label: (
    <span className="country-tag">
      <CountryFlag code={code} />
      <span>{formatCountryOptionLabel(code)}</span>
    </span>
  ),
  search: countryOptionSearchText(code),
});

/** 코드(`KR`)로도 한글 이름(`한국`)으로도 걸린다. */
export const filterCountryOption = (
  input: string,
  option?: { search?: string },
): boolean => (option?.search ?? '').includes(input.trim().toLowerCase());
