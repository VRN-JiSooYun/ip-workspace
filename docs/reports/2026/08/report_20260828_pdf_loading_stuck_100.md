# PDF 뷰어가 `Loading 100%`에 갇히는 문제

## 작업 목적

배포 환경에서 OA 문서 PDF가 정상적으로 열린 뒤, 뷰어가 사라지고 `Loading 100%` 표시만 남는
현상을 고친다. 로컬에서는 재현되지 않았다.

## 원인

`react-pdf-highlighter-plus`의 `PdfLoader`와 pdf.js의 이벤트 순서가 맞물린 결함이다.

`PdfLoader`(`dist/esm/index.js:3606-3635`)는 문서를 **ref**에 담고, 로딩 표시를 끄는 일을
로드 promise의 `finally` **한 번**에만 맡긴다.

```js
task.onProgress = (p) => setLoadingProgress(p.loaded > p.total ? null : p);
task.promise.then((doc) => { pdfDocumentRef.current = doc; })  // ref라 리렌더 없음
            .finally(() => setLoadingProgress(null));           // 로딩을 끄는 유일한 지점
return loadingProgress ? beforeLoad(loadingProgress) : pdfDocumentRef.current && children(...);
```

그런데 pdf.js는 문서 promise가 resolve된 **뒤에** 진행 이벤트를 하나 더 보낸다.

- `GetDoc`(`pdfjs-dist/build/pdf.mjs:15980`) — 카탈로그만 파싱되면 promise resolve
- `DataLoaded`(`pdfjs-dist/build/pdf.mjs:16013`) — 전체 수신 완료 시
  `onProgress({ loaded: n, total: n })`, 즉 **정확히 100%**

그래서 `GetDoc` → 로딩 꺼짐 → 뷰어 렌더 → `DataLoaded` → 로딩 다시 켜짐 순서가 되고, 이때는
`finally`가 이미 지나가 로딩을 끌 코드가 없다. `loadingProgress`가 켜져 있으면 children이
렌더되지 않으므로 **떠 있던 뷰어가 언마운트되고 로딩 문구만 남는다.**

로컬에서만 멀쩡한 이유는 순서 문제이기 때문이다. 로컬은 파일이 사실상 한 번에 도착해
`DataLoaded`가 resolve보다 먼저 끝난다. 배포는 앞단 nginx와 문서 중계
(`PatentDocumentController`)를 거쳐 나눠 도착하고, 중계가 `accept-ranges`·`content-length`를
그대로 넘기므로 pdf.js가 range 요청으로 첫 화면을 먼저 열고 나머지를 이어 받는다. 그 사이에
순서가 뒤집힌다. **중계기가 잘못된 것이 아니라, 중계기가 제대로 동작해서 드러난 결함이다.**

## 변경 내용

`frontend/src/components/patent-analysis/pdf/PatentPdfViewer.tsx`

- 문서 하나를 그리는 부분을 `renderViewer(pdfDocument)`로 빼고, `PdfLoader`의 `children`과
  `beforeLoad` 두 곳에서 함께 쓴다. 이미 받아 둔 문서(`pdfDoc` state)가 있으면 진행 이벤트가
  와도 같은 뷰어를 그대로 그린다.
- 같은 위치에 같은 타입을 그리므로 React가 언마운트하지 않는다. 스크롤 위치·하이라이트 상태가
  유지된다.
- 문서가 아직 없을 때는 `PdfLoadingIndicator`를 그린다. 라이브러리 기본 표시를 쓰지 않는
  이유는 색이 `black` 고정이라 다크 테마에서 읽히지 않고, `total`이 0이면 `Infinity%`를
  그리기 때문이다.

`frontend/src/components/patent-analysis/pdf/patentPdfViewer.css`

- `.patent-pdf-loading` 스타일 추가(테마 토큰 사용).

`frontend/src/types/external-modules.d.ts`

- `PdfLoader`의 `beforeLoad`·`errorMessage`·`onError`·`workerSrc` 선언 추가.

## 검증 결과

배포와 같은 조건(같은 origin, `Accept-Ranges: bytes` + `Content-Length`, 청크 단위 지연 전송)을
브라우저에서 만들어 harness로 A/B 했다. 8.9MB PDF를 64KB씩 10ms 간격으로 흘려보내면 pdf.js가
range 요청 137개로 나눠 받으며, 문서 promise가 전체 수신보다 먼저 resolve된다.

- **수정 전**: 뷰어가 떴다가(t=24175ms) 사라지고(t=24819ms) `Loading 100%`만 남았다. 화면
  텍스트가 `… / 281  Loading 100%`, `.patent-pdf-main-viewer` 없음 —
  보고된 증상과 동일하게 재현됐다.
- **문제의 이벤트 확인**: 임시 로그로 문서 로드 완료 **뒤에** 도착하는
  `{ loaded: 8965138, total: 8965138 }` 진행 이벤트를 확인했다(= 100%).
- **수정 후**: 같은 조건에서 뷰어가 뜬 뒤(t=24765ms) 4초가 지나도 그대로 남아 있고
  (`viewerPresent: true`), 로딩 문구는 나타나지 않았다.
- harness 자동 점검 통과, `tsc -b --force` 통과.
- 검증용으로 잠시 넣었던 것(임시 PDF `frontend/public/__pdf-range-test.pdf`, harness의 임시
  `documentPath`, 임시 콘솔 로그)은 모두 제거했다.

## 미실행 항목

- **근본 수정은 하지 않았다.** 문서를 ref에 담고 리렌더를 진행 이벤트에만 의존하는 `PdfLoader`
  구조 자체가 원인이므로, `getDocument()`를 직접 호출해 문서를 state로 들고 있는 편이 맞다
  (`pdfjs-dist/build/pdf.worker.min.mjs?url` 타입 선언은 이미 준비돼 있다). 다만 워커 설정과
  정리(destroy) 경로를 우리가 떠안게 되어 별건으로 남긴다.
- 실제 배포 환경에서의 확인은 하지 못했다. 위 재현은 배포 조건을 브라우저에서 흉내 낸 것이다.
