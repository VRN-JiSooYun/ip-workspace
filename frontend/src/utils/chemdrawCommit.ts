const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export interface ChemDrawCommitOptions {
  activateSelectionTool?: boolean;
}

const LASSO_TOOL_NAMES = [
  'lasso',
  'Lasso',
  'LASSO',
  'select',
  'Select',
  'SELECT',
  'selection',
  'Selection',
  'selectTool',
  'SelectTool',
  'lassoTool',
  'LassoTool',
  'tool.lasso',
  'tools.lasso',
  'tool.select',
  'tools.select',
  'toolbar.lasso',
  'toolbar.select',
];

const LASSO_METHOD_NAMES = [
  'setTool',
  'selectTool',
  'setActiveTool',
  'activateTool',
  'setCurrentTool',
  'chooseTool',
  'setMode',
  'setActiveMode',
];

const LASSO_DIRECT_METHOD_NAMES = [
  'lasso',
  'select',
  'activateLasso',
  'selectLasso',
  'setLassoTool',
  'setSelectionTool',
  'activateSelectionTool',
];

const LASSO_COMMAND_NAMES = [
  'lasso',
  'Lasso',
  'select',
  'Select',
  'selection',
  'Selection',
  'LassoTool',
  'SelectTool',
  'tool.lasso',
  'tools.lasso',
  'tool.select',
  'tools.select',
  'toolbar.lasso',
  'toolbar.select',
];

const executeChemDrawCommand = (command: any): boolean => {
  if (!command) return false;

  for (const methodName of ['execute', 'doExecute', 'run', 'invoke']) {
    const method = command[methodName];
    if (typeof method !== 'function') continue;

    try {
      const result = method.call(command);
      if (result !== false) return true;
    } catch {
      // Try the next command execution shape.
    }
  }

  return false;
};

const runChemDrawCommand = (editor: any, commandName: string): boolean => {
  if (!editor) return false;

  if (typeof editor.getCommandWithName === 'function') {
    try {
      if (executeChemDrawCommand(editor.getCommandWithName(commandName))) return true;
    } catch {
      // Try dispatcher shapes.
    }
  }

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

const getAvailableCommandNames = (editor: any): string[] => {
  if (!editor || typeof editor.getAvailableCommandNames !== 'function') return [];

  try {
    const commandNames = editor.getAvailableCommandNames();
    if (Array.isArray(commandNames)) {
      return commandNames.filter((name): name is string => typeof name === 'string');
    }

    if (
      commandNames &&
      typeof commandNames === 'object' &&
      typeof commandNames.size === 'function' &&
      typeof commandNames.get === 'function'
    ) {
      const size = Number(commandNames.size());
      if (!Number.isFinite(size)) return [];
      return Array.from({ length: size }, (_, index) => commandNames.get(index))
        .filter((name): name is string => typeof name === 'string');
    }
  } catch {
    return [];
  }

  return [];
};

const activateChemDrawLassoTool = (editor?: any) => {
  if (!editor) return false;

  for (const methodName of LASSO_METHOD_NAMES) {
    const method = editor[methodName];
    if (typeof method !== 'function') continue;

    for (const toolName of LASSO_TOOL_NAMES) {
      try {
        const result = method.call(editor, toolName);
        if (result !== false) return true;
      } catch {
        // Try the next tool name.
      }

      try {
        const result = method.call(editor, { name: toolName, id: toolName });
        if (result !== false) return true;
      } catch {
        // Try the next tool shape.
      }
    }
  }

  for (const methodName of LASSO_DIRECT_METHOD_NAMES) {
    const method = editor[methodName];
    if (typeof method !== 'function') continue;

    try {
      const result = method.call(editor);
      if (result !== false) return true;
    } catch {
      // Try the next direct method.
    }
  }

  const matchingCommandNames = getAvailableCommandNames(editor).filter((commandName) =>
    /lasso|select|selection/i.test(commandName),
  );

  for (const commandName of matchingCommandNames) {
    if (runChemDrawCommand(editor, commandName)) return true;
  }

  for (const commandName of LASSO_COMMAND_NAMES) {
    if (runChemDrawCommand(editor, commandName)) return true;
  }

  return false;
};

const clickLassoToolbarButton = (container: HTMLElement) => {
  const controls = Array.from(
    container.querySelectorAll<HTMLElement>('button, [role="button"], [aria-label], [title], [data-testid], [data-command], [data-tool]'),
  );

  const control = controls.find((element) => {
    const label = [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('data-testid'),
      element.getAttribute('data-command'),
      element.getAttribute('data-tool'),
      element.textContent,
    ].join(' ');

    return /lasso|select|selection|선택/i.test(label);
  });

  if (!control) return false;

  ['mousedown', 'mouseup', 'click'].forEach((eventName) => {
    control.dispatchEvent(new MouseEvent(eventName, { bubbles: true, cancelable: true }));
  });

  return true;
};

const dispatchEnter = (target: EventTarget) => {
  const eventInit: KeyboardEventInit = {
    key: 'Enter',
    code: 'Enter',
    bubbles: true,
    cancelable: true,
  };

  target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
  target.dispatchEvent(new KeyboardEvent('keypress', eventInit));
  target.dispatchEvent(new KeyboardEvent('keyup', eventInit));
};

const dispatchChange = (target: EventTarget) => {
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
};

const blurElement = (target: EventTarget) => {
  if ('blur' in target && typeof target.blur === 'function') {
    target.blur();
  }
};

const collectIframeTargets = (iframe: HTMLIFrameElement, targets: Set<EventTarget>) => {
  try {
    const iframeWindow = iframe.contentWindow;
    const iframeDocument = iframe.contentDocument || iframeWindow?.document;
    if (!iframeWindow || !iframeDocument) return;

    if (iframeDocument.activeElement) targets.add(iframeDocument.activeElement);
    if (iframeDocument.body) targets.add(iframeDocument.body);
  } catch {
    // Cross-origin or unavailable iframe. Ignore and use outer targets.
  }
};

export const waitForChemDrawEditorReady = async (containerId: string, editor?: any) => {
  await wait(900);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const container = document.getElementById(containerId);
    const hasEditorSurface = Boolean(
      container?.querySelector('canvas, iframe, svg, button, [role="button"], [data-command], [data-tool]'),
    );
    const hasReadApi = Boolean(editor?.getData || editor?.getSMILES || editor?.getCDXML);

    if (hasEditorSurface && hasReadApi) return true;

    await wait(150);
  }

  return false;
};

export const commitChemDrawActiveInput = async (
  containerId: string,
  editor?: any,
  options?: ChemDrawCommitOptions,
) => {
  const container = document.getElementById(containerId);
  if (!container) return;

  const targets = new Set<EventTarget>([container]);
  const activeElement = document.activeElement;

  if (activeElement && container.contains(activeElement)) {
    targets.add(activeElement);
    if (activeElement instanceof HTMLIFrameElement) {
      collectIframeTargets(activeElement, targets);
    }
  }

  container.querySelectorAll('iframe').forEach((iframe) => {
    collectIframeTargets(iframe, targets);
  });

  targets.forEach((target) => {
    dispatchEnter(target);
    dispatchChange(target);
    blurElement(target);
  });

  await wait(80);

  const shouldActivateSelectionTool = options?.activateSelectionTool !== false;
  const didActivateLassoTool = shouldActivateSelectionTool && activateChemDrawLassoTool(editor);
  const didClickLassoButton = shouldActivateSelectionTool && clickLassoToolbarButton(container);

  if (didActivateLassoTool || didClickLassoButton) {
    await wait(180);
  }

  targets.forEach((target) => {
    dispatchChange(target);
    blurElement(target);
  });

  await wait(shouldActivateSelectionTool ? 180 : 20);
};
