import { create } from 'zustand';

/**
 * PDF 뷰어의 배율.
 *
 * 배율은 문서가 아니라 "사용자가 지금 어떻게 보고 싶은지"에 속한다. 그런데 뷰어 상태는
 * `usePatentPdfViewer` 인스턴스마다 따로 있어서, 다른 화면·다른 패널에서 문서를 열면
 * 매번 기본값으로 돌아간다. 그래서 배율만 store로 끌어올려 모든 뷰어가 공유한다.
 *
 * 저장하는 값은 결과 배율(%)이 아니라 **의도**다. 폭 맞춤은 패널 폭에 따라 결과 %가 매번
 * 달라지므로, 'page-width'로 보던 사람에게 다음 문서에서 고정 %를 물려주면 의도가 어긋난다.
 */

const PDF_ZOOM_LEVELS = [25, 50, 75, 100, 125, 150, 200, 250, 300, 400] as const;

/** 확대/축소의 하한·상한. toolbar의 직접 입력도 같은 범위를 쓴다. */
export const PDF_ZOOM_MIN_PERCENT = PDF_ZOOM_LEVELS[0];
export const PDF_ZOOM_MAX_PERCENT = PDF_ZOOM_LEVELS[PDF_ZOOM_LEVELS.length - 1];

export { PDF_ZOOM_LEVELS };

/** 숫자면 그 비율(1 = 100%), `page-width`면 페이지 너비에 맞춘다. */
export type PdfZoomValue = 'page-width' | number;

/**
 * 기본은 100%다. 폭 맞춤으로 열면 문서·패널 폭에 따라 배율이 매번 달라져 "지금 몇 %인지"가
 * 열 때마다 바뀐다. 폭 맞춤은 toolbar의 전용 버튼으로 언제든 부를 수 있다.
 */
const DEFAULT_ZOOM: PdfZoomValue = 1;

const STORAGE_KEY = 'ipWorkspace.pdfViewerZoom';

const clampScale = (scale: number) => Math.min(
  Math.max(scale, PDF_ZOOM_MIN_PERCENT / 100),
  PDF_ZOOM_MAX_PERCENT / 100,
);

const readStoredZoom = (): PdfZoomValue => {
  if (typeof window === 'undefined') return DEFAULT_ZOOM;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ZOOM;
    if (raw === 'page-width') return 'page-width';
    const scale = Number(raw);
    // 저장 시점 이후 하한·상한이 바뀌었을 수 있으므로 읽을 때도 범위를 강제한다.
    return Number.isFinite(scale) && scale > 0 ? clampScale(scale) : DEFAULT_ZOOM;
  } catch {
    return DEFAULT_ZOOM;
  }
};

const writeStoredZoom = (zoom: PdfZoomValue): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(zoom));
  } catch {
    // 저장이 실패해도 뷰어는 계속 써야 한다.
  }
};

type PdfViewerState = {
  zoom: PdfZoomValue;
  /** 배율을 %로 지정한다. 범위를 벗어난 값은 하한·상한으로 자른다. */
  setZoomPercent: (percent: number) => void;
  /** 폭 맞춤으로 전환한다. */
  setZoomToPageWidth: () => void;
};

export const usePdfViewerStore = create<PdfViewerState>((set, get) => ({
  zoom: readStoredZoom(),

  setZoomPercent: (percent) => {
    if (!Number.isFinite(percent)) return;
    const nextZoom = clampScale(percent / 100);
    if (get().zoom === nextZoom) return;
    set({ zoom: nextZoom });
    writeStoredZoom(nextZoom);
  },

  setZoomToPageWidth: () => {
    if (get().zoom === 'page-width') return;
    set({ zoom: 'page-width' });
    writeStoredZoom('page-width');
  },
}));
