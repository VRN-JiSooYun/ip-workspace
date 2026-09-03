import React from 'react';
import { Tooltip } from 'antd';
import { getCountryLabel, supportsFlagEmoji } from '../../utils/countryLabel';
import './CountryTag.css';

type CountryTagProps = {
  /** country.country 원문 코드(KR, US, EP …). */
  code: string | null | undefined;
  /** 국기를 빼고 이름만 쓰는 좁은 자리를 위한 옵션. */
  showFlag?: boolean;
};

/**
 * 국가 컬럼 공통 표기. 국기 + 한국어 이름을 보이고 원본 코드는 Tooltip으로 남긴다.
 *
 * 국기 이모지를 합성하지 못하는 환경(Windows Chrome 등)에서는 알파벳 두 자가
 * 그대로 그려져 코드가 두 번 보이므로, 그때는 코드 배지로 대체한다.
 */
export const CountryTag: React.FC<CountryTagProps> = ({ code, showFlag = true }) => {
  const country = getCountryLabel(code);

  if (!country.code) return <>-</>;
  if (!country.known) {
    // 사전에 없는 코드는 번역하지 않고 원문 그대로 둔다(데이터 확인용).
    return <span className="country-tag">{country.code}</span>;
  }

  const useEmoji = showFlag && Boolean(country.flag) && supportsFlagEmoji();

  return (
    <Tooltip title={`${country.fullName} (${country.code})`}>
      <span className="country-tag">
        {useEmoji
          ? <span className="country-tag-flag" aria-hidden>{country.flag}</span>
          : showFlag && <span className="country-tag-code" aria-hidden>{country.code}</span>}
        <span className="country-tag-name">{country.name}</span>
      </span>
    </Tooltip>
  );
};

export default CountryTag;
