import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { App as AntApp, Button, Space, Card, Tooltip, Divider, theme } from 'antd';
import {
  Square, Circle, Type, Trash2,
  Image as ImageIcon, Download, Eraser, ClipboardCopy
} from 'lucide-react';
import ChemDrawModal, { type ChemDrawStructureData } from '../common/ChemDrawModal';
import BenzeneIcon from '../common/BenzeneIcon';

interface WhiteboardEditorProps {
  height?: number;
  compounds?: any[];
  searchedSvg?: string | null;
  searchKeyword?: string;
}

const WhiteboardEditor: React.FC<WhiteboardEditorProps> = ({ 
  height = 650, 
  compounds = [],
  searchedSvg,
  searchKeyword
}) => {
  const { token } = theme.useToken();
  const { message, modal } = AntApp.useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const isChemDrawOpenRef = useRef(false);
  const [isChemDrawOpen, setIsChemDrawOpen] = useState(false);
  const [chemDrawInitialStructure, setChemDrawInitialStructure] = useState<{
    cdxml?: string;
    molblock?: string;
    smiles?: string;
  } | null>(null);
  const [editingStructureObject, setEditingStructureObject] = useState<any>(null);
  const [selectedStructureData, setSelectedStructureData] = useState<ChemDrawStructureData | null>(null);

  type ChemicalTextFormat = 'cdxml' | 'mol' | 'smiles';

  useEffect(() => {
    isChemDrawOpenRef.current = isChemDrawOpen;
  }, [isChemDrawOpen]);

  const getStructureData = (obj: any): ChemDrawStructureData | null => {
    return obj?.structureData || null;
  };

  const getCopyPayload = (data: ChemDrawStructureData) => {
    const value = data.cdxml || data.molV2000 || data.molfile || data.molV3000 || data.smiles;
    const format = data.cdxml
      ? 'CDXML'
      : data.molV2000 || data.molfile
        ? 'MOLV2000'
        : data.molV3000
          ? 'MOLV3000'
          : 'SMILES';

    return value ? { value, format } : null;
  };

  const writeStructureToClipboard = async (data: ChemDrawStructureData) => {
    const payload = getCopyPayload(data);
    if (!payload) {
      message.warning('복사할 구조 데이터가 없습니다.');
      return;
    }

    try {
      await navigator.clipboard.writeText(payload.value);
      message.success(`${payload.format} 구조 데이터 복사 완료`);
    } catch (error) {
      console.error('Failed to copy chemical structure data:', error);
      message.error('클립보드 복사에 실패했습니다.');
    }
  };

  const isWhiteOrTransparentFill = (fill: unknown) => {
    if (!fill || typeof fill !== 'string') return true;
    const normalized = fill.replace(/\s+/g, '').toLowerCase();
    return [
      'none',
      'transparent',
      '#fff',
      '#ffffff',
      'white',
      'rgb(255,255,255)',
      'rgba(255,255,255,0)',
      'rgba(255,255,255,1)'
    ].includes(normalized);
  };

  const isSvgBackgroundObject = (obj: any, options: any) => {
    const optionWidth = Number(options?.width) || 0;
    const optionHeight = Number(options?.height) || 0;
    const objectWidth = Number(obj?.width) || 0;
    const objectHeight = Number(obj?.height) || 0;
    const coversSvg = optionWidth > 0
      && optionHeight > 0
      && objectWidth >= optionWidth * 0.9
      && objectHeight >= optionHeight * 0.9;

    return coversSvg && isWhiteOrTransparentFill(obj?.fill) && !obj?.stroke;
  };

  const isDarkSvgColor = (color: unknown) => {
    if (!color || typeof color !== 'string') return false;
    const normalized = color.replace(/\s+/g, '').toLowerCase();

    if (['#000', '#000000', 'black', 'rgb(0,0,0)', 'rgba(0,0,0,1)'].includes(normalized)) {
      return true;
    }

    const hexMatch = normalized.match(/^#([0-9a-f]{6})$/i);
    if (hexMatch) {
      const value = hexMatch[1];
      const red = parseInt(value.slice(0, 2), 16);
      const green = parseInt(value.slice(2, 4), 16);
      const blue = parseInt(value.slice(4, 6), 16);
      return red <= 48 && green <= 48 && blue <= 48;
    }

    const rgbMatch = normalized.match(/^rgba?\((\d+),(\d+),(\d+)(?:,[\d.]+)?\)$/);
    if (rgbMatch) {
      return Number(rgbMatch[1]) <= 48 && Number(rgbMatch[2]) <= 48 && Number(rgbMatch[3]) <= 48;
    }

    return false;
  };

  const applyDarkModeSvgColor = (objects: any[]) => {
    if (!isDarkMode(token)) return objects;

    const lineColor = token.colorText;
    objects.forEach((obj) => {
      if (!obj) return;

      if (isDarkSvgColor(obj.stroke)) {
        obj.set('stroke', lineColor);
      }

      if (isDarkSvgColor(obj.fill)) {
        obj.set('fill', lineColor);
      }
    });

    return objects;
  };

  const detectChemicalTextFormat = (text: string): ChemicalTextFormat | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    if (/<CDXML[\s>]/i.test(trimmed) || /<!DOCTYPE\s+CDXML/i.test(trimmed)) {
      return 'cdxml';
    }

    if (/\bV(2000|3000)\b/.test(trimmed) && /(^|\n)M\s+END(\n|$)/.test(trimmed)) {
      return 'mol';
    }

    const isSingleLine = !/[\r\n]/.test(trimmed);
    const hasWhitespace = /\s/.test(trimmed);
    const hasOnlySmilesChars = /^[BCNOFPSIHKLiNaMgCaAlSiSeBrClbcnops0-9@+\-[\]()=#$\\/%.:]+$/.test(trimmed);
    const hasAtomToken = /(\[[^\]]+\]|Br|Cl|Si|Se|Na|Li|Mg|Ca|Al|[BCNOFPSIbcnops])/.test(trimmed);
    const hasNaturalLanguageChars = /[가-힣]|[{}<>]/.test(trimmed);

    if (isSingleLine && !hasWhitespace && !hasNaturalLanguageChars && hasOnlySmilesChars && hasAtomToken && trimmed.length <= 1000) {
      return 'smiles';
    }

    return null;
  };

  const addImageDataUrlToCanvas = (dataUrl: string) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    fabric.Image.fromURL(dataUrl).then((img: any) => {
      if (img.width && img.width > 500) {
        img.scaleToWidth(500);
      }

      const center = canvas.getVpCenter();
      img.set({
        left: center.x - (img.getScaledWidth() / 2),
        top: center.y - (img.getScaledHeight() / 2),
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    });
  };

  const addImageFileToCanvas = (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.warning('이미지 파일만 추가할 수 있습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl !== 'string') {
        message.error('이미지 파일을 읽지 못했습니다.');
        return;
      }

      addImageDataUrlToCanvas(dataUrl);
    };
    reader.onerror = () => {
      message.error('이미지 파일을 읽지 못했습니다.');
    };
    reader.readAsDataURL(file);
  };

  // SVG loading logic
  const loadCompoundsToCanvas = async (canvas: any) => {
    canvas.clear();
    canvas.backgroundColor = token.colorBgLayout;

    let currentX = 50;
    let currentY = 50;
    const spacing = 180;
    const itemsPerRow = 4;
    let count = 0;

    // Helper to load individual SVG
    const loadSvg = (svgString: string, label: string) => {
      return fabric.loadSVGFromString(svgString).then((result: any) => {
        const { objects, options } = result;
        const filteredObjects = objects.filter((o: any) => o !== null);
        const obj = fabric.util.groupSVGElements(applyDarkModeSvgColor(filteredObjects), options);
        
        // Resize and position
        const scale = 120 / Math.max(obj.width || 1, obj.height || 1);
        obj.set({
          scaleX: scale,
          scaleY: scale,
          left: currentX,
          top: currentY,
          selectable: true,
          hasControls: true,
        });

        // Add label
        const text = new fabric.IText(label, {
          left: currentX,
          top: currentY + 130,
          fontSize: 12,
          fontFamily: 'Inter',
          fontWeight: 'bold',
          fill: token.colorTextSecondary,
        });

        canvas.add(obj);
        canvas.add(text);

        // Update coordinates for next item
        count++;
        if (count % itemsPerRow === 0) {
          currentX = 50;
          currentY += 200;
        } else {
          currentX += spacing;
        }
      });
    };

    // Load searched SVG first if exists
    if (searchedSvg) {
      await loadSvg(searchedSvg, `Search: ${searchKeyword || 'Structure'}`);
    }

    // Since mock data doesn't have real SVGs for every compound yet, 
    // we'll only load the ones that match our search or have valid SVG data.
    // In a real app, you'd fetch SVGs for all filtered compounds.
    canvas.renderAll();
  };

  const addStructureToCanvas = (data: ChemDrawStructureData, position?: { left: number; top: number }) => {
    const canvas = fabricCanvasRef.current;
    if (!data.svg || !canvas) {
      setIsChemDrawOpen(false);
      setChemDrawInitialStructure(null);
      setEditingStructureObject(null);
      return;
    }

    fabric.loadSVGFromString(data.svg).then((result: any) => {
      const { objects, options } = result;
      const filteredObjects = objects.filter((o: any) => o !== null && !isSvgBackgroundObject(o, options));
      if (filteredObjects.length === 0) {
        message.warning('캔버스에 추가할 구조 SVG가 비어 있습니다.');
        setIsChemDrawOpen(false);
        setChemDrawInitialStructure(null);
        setEditingStructureObject(null);
        return;
      }

      const obj = fabric.util.groupSVGElements(applyDarkModeSvgColor(filteredObjects));
      const editTarget = editingStructureObject;
      const targetWidth = editTarget?.getScaledWidth?.() || 150;
      const targetHeight = editTarget?.getScaledHeight?.() || 150;
      const scale = editTarget
        ? Math.min(targetWidth / Math.max(obj.width || 1, 1), targetHeight / Math.max(obj.height || 1, 1))
        : 150 / Math.max(obj.width || 1, obj.height || 1);

      obj.set({
        scaleX: scale,
        scaleY: scale,
        left: position?.left ?? editTarget?.left ?? 200,
        top: position?.top ?? editTarget?.top ?? 200,
        angle: editTarget?.angle ?? 0,
        selectable: true,
        hasControls: true,
        targetFindTolerance: 4,
      });
      (obj as any).structureData = data;
      (obj as any).objectType = 'chemical-structure';

      if (editTarget) {
        const objects = canvas.getObjects();
        const insertIndex = Math.max(objects.indexOf(editTarget), 0);
        canvas.remove(editTarget);
        canvas.insertAt(insertIndex, obj);
      } else {
        canvas.add(obj);
      }

      canvas.setActiveObject(obj);
      canvas.renderAll();
      setIsChemDrawOpen(false);
      setChemDrawInitialStructure(null);
      setEditingStructureObject(null);
    });
  };

  const openBlankChemDraw = () => {
    setChemDrawInitialStructure(null);
    setEditingStructureObject(null);
    setIsChemDrawOpen(true);
  };

  const openChemDrawWithPastedStructure = (text: string, format: ChemicalTextFormat) => {
    setEditingStructureObject(null);
    setChemDrawInitialStructure({
      cdxml: format === 'cdxml' ? text : undefined,
      molblock: format === 'mol' ? text : undefined,
      smiles: format === 'smiles' ? text : undefined,
    });
    setIsChemDrawOpen(true);
  };

  const openChemDrawForCanvasStructure = (obj: any) => {
    const data = getStructureData(obj);
    if (!data) return;

    setEditingStructureObject(obj);
    setChemDrawInitialStructure({
      cdxml: data.cdxml,
      molblock: data.molV2000 || data.molfile || data.molV3000,
      smiles: data.smiles,
    });
    setIsChemDrawOpen(true);
  };

  const removeCanvasObjects = (canvas: any, objects: any[]) => {
    canvas.discardActiveObject();
    canvas.remove(...objects);
    canvas.requestRenderAll();
    setSelectedStructureData(null);
  };

  const confirmDeleteCanvasObjects = (canvas: any, objects: any[], title: string) => {
    if (!canvas || objects.length === 0) return;

    modal.confirm({
      title,
      content: `${objects.length}개 객체가 캔버스에서 삭제됩니다.`,
      okText: '확인',
      cancelText: '취소',
      okButtonProps: { danger: true },
      onOk: () => removeCanvasObjects(canvas, objects),
    });
  };

  const confirmDeleteSelectedObjects = (canvas: any) => {
    const activeObjects = canvas?.getActiveObjects?.() || [];
    confirmDeleteCanvasObjects(canvas, activeObjects, '선택한 객체를 삭제할까요?');
  };

  const confirmClearCanvasObjects = (canvas: any) => {
    const allObjects = canvas?.getObjects?.() || [];
    confirmDeleteCanvasObjects(canvas, allObjects, '캔버스의 모든 객체를 삭제할까요?');
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasRef.current.parentElement?.clientWidth || 800,
      height: height,
      backgroundColor: token.colorBgLayout,
      preserveObjectStacking: true,
      targetFindTolerance: 4,
    });

    fabricCanvasRef.current = canvas;
    
    // Initial load
    loadCompoundsToCanvas(canvas);

    const syncSelection = () => {
      const activeObject = canvas.getActiveObject();
      setSelectedStructureData(getStructureData(activeObject));
    };
    const clearSelection = () => setSelectedStructureData(null);

    canvas.on('selection:created', syncSelection);
    canvas.on('selection:updated', syncSelection);
    canvas.on('selection:cleared', clearSelection);
    canvas.on('mouse:dblclick', (event: any) => {
      const target = event.target;
      if (!getStructureData(target)) return;

      canvas.setActiveObject(target);
      openChemDrawForCanvasStructure(target);
    });

    const handlePaste = async (e: ClipboardEvent) => {
      if (isChemDrawOpenRef.current) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      const plainText = e.clipboardData?.getData('text/plain') || '';
      const chemicalFormat = detectChemicalTextFormat(plainText);
      if (chemicalFormat) {
        e.preventDefault();
        openChemDrawWithPastedStructure(plainText, chemicalFormat);
        message.info('붙여넣은 구조를 ChemDraw에서 확인한 후 캔버스에 추가해 주세요.');
        return;
      }

      for (let i = 0; i < items.length; i++) {
        // Handle Images
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            addImageFileToCanvas(blob);
          }
        }
        // Handle Text
        else if (items[i].type.indexOf('text/plain') !== -1) {
          items[i].getAsString((text) => {
            const center = canvas.getVpCenter();

            if (text.length > 5000) {
              message.warning('긴 텍스트는 캔버스 텍스트로 붙여넣지 않았습니다.');
              return;
            }

            const fabricText = new fabric.IText(text, {
              left: center.x,
              top: center.y,
              fontSize: 20,
              fontFamily: 'Inter',
              fill: token.colorText,
              originX: 'center',
              originY: 'center',
            });
            canvas.add(fabricText);
            canvas.setActiveObject(fabricText);
            canvas.renderAll();
          });
        }
      }
    };

    window.addEventListener('paste', handlePaste);

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditableTarget = target?.closest('input, textarea, [contenteditable="true"]');
      const activeObject = canvas.getActiveObject();
      const data = getStructureData(activeObject);

      if (isEditableTarget) {
        return;
      }

      if (data && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        writeStructureToClipboard(data);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.repeat) return;
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length === 0) return;

        e.preventDefault();
        confirmDeleteCanvasObjects(canvas, activeObjects, '선택한 객체를 삭제할까요?');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const handleResize = () => {
      if (canvasRef.current?.parentElement) {
        canvas.setDimensions({
          width: canvasRef.current.parentElement.clientWidth,
          height: height,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      canvas.off('selection:created', syncSelection);
      canvas.off('selection:updated', syncSelection);
      canvas.off('selection:cleared', clearSelection);
      canvas.off('mouse:dblclick');
      canvas.dispose();
    };
  }, [height, token, compounds, searchedSvg]);

  // Tool functions
  const addRect = () => {
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      fill: token.colorPrimary,
      width: 100,
      height: 100,
      rx: 8,
      ry: 8,
    });
    fabricCanvasRef.current?.add(rect);
    fabricCanvasRef.current?.setActiveObject(rect);
  };

  const addCircle = () => {
    const circle = new fabric.Circle({
      left: 150,
      top: 150,
      fill: '#5856d6',
      radius: 50,
    });
    fabricCanvasRef.current?.add(circle);
    fabricCanvasRef.current?.setActiveObject(circle);
  };

  const addText = () => {
    const text = new fabric.IText('텍스트를 입력하세요', {
      left: 200,
      top: 200,
      fontSize: 20,
      fontFamily: 'Inter',
      fill: token.colorText,
    });
    fabricCanvasRef.current?.add(text);
    fabricCanvasRef.current?.setActiveObject(text);
  };

  const openImageFilePicker = () => {
    imageInputRef.current?.click();
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    addImageFileToCanvas(file);
  };

  const deleteSelected = () => {
    confirmDeleteSelectedObjects(fabricCanvasRef.current);
  };

  const clearCanvas = () => {
    confirmClearCanvasObjects(fabricCanvasRef.current);
  };

  const exportAsImage = () => {
    if (!fabricCanvasRef.current) return;
    const dataURL = fabricCanvasRef.current.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1,
    });
    const link = document.createElement('a');
    link.download = 'whiteboard-export.png';
    link.href = dataURL;
    link.click();
  };

  const copySelectedStructure = () => {
    if (!selectedStructureData) {
      message.warning('복사할 구조를 선택해 주세요.');
      return;
    }

    writeStructureToClipboard(selectedStructureData);
  };

  return (
    <Card 
      variant="borderless"
      styles={{ body: { padding: 0, overflow: 'hidden', position: 'relative' } }}
      style={{ 
        background: token.colorBgContainer, 
        borderRadius: 12, 
        border: `1px solid ${token.colorBorderSecondary}`
      }}
    >
      {/* Toolbar */}
      <div style={{ 
        padding: '8px 16px', 
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: isDarkMode(token) ? '#1f1f1f' : '#fff'
      }}>
        <Space split={<Divider type="vertical" />}>
          <Space>
            <Tooltip title="사각형 추가">
              <Button icon={<Square size={18} />} onClick={addRect} />
            </Tooltip>
            <Tooltip title="원 추가">
              <Button icon={<Circle size={18} />} onClick={addCircle} />
            </Tooltip>
            <Tooltip title="텍스트 추가">
              <Button icon={<Type size={18} />} onClick={addText} />
            </Tooltip>
          </Space>

          <Space>
            <Tooltip title="이미지 삽입">
              <Button icon={<ImageIcon size={18} />} onClick={openImageFilePicker} />
            </Tooltip>
            <Tooltip title="구조 추가 (ChemDraw)">
              <Button 
                icon={<BenzeneIcon size={18} />}
                onClick={openBlankChemDraw}
                style={{ color: token.colorPrimary }}
              />
            </Tooltip>
          </Space>
        </Space>

        <Space>
          <Tooltip title="선택 구조 데이터 복사">
            <Button
              icon={<ClipboardCopy size={18} />}
              onClick={copySelectedStructure}
              disabled={!selectedStructureData}
            />
          </Tooltip>
          <Tooltip title="선택 삭제">
            <Button danger icon={<Trash2 size={18} />} onClick={deleteSelected} />
          </Tooltip>
          <Tooltip title="전체 삭제">
            <Button danger type="dashed" icon={<Eraser size={18} />} onClick={clearCanvas} />
          </Tooltip>
          <Divider type="vertical" />
          <Tooltip title="이미지로 내보내기">
            <Button icon={<Download size={18} />} onClick={exportAsImage}>Export</Button>
          </Tooltip>
        </Space>
      </div>

      {/* Canvas Area */}
      <div style={{ position: 'relative', width: '100%', height: height }}>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageFileChange}
          style={{ display: 'none' }}
        />
        <canvas ref={canvasRef} />
      </div>

      <ChemDrawModal
        open={isChemDrawOpen}
        onCancel={() => {
          setIsChemDrawOpen(false);
          setChemDrawInitialStructure(null);
          setEditingStructureObject(null);
        }}
        onConfirm={addStructureToCanvas}
        title={editingStructureObject ? '화이트보드 구조 수정' : '화이트보드에 구조 추가'}
        confirmText={editingStructureObject ? '수정 적용' : '캔버스에 추가'}
        initialCdxml={chemDrawInitialStructure?.cdxml}
        initialMolblock={chemDrawInitialStructure?.molblock}
        initialSmiles={chemDrawInitialStructure?.smiles}
      />
    </Card>
  );
};

// Helper to check dark mode from token
function isDarkMode(token: any) {
  return token.colorBgContainer === '#1f1f1f' || token.colorBgContainer === '#141414';
}

export default WhiteboardEditor;
