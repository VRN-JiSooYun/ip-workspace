const shouldSuppressConsoleMessage = (args: any[]) => {
  const message = args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.message;
      return '';
    })
    .join(' ');

  return [
    'geo3D exists',
    'exists.',
    'Cannot use an `aborted` signal.',
    'JBig2CCITTFaxImage#instantiateWasm',
    'JBig2CCITTFaxImage#getJsModule',
    'JBig2 failed to initialize',
    'Unable to decode image',
    'Dependent image isn\'t ready yet',
    'wasmUrl API parameter is provided',
    'jbig2_nowasm_fallback.js',
    'The return value does not contain any draft, please use \'rawReturn()\' to wrap the return value to improve performance.',
    'performance warning: READ-usage buffer was read back without waiting on a fence.',
    'GL_INVALID_VALUE: glMapBufferRange: Mapped range does not fit into buffer dimensions.',
    'Added non-passive event listener to a scroll-blocking \'wheel\' event.',
  ].some((pattern) => message.includes(pattern));
};

const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (shouldSuppressConsoleMessage(args)) {
    return;
  }
  originalConsoleError(...args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  if (shouldSuppressConsoleMessage(args)) {
    return;
  }
  originalConsoleWarn(...args);
};
