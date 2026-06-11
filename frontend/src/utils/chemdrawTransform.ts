export type ChemDrawFlipAxis = 'horizontal' | 'vertical';

const FLIP_METHODS: Record<ChemDrawFlipAxis, string[]> = {
  horizontal: [
    'flipHorizontal',
    'flipHorizontally',
    'mirrorHorizontal',
    'mirrorHorizontally',
    'horizontalFlip',
    'flipX',
    'mirrorX',
  ],
  vertical: [
    'flipVertical',
    'flipVertically',
    'mirrorVertical',
    'mirrorVertically',
    'verticalFlip',
    'flipY',
    'mirrorY',
  ],
};

const FLIP_COMMAND_NAMES: Record<ChemDrawFlipAxis, string[]> = {
  horizontal: [
    'flipHorizontal',
    'FlipHorizontal',
    'mirrorHorizontal',
    'MirrorHorizontal',
    'horizontalFlip',
    'HorizontalFlip',
    'object.flipHorizontal',
  ],
  vertical: [
    'flipVertical',
    'FlipVertical',
    'mirrorVertical',
    'MirrorVertical',
    'verticalFlip',
    'VerticalFlip',
    'object.flipVertical',
  ],
};

const AXIS_COMMAND_PATTERNS: Record<ChemDrawFlipAxis, RegExp[]> = {
  horizontal: [
    /flip.*horizontal/i,
    /horizontal.*flip/i,
    /mirror.*horizontal/i,
    /horizontal.*mirror/i,
    /flip.*x/i,
    /mirror.*x/i,
  ],
  vertical: [
    /flip.*vertical/i,
    /vertical.*flip/i,
    /mirror.*vertical/i,
    /vertical.*mirror/i,
    /flip.*y/i,
    /mirror.*y/i,
  ],
};

const toCommandNameArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (value && typeof value === 'object' && typeof (value as any).size === 'function' && typeof (value as any).get === 'function') {
    const size = Number((value as any).size());
    if (!Number.isFinite(size)) return [];
    return Array.from({ length: size }, (_, index) => (value as any).get(index))
      .filter((item): item is string => typeof item === 'string');
  }

  return [];
};

const executeCommand = (command: any): boolean => {
  if (!command) return false;

  for (const methodName of ['execute', 'doExecute', 'run', 'invoke']) {
    const method = command[methodName];
    if (typeof method !== 'function') continue;

    try {
      const result = method.call(command);
      return result !== false;
    } catch {
      // Try the next command execution shape.
    }
  }

  return false;
};

const applyCommandByName = (editor: any, commandName: string, allowDispatcherFallback = false): boolean => {
  if (typeof editor.getCommandWithName === 'function') {
    try {
      if (executeCommand(editor.getCommandWithName(commandName))) return true;
    } catch {
      // Try command dispatcher fallback.
    }
  }

  if (!allowDispatcherFallback) return false;

  for (const methodName of ['execute', 'execCommand', 'doCommand', 'runCommand', 'command', 'invoke']) {
    const method = editor[methodName];
    if (typeof method !== 'function') continue;

    try {
      const result = method.call(editor, commandName);
      if (result !== false) return true;
    } catch {
      // Try the next dispatcher.
    }
  }

  return false;
};

// 축 기준 180° 회전 전용 method/command 후보. (ChemDraw JS가 노출하는 경우 우선 사용)
const ROTATE180_METHODS: Record<ChemDrawFlipAxis, string[]> = {
  horizontal: ['rotate180Horizontal', 'rotateHorizontal180', 'horizontalRotate180'],
  vertical: ['rotate180Vertical', 'rotateVertical180', 'verticalRotate180'],
};

const ROTATE180_COMMAND_NAMES: Record<ChemDrawFlipAxis, string[]> = {
  horizontal: [
    'rotate180Horizontal',
    'Rotate180Horizontal',
    'horizontalRotate180',
    'object.rotate180Horizontal',
  ],
  vertical: [
    'rotate180Vertical',
    'Rotate180Vertical',
    'verticalRotate180',
    'object.rotate180Vertical',
  ],
};

export const applyChemDrawFlip = (editor: any, axis: ChemDrawFlipAxis): boolean => {
  if (!editor) return false;

  for (const methodName of FLIP_METHODS[axis]) {
    const method = editor[methodName];
    if (typeof method !== 'function') continue;

    try {
      const result = method.call(editor);
      return result !== false;
    } catch {
      // Try the next known method name.
    }
  }

  const availableCommandNames = toCommandNameArray(
    typeof editor.getAvailableCommandNames === 'function'
      ? editor.getAvailableCommandNames()
      : [],
  );
  const matchingCommandNames = availableCommandNames.filter((name) =>
    AXIS_COMMAND_PATTERNS[axis].some((pattern) => pattern.test(name)),
  );

  for (const commandName of matchingCommandNames) {
    if (applyCommandByName(editor, commandName, true)) return true;
  }

  for (const commandName of FLIP_COMMAND_NAMES[axis]) {
    if (applyCommandByName(editor, commandName)) return true;
  }

  return false;
};

/**
 * 선택 구조를 해당 축 기준으로 180° 회전한다.
 * ChemDraw JS가 회전 전용 method/command를 노출하면 그것을 우선 사용하고,
 * 없으면 flip으로 폴백한다. (축 기준 180° 회전은 시각적으로 해당 축 flip과 동일)
 */
export const applyChemDrawRotate180 = (editor: any, axis: ChemDrawFlipAxis): boolean => {
  if (!editor) return false;

  for (const methodName of ROTATE180_METHODS[axis]) {
    const method = editor[methodName];
    if (typeof method !== 'function') continue;
    try {
      const result = method.call(editor);
      return result !== false;
    } catch {
      // Try the next known method name.
    }
  }

  for (const commandName of ROTATE180_COMMAND_NAMES[axis]) {
    if (applyCommandByName(editor, commandName, true)) return true;
  }

  // 폴백: 축 기준 180° 회전은 해당 축 flip과 시각적으로 동일하다.
  return applyChemDrawFlip(editor, axis);
};
