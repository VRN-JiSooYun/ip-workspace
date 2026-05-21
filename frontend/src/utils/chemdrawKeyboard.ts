const KOREAN_2BEOL_TO_LATIN: Record<string, string> = {
  'ㅂ': 'q',
  'ㅈ': 'w',
  'ㄷ': 'e',
  'ㄱ': 'r',
  'ㅅ': 't',
  'ㅛ': 'y',
  'ㅕ': 'u',
  'ㅑ': 'i',
  'ㅐ': 'o',
  'ㅔ': 'p',
  'ㅁ': 'a',
  'ㄴ': 's',
  'ㅇ': 'd',
  'ㄹ': 'f',
  'ㅎ': 'g',
  'ㅗ': 'h',
  'ㅓ': 'j',
  'ㅏ': 'k',
  'ㅣ': 'l',
  'ㅋ': 'z',
  'ㅌ': 'x',
  'ㅊ': 'c',
  'ㅍ': 'v',
  'ㅠ': 'b',
  'ㅜ': 'n',
  'ㅡ': 'm',
  'ㅃ': 'Q',
  'ㅉ': 'W',
  'ㄸ': 'E',
  'ㄲ': 'R',
  'ㅆ': 'T',
  'ㅒ': 'O',
  'ㅖ': 'P',
};

const getLatinKeyFromKoreanInput = (value: string | null | undefined) => {
  if (!value || value.length !== 1) return null;
  return KOREAN_2BEOL_TO_LATIN[value] ?? null;
};

const isEventInContainer = (event: Event, container: HTMLElement) => {
  const target = event.target;
  return target instanceof Node && container.contains(target);
};

const dispatchLatinKey = (target: EventTarget | null, key: string) => {
  const eventTarget = target instanceof HTMLElement ? target : document.activeElement;
  if (!eventTarget) return;

  const upperKey = key.toUpperCase();
  const code = `Key${upperKey}`;
  const eventInit: KeyboardEventInit = {
    key,
    code,
    bubbles: true,
    cancelable: true,
    composed: true,
  };

  eventTarget.dispatchEvent(new KeyboardEvent('keydown', eventInit));
  eventTarget.dispatchEvent(new KeyboardEvent('keypress', eventInit));
  eventTarget.dispatchEvent(new KeyboardEvent('keyup', eventInit));
};

export const installChemDrawKoreanKeyboardBridge = (container: HTMLElement) => {
  let isDispatchingSyntheticKey = false;

  const dispatchMappedKey = (event: Event, rawValue: string | null | undefined) => {
    if (isDispatchingSyntheticKey || !isEventInContainer(event, container)) return;

    const latinKey = getLatinKeyFromKoreanInput(rawValue);
    if (!latinKey) return;

    event.preventDefault();
    event.stopPropagation();

    isDispatchingSyntheticKey = true;
    dispatchLatinKey(event.target, latinKey);
    isDispatchingSyntheticKey = false;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    dispatchMappedKey(event, event.key);
  };

  const handleBeforeInput = (event: Event) => {
    dispatchMappedKey(event, event instanceof InputEvent ? event.data : null);
  };

  const handleCompositionEnd = (event: Event) => {
    dispatchMappedKey(event, event instanceof CompositionEvent ? event.data : null);
  };

  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('beforeinput', handleBeforeInput, true);
  window.addEventListener('compositionend', handleCompositionEnd, true);

  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('beforeinput', handleBeforeInput, true);
    window.removeEventListener('compositionend', handleCompositionEnd, true);
  };
};
