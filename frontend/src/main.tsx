import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from './contexts/ThemeContext';
import App from './App';
import './index.css';

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
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
