# 문서 타임라인 — 탭 스타일에서 칩 스타일로 원상복구

## 요구
`pm-timeline`의 문서 선택 UI를 카드형 **탭**에서 다시 **칩**으로 되돌린다.

## 되돌린 대상

2ac2058("타임라인 탭")에서 한 세 가지를 함께 되돌렸다 — 셋이 한 덩어리라 하나만 되돌리면
연결선과 점의 기준이 어긋난다.

| 항목 | 탭 (되돌리기 전) | 칩 (되돌린 뒤) |
| --- | --- | --- |
| 윗줄 | 날짜 **칩**(pill 24px, 테두리·배경) | 날짜 **글자**(11px, 같은 날짜는 첫 문서에만) |
| 아랫줄 | 문서 **탭**(카드형, 위 모서리만 8px, 아래 테두리 없음, 서로 붙임) | 문서 **칩**(pill 26px, 트랙 gap 16px로 떨어짐) |
| 시간축의 점 | 날짜 칩 안 (날짜당 하나) | 문서 칩 안 (문서당 하나) |
| 연결선 `::after` | `top: 12px` (날짜 칩 중앙) | `top: 33px` (16 + 4 + 26/2 = 문서 칩 중앙) |
| 날짜↔문서 세로선 `::before` | 있음 | 없음(탭 묶음이 없어져 매달 것이 없다) |
| 의미 | `tablist`/`tab` + 좌우 화살표 이동 | 버튼 + `aria-current` (각 칩이 Tab으로 닿는다) |

## 되돌리면서 **살린** 결정

이전 지시로 없앤 것을 되살리지 않았다. 되돌리기가 "그 커밋 이전으로"가 아니라
"칩 모양으로"이기 때문이다.

- **종류 꼬리표(`pm-timeline-chip-kind`, 통지/대응/기타)** — 사용자가 일부러 지운 것이라
  복원하지 않았다. 죽은 코드였던 `DOT_CLASS`/`KIND_LABEL` map도 함께 두지 않았다.
- **점 모양** — 고르지 않은 문서는 모두 비운 점(`--text-secondary` 테두리), 고른 문서만
  브랜드 색으로 채운다. 옛 코드는 고르지 않은 점에도 브랜드 테두리(`-dot-response`)를 써
  고르지 않은 항목이 강조돼 보였다.
- **검색어 일치 표시** — 칩 자체를 꾸미지 않는다. 옛
  `.pm-timeline-chip-matched:not(.pm-timeline-chip-active)`(브랜드 테두리)는 복원하지 않고
  안쪽 '일치' 배지 하나로만 알린다.
- **활성 칩 굵기** — `font-weight: 700` → `600`. 700은 과하다는 지시가 있었다.

## 탭을 되돌리는 것이 맞는 이유

탭 모양은 "아래가 이 탭의 내용"일 때만 뜻이 생긴다. 그런데 그 뒤 타임라인 아래에 검색어
트레이(`pm-doc-search-tray`)가 들어와 탭과 내용 사이가 끊겼다. 붙지 않는 탭은 그냥
아래 테두리가 빠진 칩이라, 칩으로 되돌리는 편이 읽기 쉽다. 이 사정을
`PatentDocumentTimeline.tsx` 주석에 남겨 다음에 같은 시도를 반복하지 않게 했다.

## 검증

`office-action-harness.html`에서 확인했다. 이 harness의 mock은 통지서 한 건뿐이라
같은 날짜 묶음을 보려고 `submissions`(의견서·보정서, 파일명 날짜 `_20250120`)와 `/content`
stub을 **임시로** 채워 측정하고 되돌렸다(`git status`로 확인, 변경 없음).

| 확인 | 결과 |
| --- | --- |
| 마크업 | `pm-timeline-date(-text/-active/-repeat/-derived)` + `pm-timeline-chip(-active/-label)` + `pm-timeline-dot(-selected)` |
| `pm-timeline-tab*` 잔재 | CSS·TSX 모두 0건 |
| 칩 실제 높이 | 26px (선언값과 같음 — `box-sizing: border-box`) |
| 축 정렬 | 칩 중앙 = 점 중앙 = 연결선 `top` = 33px (세 값이 정확히 일치) |
| 마지막 칩 | 연결선 없음(`content: none`) |
| 고른 칩 | 브랜드 테두리 + 10% 면 + 채운 점, `font-weight: 600` |
| 고르지 않은 칩 | 카드 면 + `--border-color` + **비운 점**, `--text-secondary` |
| 날짜 활성 | 같은 날짜의 두 번째 문서(보정서)를 골라도 그 구간 라벨(의견서 줄)이 활성 유지 |
| 같은 날짜 반복 | `pm-timeline-date-repeat`로 자리만 남아 칩 높이가 어긋나지 않음 |
| harness | office-action 10/10 통과 |

`tsc -b --force`: 타임라인 관련 오류 없음.

## 남은 것(이 작업과 무관)

- `rail-harness`의 `1 / 43 failed` — "노드 이름은 통지서 → 의견서 → 보정서 → 기타 순으로
  붙는다"가 `의견제출통지서 > 의견서 > 의견서 > 보정서 > 기타 문서`로 실패한다.
  `patentDocumentNodes.ts`의 이름 붙이기 문제이고 이전부터 있었다(이 작업은 그 파일을
  건드리지 않았다).
- `PatentRecordDetailModal.tsx`의 type 오류 5건 — 작업 트리에 이미 있던 미완성 편집
  (`usePatentFieldSave`, `SaveBadge`, `Check`, `X` 미정의).
