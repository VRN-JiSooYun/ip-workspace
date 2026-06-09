let passiveWheelPatchUsers = 0;
let restorePassiveWheelPatch: (() => void) | null = null;

const withNonPassiveWheelOptions = (options?: boolean | AddEventListenerOptions) => {
  if (options == null) {
    return { passive: false };
  }

  if (typeof options === 'boolean') {
    return { capture: options, passive: false };
  }

  if ('passive' in options) {
    return {
      ...options,
      passive: false,
    };
  }

  return {
    ...options,
    passive: false,
  };
};

export const installPassiveWheelListenerPatch = () => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  passiveWheelPatchUsers += 1;
  if (!restorePassiveWheelPatch) {
    const originalAddEventListener = EventTarget.prototype.addEventListener;

    EventTarget.prototype.addEventListener = function patchedAddEventListener(
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ) {
      return originalAddEventListener.call(
        this,
        type,
        listener,
        type === 'wheel' ? withNonPassiveWheelOptions(options) : options
      );
    } as typeof EventTarget.prototype.addEventListener;

    restorePassiveWheelPatch = () => {
      EventTarget.prototype.addEventListener = originalAddEventListener;
      restorePassiveWheelPatch = null;
    };
  }

  return () => {
    passiveWheelPatchUsers = Math.max(0, passiveWheelPatchUsers - 1);
    if (passiveWheelPatchUsers === 0) {
      restorePassiveWheelPatch?.();
    }
  };
};
