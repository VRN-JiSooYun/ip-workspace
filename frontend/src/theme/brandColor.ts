import { useSyncExternalStore } from 'react';

/**
 * Single source of truth for the workspace brand (primary) color.
 *
 * Two kinds of consumer read from here and must never drift apart:
 *
 * 1. CSS — `index.css`, the page-level `*.css` files, and the template-literal
 *    `<style>` blocks inside components all reference the `--brand-primary` /
 *    `--brand-primary-rgb` custom properties that `applyBrandPrimary` writes
 *    onto the document root.
 *
 * 2. TSX that needs a *real* color value — antd's `ConfigProvider` (it parses
 *    the hex to derive its own palette), SVG presentation attributes such as
 *    `fill` and `stroke`, and canvas-backed chart libraries. `var()` does not
 *    resolve in any of those positions, so these read the hex through
 *    `useBrandPrimary()` (inside components) or `getBrandPrimary()` (in plain
 *    functions).
 *
 * To change the brand color permanently, edit `DEFAULT_BRAND_PRIMARY` — nothing
 * else in the codebase hardcodes it.
 */
export const DEFAULT_BRAND_PRIMARY = '#7C5CFC';

/**
 * Only honoured in dev builds, so a color left over from an experiment in the
 * picker panel can never leak into a production bundle.
 */
const STORAGE_KEY = 'ip-workspace:brand-primary';

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const isValidBrandPrimary = (value: unknown): value is string =>
  typeof value === 'string' && HEX_PATTERN.test(value.trim());

const readInitial = (): string => {
  if (!import.meta.env.DEV || typeof localStorage === 'undefined') {
    return DEFAULT_BRAND_PRIMARY;
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  return isValidBrandPrimary(saved) ? saved.trim().toUpperCase() : DEFAULT_BRAND_PRIMARY;
};

let currentPrimary = readInitial();

const listeners = new Set<() => void>();

/** `"248, 124, 99"` — the form `rgba(var(--brand-primary-rgb), 0.12)` needs. */
export const hexToRgbTriplet = (hex: string): string => {
  const value = hex.trim().replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
};

const applyBrandPrimary = (hex: string): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', hex);
  root.style.setProperty('--brand-primary-rgb', hexToRgbTriplet(hex));
};

/** Call once before the first render so CSS never paints with a stale color. */
export const initBrandPrimary = (): void => applyBrandPrimary(currentPrimary);

export const getBrandPrimary = (): string => currentPrimary;

export const setBrandPrimary = (hex: string): void => {
  if (!isValidBrandPrimary(hex)) return;
  const next = hex.trim().toUpperCase();
  if (next === currentPrimary) return;

  currentPrimary = next;
  applyBrandPrimary(next);

  if (import.meta.env.DEV && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, next);
  }

  listeners.forEach((listener) => listener());
};

export const resetBrandPrimary = (): void => {
  setBrandPrimary(DEFAULT_BRAND_PRIMARY);
  // Clear *after* the set, which writes the value back, so that reset really
  // drops the override rather than pinning the default.
  if (import.meta.env.DEV && typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Subscribes the calling component to brand-color changes. Use this wherever a
 * literal color value is required instead of `var(--brand-primary)`.
 */
export const useBrandPrimary = (): string =>
  useSyncExternalStore(subscribe, getBrandPrimary, () => DEFAULT_BRAND_PRIMARY);

/**
 * Brand color at a given opacity, as a literal `rgba()` string. Prefer
 * `rgba(var(--brand-primary-rgb), <alpha>)` in CSS; this exists for the
 * positions where `var()` cannot be used.
 */
export const brandAlpha = (alpha: number): string =>
  `rgba(${hexToRgbTriplet(currentPrimary)}, ${alpha})`;
