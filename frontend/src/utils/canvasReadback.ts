let canvasContextPatchUsers = 0;
let restoreCanvasContextPatch: (() => void) | null = null;

export const installCanvasReadbackPatch = () => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  canvasContextPatchUsers += 1;
  if (!restoreCanvasContextPatch) {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.getContext = function patchedGetContext(
      this: HTMLCanvasElement,
      contextId: string,
      options?: any
    ) {
      if (contextId === '2d') {
        return originalGetContext.call(this, contextId, {
          ...(options || {}),
          willReadFrequently: true,
        });
      }

      return originalGetContext.call(this, contextId as any, options);
    } as typeof HTMLCanvasElement.prototype.getContext;

    restoreCanvasContextPatch = () => {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      restoreCanvasContextPatch = null;
    };
  }

  return () => {
    canvasContextPatchUsers = Math.max(0, canvasContextPatchUsers - 1);
    if (canvasContextPatchUsers === 0) {
      restoreCanvasContextPatch?.();
    }
  };
};
