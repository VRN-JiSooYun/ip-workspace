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
