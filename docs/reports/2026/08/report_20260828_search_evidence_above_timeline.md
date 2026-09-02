# 검색어 일치 근거 줄과 문서 타임라인의 자리 교환

## 작업 목적

문서 뷰어에서 `pm-doc-search-evidence`(검색어 일치 근거)와 `pm-timeline`(문서 타임라인)의
위치를 서로 바꾼다. 바뀐 뒤 순서는 `머리줄 → 근거 줄 → 타임라인 → PDF`다.

이 순서가 맞는 이유가 하나 더 있다. 타임라인의 문서 탭은 **바로 아래 내용을 여는 책갈피**로
만들어져 있는데, 그 사이에 근거 줄이 끼면 탭과 내용이 이어져 보이지 않는다.

## 왜 단순한 순서 바꾸기가 아니었나

두 줄은 서로 다른 컴포넌트의, 다른 깊이에 있었다.

```
PatentDocumentViewer
├ pm-timeline                        ← 여기
└ pm-doc-viewer-pane / FullTextPane
   └ PatentDocumentPdfPane  (key={resolvedPath})
      ├ pm-doc-search-evidence       ← 그리고 여기
      ├ toolbar
      └ PDF
```

- **타임라인을 pane 안으로 내리는 방법은 못 쓴다.** pane은 문서가 바뀔 때마다
  `key={resolvedPath}`로 remount되므로 타임라인이 통째로 다시 마운트되고, 그때 포커스가 body로
  날아가 **화살표 키로 탭을 옮기던 흐름이 끊긴다.**
- 그래서 **근거 줄을 위로 올렸다.** 줄이 쓰던 상태(어느 token이 켜져 있는지)는
  `PatentDocumentViewer`로 올리고, pane에는 '지금 하이라이트할 token' 하나만 내려보낸다.

## 변경 내용

### `frontend/src/components/patent-management/PatentDocumentViewer.tsx`
- 근거 줄 마크업을 타임라인 위에 그린다. 표시할 token은 이미 이 컴포넌트가 계산하고 있던
  `activeSearchTerms`를 그대로 쓴다(중복 제거도 여기서 이미 한다).
- `evidenceTerm`(켜진 token)과 `evidenceRequest`(요청 번호)를 state로 갖는다. 문서가 바뀌어
  token 목록이 갈리면 첫 token으로 되돌린다.
- 고른 문서에 PDF가 없으면 token 버튼을 누를 수 없게 했다(하이라이트할 곳이 없다). 예전에
  PDF 없는 문서에서 쓰던 정적 근거 줄(`pm-doc-search-evidence-static`)은 이 줄이 항상 위에
  있으므로 함께 지웠다.
- `FullTextPane`은 `searchTerms`/`searchTargetLabel` 대신 `activeTerm`/`termRequest`/
  `onManualSearch`를 받아 pane으로 넘긴다.

### `frontend/src/components/patent-management/PatentDocumentPdfPane.tsx`
- 근거 줄과 그 state(`activeEvidenceTerm`), 중복 제거 memo를 걷어냈다.
- 하이라이트 effect의 의존성을 `activeTerm`이 아니라 **`termRequest`**로 두었다. 이유가 중요하다 —
  사용자가 toolbar에서 직접 검색하면 근거 줄의 선택이 풀려 `activeTerm`이 null이 되는데, 그것을
  effect가 받으면 `searchPdf('')`로 **방금 입력한 검색을 지워 버린다.** 번호가 올라갈 때만
  반응하므로 같은 token을 다시 눌러 다시 하이라이트하는 동작도 그대로 살아 있다.
- toolbar의 직접 검색 세 경로(입력·실행·비우기)는 `onManualSearch`로 부모에 알린다. 부모는
  선택만 풀고 번호는 올리지 않는다.

### `frontend/src/components/patent-management/PatentDocumentViewer.css`
- `.pm-doc-search-evidence`가 pane 밖으로 나왔으므로 여백을 새 자리에 맞추고
  `box-sizing`을 명시했다. 죽은 규칙(`-static`, `-target`)은 지웠다.

## 검증 결과

`frontend/office-action-harness.html`에 실제 PDF와 본문을 임시로 물려, 문구가 줄바꿈으로 끊긴
본문(`간행물에\n게재된`)을 `간행물에 게재된`으로 검색한 뒤 확인했다.

| 확인 | 결과 |
| --- | --- |
| DOM 순서 | `pm-doc-search-evidence` → `pm-timeline` → `pm-doc-viewer-pane` |
| 자동 하이라이트 | 문서를 열면 첫 token(`간행물에 게재된`)이 켜지고 PDF 검색어도 같은 값 |
| 다른 token 클릭 | `게재된`으로 바뀌고 PDF 검색어도 따라감 |
| toolbar 직접 검색 | `INTERNATIONAL` 입력 → token 선택이 풀리고 **입력값은 지워지지 않음** |
| 같은 token 다시 클릭 | 직접 검색 뒤에도 `게재된`이 다시 걸림 |
| harness 자동 점검 | 10개 전부 통과 |

`tsc -b --force` 통과. 검증용 임시 PDF와 harness의 임시 `documentPath`는 제거했다.

## 미실행 항목

- PDF가 없는 문서에서 token 버튼은 비활성으로만 두었다. 추출 본문 위에서 하이라이트하는
  기능은 없다(원래도 없었다).
- 근거 줄은 여전히 고른 문서 하나의 것이다. 타임라인의 '일치' 배지가 다른 문서에도 붙어
  있어도 그 문서를 골라야 token이 보인다.
