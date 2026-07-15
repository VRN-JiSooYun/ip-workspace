import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Button, Space, Tooltip, Typography, theme } from 'antd';
import { ArrowLeftRight, ArrowUpDown, Clipboard, Download, Info } from 'lucide-react';
import { CHEMDRAW_CONFIG } from '../../config/chemdraw';
import { installChemDrawKoreanKeyboardBridge } from '../../utils/chemdrawKeyboard';
import { commitChemDrawActiveInput, waitForChemDrawEditorReady } from '../../utils/chemdrawCommit';
import {
  isChemDrawClipboardFixerAvailable,
  isChemDrawClipboardFixerSupportedPlatform,
  notifyChemDrawClipboardFixer,
} from '../../utils/chemdrawClipboardFixer';
import {
  applyChemDrawRotate180,
  dispatchChemDrawRotate180Shortcut,
  getChemDrawRotate180ShortcutLabel,
} from '../../utils/chemdrawTransform';
import type { ChemDrawFlipAxis } from '../../utils/chemdrawTransform';
import { installCanvasReadbackPatch } from '../../utils/canvasReadback';
import { installPassiveWheelListenerPatch } from '../../utils/passiveWheelListenerPatch';

const { Text } = Typography;
const CHEMDRAW_CLIPBOARD_FIXER_DOWNLOAD_URL = `${import.meta.env.BASE_URL}voronoi_chemdraw_clipboard_fixer/voronoi-chemdraw-clipboard-fixer.zip`;

export interface ChemDrawStructureData {
  smiles: string;
  svg: string | null;
  sourceSvg?: string | null;
  rdkitSvg?: string | null;
  cdxml?: string;
  molfile?: string;
  molV2000?: string;
  molV3000?: string;
}

export interface ChemDrawCanvasCoreHandle {
  getEditor: () => any;
  flushPendingInput: () => Promise<string>;
}

interface ChemDrawCanvasCoreProps {
  active: boolean;
  height?: number;
  initialCdxml?: string;
  initialSmiles?: string;
  initialMolblock?: string;
  smilesValue?: string;
  onSmilesChange?: (smiles: string) => void;
  onReady?: (editor: any) => void;
  onEditorInteraction?: () => void;
  controlsPlacement?: 'top' | 'left';
  helperText?: React.ReactNode;
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const getFormatData = (editor: any, format: string | undefined) => {
  if (!format || !editor?.getData) return '';
  try {
    return editor.getData(format) || '';
  } catch {
    return '';
  }
};

const getStringMethodData = (editor: any, methodName: string) => {
  const method = editor?.[methodName];
  if (typeof method !== 'function') return '';
  try {
    const result = method.call(editor);
    return typeof result === 'string' ? result : '';
  } catch {
    return '';
  }
};

const getCallbackMethodData = (editor: any, methodName: string) => {
  const method = editor?.[methodName];
  if (typeof method !== 'function') return Promise.resolve('');

  return new Promise<string>((resolve) => {
    let resolved = false;
    const finish = (value: string) => {
      if (resolved) return;
      resolved = true;
      resolve(value || '');
    };

    try {
      const result = method.call(editor, (value: string | undefined, error: unknown) => {
        finish(error ? '' : value || '');
      });

      if (typeof result === 'string') {
        finish(result);
      }
    } catch {
      finish('');
    }

    window.setTimeout(() => finish(''), 1000);
  });
};

export const extractChemDrawStructureData = async (editor: any): Promise<ChemDrawStructureData> => {
  const formats = (window as any).perkinelmer?.DataFormats;
  const data: ChemDrawStructureData = {
    smiles: '',
    svg: null,
  };

  try {
    if (editor?.getData) {
      data.smiles = getFormatData(editor, formats?.SMILES || 'SMILES');
      data.svg = getFormatData(editor, formats?.SVG || 'SVG') || null;
      data.cdxml = getFormatData(editor, formats?.CDXML || 'CDXML');
      data.molfile = getFormatData(editor, formats?.MOLFILE || 'MOLFILE');
      data.molV2000 = getFormatData(editor, formats?.MOLV2000 || 'MOLV2000');
      data.molV3000 = getFormatData(editor, formats?.MOLV3000 || 'MOLV3000');
    }

    data.cdxml = data.cdxml || getStringMethodData(editor, 'getCDXML');
    data.svg = data.svg || getStringMethodData(editor, 'getSVG') || null;
    data.molV2000 = data.molV2000 || await getCallbackMethodData(editor, 'getMOL');
    data.molV3000 = data.molV3000 || await getCallbackMethodData(editor, 'getMOLV3000');
    data.smiles = data.smiles || await getCallbackMethodData(editor, 'getSMILES');
  } catch (error) {
    console.error('Error extracting ChemDraw data:', error);
  }

  return data;
};

export const getChemDrawEditorSmiles = async (editor: any): Promise<string> => {
  if (!editor) return '';
  const formats = (window as any).perkinelmer?.DataFormats;

  if (editor.getData) {
    try {
      const smiles = editor.getData(formats?.SMILES || 'SMILES');
      if (typeof smiles === 'string') return smiles;
    } catch {
      // Continue with method fallback.
    }
  }

  return getCallbackMethodData(editor, 'getSMILES');
};

const loadStructureIntoEditor = (
  editor: any,
  initialCdxml?: string,
  initialSmiles?: string,
  initialMolblock?: string,
) => {
  if (!editor) return;

  try {
    const formats = (window as any).perkinelmer?.DataFormats;
    if (initialCdxml) {
      if (editor.loadCDXML) editor.loadCDXML(initialCdxml);
      else if (editor.setData) editor.setData(formats?.CDXML || 'CDXML', initialCdxml);
      else if (editor.setMolecule) editor.setMolecule(initialCdxml);
    } else if (initialMolblock) {
      if (editor.loadMOL) editor.loadMOL(initialMolblock);
      else if (editor.setData) editor.setData(formats?.MOLV2000 || formats?.MOLFILE || 'MOLFILE', initialMolblock);
      else if (editor.setMolecule) editor.setMolecule(initialMolblock);
    } else if (initialSmiles) {
      if (editor.loadSMILES) editor.loadSMILES(initialSmiles);
      else if (editor.setData) editor.setData(formats?.SMILES || 'SMILES', initialSmiles);
      else if (editor.setMolecule) editor.setMolecule(initialSmiles);
    }
  } catch (error) {
    console.warn('Failed to load structure into ChemDraw editor:', error);
  }
};

const loadSmilesIntoEditor = (editor: any, smiles: string) => {
  if (!editor) return;

  try {
    const formats = (window as any).perkinelmer?.DataFormats;
    if (!smiles.trim()) {
      if (editor.clear) editor.clear();
      else if (editor.setData) editor.setData(formats?.SMILES || 'SMILES', '');
      else if (editor.setMolecule) editor.setMolecule('');
    } else if (editor.loadSMILES) {
      editor.loadSMILES(smiles);
    } else if (editor.setData) {
      editor.setData(formats?.SMILES || 'SMILES', smiles);
    } else if (editor.setMolecule) {
      editor.setMolecule(smiles);
    }
  } catch (error) {
    console.warn('Failed to load SMILES into ChemDraw editor:', error);
  }
};

const getChemDrawClipboardState = (container: HTMLElement | null) => {
  if (!container) {
    return {
      target: null,
      enabled: false,
      title: 'ChemDraw clipboard',
    };
  }

  const icon = container.querySelector<HTMLElement>('.cdd-clipboard-icon:not(.cdd-clipboard-icon-hidden)');
  const copyDocumentButton = container.querySelector<HTMLElement>('.cdd-copy-document-button');
  const target = icon || copyDocumentButton;

  return {
    target,
    enabled: Boolean(icon?.querySelector('.cdd-clipboard-icon-image-enabled')),
    title: target?.getAttribute('title') || target?.getAttribute('aria-label') || 'ChemDraw clipboard',
  };
};

const clickChemDrawClipboardTarget = (container: HTMLElement | null) => {
  const { target } = getChemDrawClipboardState(container);
  if (!target) return false;

  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((eventName) => {
    const EventConstructor = eventName.startsWith('pointer') && typeof PointerEvent !== 'undefined'
      ? PointerEvent
      : MouseEvent;
    target.dispatchEvent(new EventConstructor(eventName, { bubbles: true, cancelable: true }));
  });

  return true;
};

const ChemDrawCanvasCore = forwardRef<ChemDrawCanvasCoreHandle, ChemDrawCanvasCoreProps>(({
  active,
  height = 500,
  initialCdxml,
  initialSmiles,
  initialMolblock,
  smilesValue,
  onSmilesChange,
  onReady,
  onEditorInteraction,
  controlsPlacement = 'top',
  helperText,
}, ref) => {
  const { token } = theme.useToken();
  const rotateHorizontalShortcutLabel = getChemDrawRotate180ShortcutLabel('horizontal');
  const rotateVerticalShortcutLabel = getChemDrawRotate180ShortcutLabel('vertical');
  const isClipboardFixerSupported = isChemDrawClipboardFixerSupportedPlatform();
  const [containerId] = useState(`chemdraw-${Math.random().toString(36).slice(2, 11)}`);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [hasClipboardAction, setHasClipboardAction] = useState(false);
  const [isClipboardEnabled, setIsClipboardEnabled] = useState(false);
  const [clipboardTitle, setClipboardTitle] = useState('ChemDraw clipboard');
  const [isClipboardFixerAvailable, setIsClipboardFixerAvailable] = useState(false);
  const lastEmittedSmilesRef = useRef('');
  const lastLoadedSmilesRef = useRef('');

  const flushPendingInput = async (editor = editorInstance) => {
    if (!editor) return '';

    await commitChemDrawActiveInput(containerId, editor);

    const smiles = await getChemDrawEditorSmiles(editor);
    lastEmittedSmilesRef.current = smiles;
    onSmilesChange?.(smiles);
    return smiles;
  };

  useImperativeHandle(ref, () => ({
    getEditor: () => editorInstance,
    flushPendingInput: () => flushPendingInput(editorInstance),
  }), [editorInstance]);

  useEffect(() => {
    if (!active) {
      setEditorInstance(null);
      setHasClipboardAction(false);
      setIsClipboardEnabled(false);
      setClipboardTitle('ChemDraw clipboard');
      onReady?.(null);
      return;
    }

    const restoreReadbackPatch = installCanvasReadbackPatch();
    const restorePassiveWheelPatch = installPassiveWheelListenerPatch();
    let isDisposed = false;

    const initializeEditor = () => {
      try {
        const manager = (window as any).perkinelmer?.ChemdrawWebManager;
        if (!manager) return;

        window.setTimeout(() => {
          if (isDisposed) return;
          const container = document.getElementById(containerId);
          if (!container) return;

          manager.attach({
            id: containerId,
            license: CHEMDRAW_CONFIG.LICENSE_XML,
            viewOnly: false,
            callback: (editor: any) => {
              if (isDisposed) return;
              editor.__flushPendingInput = () => flushPendingInput(editor);
              window.setTimeout(() => loadStructureIntoEditor(editor, initialCdxml, initialSmiles, initialMolblock), 500);
              void waitForChemDrawEditorReady(containerId, editor).then(async () => {
                if (isDisposed) return;
                await wait(100);
                if (isDisposed) return;
                const clipboardState = getChemDrawClipboardState(container);
                setEditorInstance(editor);
                setHasClipboardAction(Boolean(clipboardState.target));
                setIsClipboardEnabled(clipboardState.enabled);
                setClipboardTitle(clipboardState.title);
                onReady?.(editor);
              });
            },
          });
        }, 300);
      } catch (error) {
        console.error('Failed to initialize ChemDraw JS:', error);
      }
    };

    const loadChemDraw = () => {
      if ((window as any).perkinelmer?.ChemdrawWebManager) {
        initializeEditor();
        return;
      }

      const script = document.createElement('script');
      script.src = CHEMDRAW_CONFIG.SCRIPT_PATH;
      script.async = true;
      script.onload = () => {
        if (!isDisposed) initializeEditor();
      };
      document.body.appendChild(script);
    };

    loadChemDraw();

    return () => {
      isDisposed = true;
      setEditorInstance(null);
      setHasClipboardAction(false);
      setIsClipboardEnabled(false);
      setClipboardTitle('ChemDraw clipboard');
      onReady?.(null);
      restoreReadbackPatch();
      restorePassiveWheelPatch();
    };
  }, [active, containerId, initialCdxml, initialSmiles, initialMolblock, onReady]);

  useEffect(() => {
    if (!active || !editorInstance || !onSmilesChange) return;

    let isDisposed = false;
    const intervalId = window.setInterval(async () => {
      const smiles = await getChemDrawEditorSmiles(editorInstance);
      if (isDisposed) return;

      if (smiles !== lastEmittedSmilesRef.current && smiles !== lastLoadedSmilesRef.current) {
        lastEmittedSmilesRef.current = smiles;
        onSmilesChange(smiles);
      }
    }, 500);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
    };
  }, [active, editorInstance, onSmilesChange]);

  useEffect(() => {
    if (!active || !editorInstance || smilesValue === undefined) return;

    const nextSmiles = smilesValue.trim();
    if (nextSmiles === lastEmittedSmilesRef.current || nextSmiles === lastLoadedSmilesRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadSmilesIntoEditor(editorInstance, nextSmiles);
      lastLoadedSmilesRef.current = nextSmiles;
      lastEmittedSmilesRef.current = nextSmiles;
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [active, editorInstance, smilesValue]);

  useEffect(() => {
    if (!active || !editorInstance) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    return installChemDrawKoreanKeyboardBridge(container);
  }, [active, editorInstance, containerId]);

  useEffect(() => {
    if (!active || controlsPlacement !== 'left' || !isClipboardFixerSupported) {
      setIsClipboardFixerAvailable(false);
      return;
    }

    let isDisposed = false;
    const updateClipboardFixerAvailability = async () => {
      const isAvailable = await isChemDrawClipboardFixerAvailable();
      if (!isDisposed) setIsClipboardFixerAvailable(isAvailable);
    };

    void updateClipboardFixerAvailability();
    const intervalId = window.setInterval(updateClipboardFixerAvailability, 5000);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
    };
  }, [active, controlsPlacement, isClipboardFixerSupported]);

  useEffect(() => {
    if (!active || !editorInstance || !onEditorInteraction) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    const handleInteraction = () => onEditorInteraction();
    container.addEventListener('pointerdown', handleInteraction);
    container.addEventListener('keydown', handleInteraction);
    container.addEventListener('paste', handleInteraction);

    return () => {
      container.removeEventListener('pointerdown', handleInteraction);
      container.removeEventListener('keydown', handleInteraction);
      container.removeEventListener('paste', handleInteraction);
    };
  }, [active, editorInstance, containerId, onEditorInteraction]);

  useEffect(() => {
    if (!active || !editorInstance || !isClipboardFixerSupported) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    const handleCopy = () => {
      void notifyChemDrawClipboardFixer(editorInstance);
    };
    container.addEventListener('copy', handleCopy, true);

    return () => container.removeEventListener('copy', handleCopy, true);
  }, [active, editorInstance, containerId, isClipboardFixerSupported]);

  useEffect(() => {
    if (!active || !editorInstance) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    const updateClipboardState = () => {
      const clipboardState = getChemDrawClipboardState(container);
      setHasClipboardAction(Boolean(clipboardState.target));
      setIsClipboardEnabled(clipboardState.enabled);
      setClipboardTitle(clipboardState.title);
    };

    updateClipboardState();
    const observer = new MutationObserver(updateClipboardState);
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled', 'aria-disabled'] });

    return () => observer.disconnect();
  }, [active, editorInstance, containerId]);

  const handleRotate180 = (axis: ChemDrawFlipAxis) => {
    const container = document.getElementById(containerId);
    const didApplyCommand = applyChemDrawRotate180(editorInstance, axis);
    if (!didApplyCommand) {
      dispatchChemDrawRotate180Shortcut(container, axis);
    }
  };

  const handleControlMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
  };

  const handleClipboardClick = () => {
    clickChemDrawClipboardTarget(document.getElementById(containerId));
  };

  const controls = (
    <Space
      direction={controlsPlacement === 'left' ? 'vertical' : 'horizontal'}
      style={controlsPlacement === 'top' ? { marginBottom: 8 } : undefined}
    >
      <Tooltip title={`180° 회전 - 수평 (${rotateHorizontalShortcutLabel})`} placement="left">
        <Button
          icon={<ArrowLeftRight size={16} />}
          onMouseDown={handleControlMouseDown}
          onClick={() => handleRotate180('horizontal')}
          disabled={!editorInstance}
        />
      </Tooltip>
      <Tooltip title={`180° 회전 - 수직 (${rotateVerticalShortcutLabel})`} placement="left">
        <Button
          icon={<ArrowUpDown size={16} />}
          onMouseDown={handleControlMouseDown}
          onClick={() => handleRotate180('vertical')}
          disabled={!editorInstance}
        />
      </Tooltip>
      <Tooltip title={clipboardTitle} placement="left">
        <Button
          type={isClipboardEnabled ? 'primary' : 'default'}
          icon={<Clipboard size={16} />}
          onMouseDown={handleControlMouseDown}
          onClick={handleClipboardClick}
          disabled={!editorInstance || !hasClipboardAction}
        />
      </Tooltip>
      {controlsPlacement === 'left' && isClipboardFixerSupported ? (
        <Tooltip
          title={isClipboardFixerAvailable
            ? 'ChemDraw Clipboard Fixer 연결됨'
            : 'ChemDraw Clipboard Fixer 연결 안 됨 - 설치 파일 다운로드'}
          placement="left"
        >
          <Button
            type={isClipboardFixerAvailable ? 'primary' : 'default'}
            href={CHEMDRAW_CLIPBOARD_FIXER_DOWNLOAD_URL}
            download="voronoi-chemdraw-clipboard-fixer.zip"
            icon={<Download size={16} />}
            aria-label={isClipboardFixerAvailable
              ? 'ChemDraw Clipboard Fixer 연결됨, 설치 파일 다운로드'
              : 'ChemDraw Clipboard Fixer 연결 안 됨, 설치 파일 다운로드'}
          />
        </Tooltip>
      ) : null}
    </Space>
  );

  const editorCanvas = (
    <div
      id={containerId}
      style={{
        height,
        width: '100%',
        minWidth: 0,
        background: token.colorBgLayout,
        borderRadius: 8,
        border: `1px solid ${token.colorBorderSecondary}`,
        overflow: 'hidden',
      }}
    />
  );

  return (
    <>
      {controlsPlacement === 'left' ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
          {controls}
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            {editorCanvas}
          </div>
        </div>
      ) : (
        <>
          {controls}
          {editorCanvas}
        </>
      )}
      {helperText ? (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            <Info size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            {helperText}
          </Text>
        </div>
      ) : null}
    </>
  );
});

const styles = `
  .CDW_Logo,
  .cdd-logo,
  .cdd-clipboard-icon-row-container {
    display: none !important;
  }

  [id^="chemdraw-"],
  [id^="chemdraw-"] * {
    scrollbar-width: thin !important;
    scrollbar-color: var(--patent-scrollbar-thumb) var(--patent-scrollbar-track) !important;
  }

  [id^="chemdraw-"]::-webkit-scrollbar,
  [id^="chemdraw-"] *::-webkit-scrollbar {
    width: 10px !important;
    height: 10px !important;
  }

  [id^="chemdraw-"]::-webkit-scrollbar-track,
  [id^="chemdraw-"] *::-webkit-scrollbar-track {
    background: var(--patent-scrollbar-track) !important;
  }

  [id^="chemdraw-"]::-webkit-scrollbar-thumb,
  [id^="chemdraw-"] *::-webkit-scrollbar-thumb {
    background: var(--patent-scrollbar-thumb) !important;
    border: 2px solid var(--card-bg) !important;
    border-radius: 999px !important;
  }

  [id^="chemdraw-"]::-webkit-scrollbar-thumb:hover,
  [id^="chemdraw-"] *::-webkit-scrollbar-thumb:hover {
    background: var(--patent-scrollbar-thumb-hover) !important;
  }

  [id^="chemdraw-"]::-webkit-scrollbar-corner,
  [id^="chemdraw-"] *::-webkit-scrollbar-corner {
    background: transparent !important;
  }
`;

if (typeof document !== 'undefined' && !document.getElementById('chemdraw-common-hide-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'chemdraw-common-hide-styles';
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

export default ChemDrawCanvasCore;
