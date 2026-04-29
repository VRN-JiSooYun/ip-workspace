import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { Button, Space, Card, Tooltip, Divider, theme } from 'antd';
import { 
  Square, Circle, Type, MousePointer2, Trash2, 
  Image as ImageIcon, Download, Eraser, Move, FlaskConical
} from 'lucide-react';
import ChemDrawModal from '../common/ChemDrawModal';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [activeTool, setActiveTool] = useState<string>('select');
  const [isChemDrawOpen, setIsChemDrawOpen] = useState(false);

  // SVG loading logic
  const loadCompoundsToCanvas = async (canvas: fabric.Canvas) => {
    canvas.clear();
    canvas.backgroundColor = token.colorBgLayout;

    let currentX = 50;
    let currentY = 50;
    const spacing = 180;
    const itemsPerRow = 4;
    let count = 0;

    // Helper to load individual SVG
    const loadSvg = (svgString: string, label: string) => {
      return fabric.loadSVGFromString(svgString).then((result) => {
        const { objects, options } = result;
        const obj = fabric.util.groupSVGElements(objects, options);
        
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

  const addStructureToCanvas = (data: { smiles: string; svg: string | null }) => {
    if (!data.svg || !fabricCanvasRef.current) {
      setIsChemDrawOpen(false);
      return;
    }

    fabric.loadSVGFromString(data.svg).then((result) => {
      const { objects, options } = result;
      const obj = fabric.util.groupSVGElements(objects, options);
      
      const scale = 150 / Math.max(obj.width || 1, obj.height || 1);
      obj.set({
        scaleX: scale,
        scaleY: scale,
        left: 200,
        top: 200,
      });

      fabricCanvasRef.current?.add(obj);
      fabricCanvasRef.current?.setActiveObject(obj);
      fabricCanvasRef.current?.renderAll();
      setIsChemDrawOpen(false);
    });
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasRef.current.parentElement?.clientWidth || 800,
      height: height,
      backgroundColor: token.colorBgLayout,
      preserveObjectStacking: true,
    });

    fabricCanvasRef.current = canvas;
    
    // Initial load
    loadCompoundsToCanvas(canvas);

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
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, [height, token.colorBgLayout, compounds, searchedSvg]);

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

  const deleteSelected = () => {
    const activeObjects = fabricCanvasRef.current?.getActiveObjects();
    if (activeObjects) {
      fabricCanvasRef.current?.discardActiveObject();
      fabricCanvasRef.current?.remove(...activeObjects);
    }
  };

  const clearCanvas = () => {
    fabricCanvasRef.current?.clear();
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.backgroundColor = token.colorBgLayout;
    }
  };

  const exportAsImage = () => {
    if (!fabricCanvasRef.current) return;
    const dataURL = fabricCanvasRef.current.toDataURL({
      format: 'png',
      quality: 1,
    });
    const link = document.createElement('a');
    link.download = 'whiteboard-export.png';
    link.href = dataURL;
    link.click();
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
            <Tooltip title="선택 모드">
              <Button 
                type={activeTool === 'select' ? 'primary' : 'text'}
                icon={<MousePointer2 size={18} />} 
                onClick={() => setActiveTool('select')}
              />
            </Tooltip>
            <Tooltip title="이동 모드">
              <Button 
                type={activeTool === 'move' ? 'primary' : 'text'}
                icon={<Move size={18} />} 
                onClick={() => setActiveTool('move')}
              />
            </Tooltip>
          </Space>
          
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
              <Button icon={<ImageIcon size={18} />} disabled />
            </Tooltip>
            <Tooltip title="구조 추가 (ChemDraw)">
              <Button 
                icon={<FlaskConical size={18} />} 
                onClick={() => setIsChemDrawOpen(true)}
                style={{ color: token.colorPrimary }}
              />
            </Tooltip>
          </Space>
        </Space>

        <Space>
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
        <canvas ref={canvasRef} />
      </div>

      <ChemDrawModal
        open={isChemDrawOpen}
        onCancel={() => setIsChemDrawOpen(false)}
        onConfirm={addStructureToCanvas}
        title="화이트보드에 구조 추가"
        confirmText="캔버스에 추가"
      />
    </Card>
  );
};

// Helper to check dark mode from token
function isDarkMode(token: any) {
  return token.colorBgContainer === '#1f1f1f' || token.colorBgContainer === '#141414';
}

export default WhiteboardEditor;
