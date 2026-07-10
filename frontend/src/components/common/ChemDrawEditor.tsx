import React from 'react';
import ChemDrawCanvasCore from './ChemDrawCanvasCore';

interface ChemDrawEditorProps {
  active: boolean;
  height?: number;
  initialCdxml?: string;
  initialSmiles?: string;
  initialMolblock?: string;
  smilesValue?: string;
  onSmilesChange?: (smiles: string) => void;
  onReady?: (editor: any) => void;
  flipControlsPlacement?: 'top' | 'left';
  showHelperText?: boolean;
}

const ChemDrawEditor: React.FC<ChemDrawEditorProps> = ({
  active,
  height = 500,
  initialCdxml,
  initialSmiles,
  initialMolblock,
  smilesValue,
  onSmilesChange,
  onReady,
  flipControlsPlacement = 'top',
  showHelperText = true,
}) => (
  <ChemDrawCanvasCore
    active={active}
    height={height}
    initialCdxml={initialCdxml}
    initialSmiles={initialSmiles}
    initialMolblock={initialMolblock}
    smilesValue={smilesValue}
    onSmilesChange={onSmilesChange}
    onReady={onReady}
    controlsPlacement={flipControlsPlacement}
    helperText={showHelperText ? 'ChemDraw editor에서 구조를 그린 뒤 등록을 진행하세요.' : undefined}
  />
);

export default ChemDrawEditor;
