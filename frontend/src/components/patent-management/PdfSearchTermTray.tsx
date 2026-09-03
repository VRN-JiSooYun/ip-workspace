import React from 'react';
import { Button } from 'antd';
import { X } from 'lucide-react';

/**
 * 트레이에 놓인 검색어 하나.
 *
 * 출처가 둘이다 — 검색으로 들어온 `evidence`(이 문서가 검색 결과에 뜬 근거)와 사용자가
 * toolbar에서 직접 쌓은 `user`. 출처는 생김새와 지울 수 있는지만 가르고, 누를 때 하는 일은
 * 같다: 그 검색어를 PDF에 하이라이트한다.
 */
export type PdfSearchTerm = {
  term: string;
  source: 'evidence' | 'user';
  /** 이 문서에서 몇 건인지. 아직 세는 중이면 undefined. */
  count?: number;
};

type Props = {
  terms: PdfSearchTerm[];
  /** 지금 PDF에 걸려 있는 검색어. */
  activeTerm: string | null;
  /**
   * 칩을 눌렀을 때. 활성 칩을 다시 누르는 경우도 여기로 온다 —
   * 그때 다음 매칭으로 넘기는 것은 부르는 쪽(PDF를 들고 있는 쪽)이 정한다.
   */
  onSelect: (term: string) => void;
  /** 사용자가 쌓은 칩을 지울 때. */
  onRemove: (term: string) => void;
  /** PDF가 없으면 하이라이트할 곳이 없다. 칩을 누를 수 없게 둔다. */
  canHighlight: boolean;
};

/**
 * PDF 검색어 트레이.
 *
 * toolbar 바로 아래에 둔다 — 여기 칩이 곧 toolbar의 `3/12`와 ‹ › 가 가리키는 대상이라,
 * 떨어뜨려 놓으면 두 줄이 서로 무엇을 말하는지 알 수 없다.
 *
 * 활성 검색어는 언제나 하나다. pdf.js find controller가 쿼리 하나만 들고 있어서이기도 하고,
 * 여러 검색어를 동시에 칠하면 "지금 어디를 보고 있는지"가 흐려지기도 한다. 대신 비활성 칩도
 * 개수를 달고 있어 누르기 전에 이 문서에 몇 건인지 알 수 있다.
 */
const PdfSearchTermTray: React.FC<Props> = ({
  terms,
  activeTerm,
  onSelect,
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
          const active = activeTerm === term;
          /** 이 문서에 없는 검색어. 눌러도 하이라이트될 곳이 없으니 흐리게 둔다. */
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
              <Button
                size="small"
                type={active ? 'primary' : 'default'}
                className="pm-doc-search-chip-button"
                aria-pressed={active}
                disabled={!canHighlight || empty}
                onClick={() => onSelect(term)}
              >
                {term}
                {count !== undefined && (
                  <span className="pm-doc-search-chip-count">{count}</span>
                )}
              </Button>
              {source === 'user' && (
                <Button
                  size="small"
                  type="text"
                  className="pm-doc-search-chip-remove"
                  aria-label={`검색어 ${term} 지우기`}
                  title="검색어 지우기"
                  icon={<X size={11} />}
                  onClick={() => onRemove(term)}
                />
              )}
            </span>
          );
        })}
      </span>
    </div>
  );
};

export default PdfSearchTermTray;
