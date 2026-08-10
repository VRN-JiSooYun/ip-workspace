import React, { useState } from 'react';
import {
  DEFAULT_BRAND_PRIMARY,
  getBrandPrimary,
  isValidBrandPrimary,
  resetBrandPrimary,
  setBrandPrimary,
  useBrandPrimary,
} from './brandColor';

/**
 * Dev-only floating panel for trying out brand colors against the real UI.
 *
 * Render it behind an `import.meta.env.DEV` guard so it is dead-code-eliminated
 * from production bundles.
 *
 * The panel's own chrome is deliberately hardcoded to neutral grays rather than
 * `var(--brand-primary)`. If it re-themed itself, picking a low-contrast color
 * would make the panel unreadable and you could not pick your way back out.
 */

type Preset = { name: string; hex: string };

const PRESETS: Preset[] = [
  { name: 'Coral (원본)', hex: '#FFC000' },
  { name: 'Indigo', hex: '#5B6ABF' },
  { name: 'Royal Blue', hex: '#2F6FED' },
  { name: 'Cyan', hex: '#0891B2' },
  { name: 'Teal', hex: '#0E9C8A' },
  { name: 'Emerald', hex: '#10A37F' },
  { name: 'Violet', hex: '#7C5CFC' },
  { name: 'Plum', hex: '#9B4F96' },
  { name: 'Crimson', hex: '#D6455D' },
  { name: 'Amber', hex: '#E8912D' },
  { name: 'Slate', hex: '#546A85' },
  { name: 'Forest', hex: '#3F7D4F' },
];

/** Surfaces the brand color sits on as text/border in this app. */
const LIGHT_SURFACE = '#FFFFFF';
const DARK_SURFACE = '#141414';

const srgbToLinear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = (hex: string): number => {
  const v = hex.replace('#', '');
  const r = srgbToLinear(parseInt(v.slice(0, 2), 16));
  const g = srgbToLinear(parseInt(v.slice(2, 4), 16));
  const b = srgbToLinear(parseInt(v.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
};

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  zIndex: 2147483000,
  width: 268,
  padding: 12,
  borderRadius: 12,
  background: '#1c1f23',
  border: '1px solid #3a4048',
  boxShadow: '0 8px 28px rgba(0, 0, 0, 0.45)',
  color: '#e6e8eb',
  font: "500 12px/1.4 'Inter', -apple-system, sans-serif",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: 28,
  padding: '0 8px',
  borderRadius: 6,
  border: '1px solid #3a4048',
  background: '#12151a',
  color: '#e6e8eb',
  font: "500 12px/1 'Inter', monospace",
};

const buttonStyle: React.CSSProperties = {
  height: 28,
  padding: '0 10px',
  borderRadius: 6,
  border: '1px solid #3a4048',
  background: '#2a2f36',
  color: '#e6e8eb',
  cursor: 'pointer',
  font: "600 11px/1 'Inter', sans-serif",
};

const ContrastRow: React.FC<{ label: string; ratio: number }> = ({ label, ratio }) => {
  // 4.5:1 is the WCAG AA threshold for normal text; 3:1 for large text and UI
  // borders. The brand color is used for both in this app.
  const verdict = ratio >= 4.5 ? 'AA' : ratio >= 3 ? '3:1만' : '미달';
  const color = ratio >= 4.5 ? '#6ee7a8' : ratio >= 3 ? '#f5c451' : '#f78b8b';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: '#9aa4b0' }}>{label}</span>
      <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>
        {ratio.toFixed(2)}:1 · {verdict}
      </span>
    </div>
  );
};

const BrandColorDevPanel: React.FC = () => {
  const primary = useBrandPrimary();
  const [draft, setDraft] = useState(primary);
  const [collapsed, setCollapsed] = useState(true);

  // Keep the text field in step when the color changes from a swatch or reset.
  const [lastSynced, setLastSynced] = useState(primary);
  if (lastSynced !== primary) {
    setLastSynced(primary);
    setDraft(primary);
  }

  const commitDraft = (value: string) => {
    setDraft(value);
    if (isValidBrandPrimary(value)) setBrandPrimary(value);
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="브랜드 색상 패널 열기"
        style={{
          ...panelStyle,
          width: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          cursor: 'pointer',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 14,
            height: 14,
            borderRadius: 4,
            background: primary,
            border: '1px solid #3a4048',
          }}
        />
        <span style={{ font: "600 11px/1 'Inter', sans-serif" }}>{primary}</span>
      </button>
    );
  }

  return (
    <section style={panelStyle} aria-label="브랜드 색상 실험 패널">
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <strong style={{ font: "700 12px/1 'Inter', sans-serif" }}>Brand color</strong>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="패널 접기"
          style={{ ...buttonStyle, padding: '0 8px' }}
        >
          －
        </button>
      </header>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          type="color"
          aria-label="브랜드 색상 선택"
          value={primary}
          onChange={(event) => commitDraft(event.target.value.toUpperCase())}
          style={{
            width: 34,
            height: 28,
            padding: 0,
            border: '1px solid #3a4048',
            borderRadius: 6,
            background: 'transparent',
            cursor: 'pointer',
          }}
        />
        <input
          type="text"
          aria-label="브랜드 색상 hex 값"
          spellCheck={false}
          value={draft}
          onChange={(event) => commitDraft(event.target.value.toUpperCase())}
          placeholder="#RRGGBB"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={resetBrandPrimary}
          title={`기본값 ${DEFAULT_BRAND_PRIMARY} 으로 되돌리기`}
          style={buttonStyle}
        >
          Reset
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 5,
          marginBottom: 10,
        }}
      >
        {PRESETS.map((preset) => {
          const active = preset.hex.toUpperCase() === primary.toUpperCase();
          return (
            <button
              key={preset.hex}
              type="button"
              onClick={() => setBrandPrimary(preset.hex)}
              title={`${preset.name} · ${preset.hex}`}
              aria-label={`${preset.name} 적용`}
              aria-pressed={active}
              style={{
                height: 26,
                borderRadius: 5,
                background: preset.hex,
                border: active ? '2px solid #ffffff' : '1px solid #3a4048',
                cursor: 'pointer',
              }}
            />
          );
        })}
      </div>

      <div style={{ display: 'grid', gap: 3, marginBottom: 10 }}>
        <ContrastRow label="흰 배경 대비" ratio={contrastRatio(primary, LIGHT_SURFACE)} />
        <ContrastRow label="다크 배경 대비" ratio={contrastRatio(primary, DARK_SURFACE)} />
      </div>

      <p style={{ margin: 0, color: '#7f8894', font: "500 10px/1.5 'Inter', sans-serif" }}>
        확정된 색은 <code style={{ color: '#9aa4b0' }}>theme/brandColor.ts</code> 의{' '}
        <code style={{ color: '#9aa4b0' }}>DEFAULT_BRAND_PRIMARY</code> 와{' '}
        <code style={{ color: '#9aa4b0' }}>index.css</code> 의 fallback 두 곳에 반영하세요.
        현재 값 <code style={{ color: '#9aa4b0' }}>{getBrandPrimary()}</code> 은 dev
        localStorage 에만 저장됩니다.
      </p>
    </section>
  );
};

export default BrandColorDevPanel;
