import React from 'react';
import { Button } from 'antd';
import { X } from 'lucide-react';

/**
 * 트레이에 놓인 검색어 하나.
 *
 * 출처가 둘이다 — 검색으로 들어온 `evidence`(이 문서가 검색 결과에 뜬 근거)와 사용자가
 * toolbar에서 직접 쌓은 `user`. 출처는 생김새(칩 앞의 점)만 가르고, 할 수 있는 일은 같다:
 * 켜서 하이라이트에 넣거나, 지워서 트레이에서 내린다.
 */
export type PdfSearchTerm = {
  term: string;
  source: 'evidence' | 'user';
  /** 이 문서에서 몇 건인지. 아직 세는 중이면 undefined. */
  count?: number;
};

type Props = {
  terms: PdfSearchTerm[];
  /** 지금 PDF에 걸려 있는 검색어들(OR로 함께 걸린다). */
  activeTerms: readonly string[];
  /** 칩을 눌렀을 때. 꺼진 칩은 켜고, 켜진 칩은 끈다. */
  onToggle: (term: string) => void;
  /** 칩을 지울 때(트레이에서 내린다). 출처와 무관하게 지울 수 있다. */
  onRemove: (term: string) => void;
  /** PDF가 없으면 하이라이트할 곳이 없다. 칩을 켤 수 없게 둔다(지우기는 된다). */
  canHighlight: boolean;
};

/**
 * PDF 검색어 트레이.
 *
 * toolbar 바로 아래에 둔다 — 여기 칩이 곧 toolbar의 `3/12`와 ‹ › 가 가리키는 대상이라,
 * 떨어뜨려 놓으면 두 줄이 서로 무엇을 말하는지 알 수 없다.
 *
 * 칩은 **토글**이다. 켠 칩들은 하나의 OR 검색으로 함께 걸리고(pdf.js find controller가
 * 검색어 배열을 정식으로 받는다), toolbar의 `3/12`와 ‹ › 는 그 합쳐진 결과를 문서 순서대로
 * 훑는다. 그래서 "이 낱말 아니면 저 낱말"을 한 번에 볼 수 있다.
 *
 * 비활성 칩도 개수를 달고 있어 켜기 전에 이 문서에 몇 건인지 알 수 있다. 켠 칩이 둘 이상이면
 * 합계는 각 칩의 수를 더한 값보다 적을 수 있다 — 한 검색어가 다른 검색어를 품고 있으면
 * (`간행물에 게재된`과 `게재된`) 그 자리는 한 건으로 센다.
 */
const PdfSearchTermTray: React.FC<Props> = ({
  terms,
  activeTerms,
  onToggle,
  onRemove,
  canHighlight,
}) => {
  if (terms.length === 0) {
    // 자리는 남긴다. 문서를 옮길 때마다 줄이 생겼다 사라지면 아래 PDF가 위아래로 튄다.
    return (
      <div className="pm-doc-search-tray" aria-label="PDF 검색어">
        <span className="pm-doc-search-tray-label">검색어</span>
        <span className="pm-doc-search-tray-hint">
          없음
        </span>
      </div>
    );
  }

  return (
    <div className="pm-doc-search-tray" aria-label="PDF 검색어">
      <span className="pm-doc-search-tray-label">검색어</span>
      <span className="pm-doc-search-tray-terms">
        {terms.map(({ term, source, count }) => {
          const active = activeTerms.includes(term);
          /** 이 문서에 없는 검색어. 켜도 하이라이트될 곳이 없으니 흐리게 둔다. */
          const empty = count === 0;
          return (
            <span
              key={`${source}:${term}`}
              className={[
                'pm-doc-search-chip',
                active ? 'pm-doc-search-chip-active' : '',
                empty ? 'pm-doc-search-chip-empty' : '',
                source === 'evidence' ? 'pm-doc-search-chip-evidence' : '',
              ].filter(Boolean).join(' ')}
            >
              {/* 면(브랜드/카드)은 칩 껍데기가 그린다. 그래서 antd 버튼은 두 조각 모두
                  `text`로 둔다 — 여기서 primary/default를 쓰면 알약 안에 또 하나의 알약이
                  들어앉아 지우기 쪽과 어긋난다(CSS 주석 참고). */}
              <Button
                size="small"
                type="text"
                className="pm-doc-search-chip-button"
                aria-pressed={active}
                disabled={!canHighlight || empty}
                title={active ? '검색에서 빼기' : '검색에 넣기(OR)'}
                onClick={() => onToggle(term)}
              >
                {term}
                {count !== undefined && (
                  <span className="pm-doc-search-chip-count">{count}</span>
                )}
              </Button>
              {/**
                * 지우기는 근거 칩에도 붙는다.
                *
                * 근거 칩을 못 지우던 때는 검색어가 많은 결과에서 트레이가 남의 낱말로 가득 차
                * 정작 자기가 쌓은 칩을 찾기 어려웠다. 어느 문서가 왜 걸렸는지는 타임라인의
                * '일치' 배지가 계속 말해 주므로, 다 본 근거는 내릴 수 있어야 한다.
                */}
              <Button
                size="small"
                type="text"
                className="pm-doc-search-chip-remove"
                aria-label={`검색어 ${term} 지우기`}
                title="검색어 지우기"
                icon={<X size={11} />}
                onClick={() => onRemove(term)}
              />
            </span>
          );
        })}
      </span>
    </div>
  );
};

export default PdfSearchTermTray;
