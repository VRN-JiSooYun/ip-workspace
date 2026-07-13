type RuntimeWindow = Window & {
  _env_?: {
    VITE_CHEMDRAW_CLIPBOARD_FIXER_URL?: string;
  };
};

const runtimeBaseUrl = typeof window !== 'undefined'
  ? (window as RuntimeWindow)._env_?.VITE_CHEMDRAW_CLIPBOARD_FIXER_URL
  : undefined;
const CHEMDRAW_CLIPBOARD_FIXER_BASE_URL = (
  runtimeBaseUrl
  || import.meta.env.VITE_CHEMDRAW_CLIPBOARD_FIXER_URL
  || 'http://localhost:47823'
).replace(/\/+$/, '');
const CHEMDRAW_CLIPBOARD_FIXER_API_URL = `${CHEMDRAW_CLIPBOARD_FIXER_BASE_URL}/svg`;
const CHEMDRAW_CLIPBOARD_FIXER_HEALTH_URL = `${CHEMDRAW_CLIPBOARD_FIXER_BASE_URL}/health`;
const CHEMDRAW_CLIPBOARD_FIXER_TIMEOUT_MS = 1500;
const CHEMDRAW_CLIPBOARD_FIXER_HEALTH_TIMEOUT_MS = 1000;

export const isChemDrawClipboardFixerSupportedPlatform = (): boolean => {
  if (typeof navigator === 'undefined') return false;

  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = navigatorWithUserAgentData.userAgentData?.platform
    || navigator.platform
    || navigator.userAgent;

  return /^win/i.test(platform) || /windows/i.test(platform);
};

const getChemDrawSvg = (editor: any): Promise<string> => new Promise((resolve) => {
  if (typeof editor?.getSVG !== 'function') {
    resolve('');
    return;
  }

  let settled = false;
  const finish = (svg: unknown) => {
    if (settled) return;
    settled = true;
    resolve(typeof svg === 'string' ? svg : '');
  };

  try {
    const result = editor.getSVG((svg: string | undefined, error: unknown) => {
      finish(error ? '' : svg);
    });

    if (typeof result === 'string') {
      finish(result);
    }
  } catch {
    finish('');
  }

  window.setTimeout(() => finish(''), CHEMDRAW_CLIPBOARD_FIXER_TIMEOUT_MS);
});

export const notifyChemDrawClipboardFixer = async (editor: any): Promise<void> => {
  if (!isChemDrawClipboardFixerSupportedPlatform()) return;

  try {
    const svg = await getChemDrawSvg(editor);
    if (!svg) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      CHEMDRAW_CLIPBOARD_FIXER_TIMEOUT_MS,
    );

    try {
      await fetch(CHEMDRAW_CLIPBOARD_FIXER_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'image/svg+xml' },
        body: svg,
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  } catch {
    // The local helper is optional and must never interrupt ChemDraw copy behavior.
  }
};

export const isChemDrawClipboardFixerAvailable = async (): Promise<boolean> => {
  if (!isChemDrawClipboardFixerSupportedPlatform()) return false;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    CHEMDRAW_CLIPBOARD_FIXER_HEALTH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(CHEMDRAW_CLIPBOARD_FIXER_HEALTH_URL, {
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.ok && (await response.text()).trim().toLowerCase() === 'ok';
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
