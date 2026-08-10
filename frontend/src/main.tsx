import './suppressWarnings';
import { installCanvasReadbackPatch } from './utils/canvasReadback';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from './contexts/ThemeContext';
import App from './App';
import './index.css';
import { initBrandPrimary } from './theme/brandColor';
import 'echarts-gl'; // Import globally once to prevent component registration warnings

installCanvasReadbackPatch();
// Publish --brand-primary before the first render so nothing paints with the
// stale fallback baked into index.css.
initBrandPrimary();

const roots = new Map<Element, any>();
const originalCreateRoot = ReactDOM.createRoot;

// ReactDOM.createRoot 전역 패치
(ReactDOM as any).createRoot = (container: Element, options?: any) => {
  if (roots.has(container)) {
    return roots.get(container);
  }
  const root = originalCreateRoot(container, options);
  roots.set(container, root);
  return root;
};

const rootElement = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
