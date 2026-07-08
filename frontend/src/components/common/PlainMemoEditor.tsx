import React from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

interface PlainMemoEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const getEditorHtml = (editor: Quill) => editor.root.innerHTML;

const PlainMemoEditor: React.FC<PlainMemoEditorProps> = ({
  value,
  onChange,
  placeholder,
  className,
}) => {
  const editorHostRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<Quill | null>(null);
  const latestValueRef = React.useRef(value || '');
  const onChangeRef = React.useRef(onChange);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    const host = editorHostRef.current;
    if (!host || editorRef.current) return;

    const editor = new Quill(host, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar: false,
        clipboard: {
          matchVisual: false,
        },
      },
      formats: ['image'],
    });

    editorRef.current = editor;
    editor.root.innerHTML = latestValueRef.current;
    editor.on('text-change', () => {
      const html = getEditorHtml(editor);
      latestValueRef.current = html;
      onChangeRef.current?.(html);
    });
  }, [placeholder]);

  React.useEffect(() => {
    const editor = editorRef.current;
    const nextValue = value || '';
    latestValueRef.current = nextValue;
    if (!editor || getEditorHtml(editor) === nextValue) return;

    const selection = editor.getSelection();
    editor.root.innerHTML = nextValue;
    if (selection) {
      editor.setSelection(Math.min(selection.index, editor.getLength()), selection.length, 'silent');
    }
  }, [value]);

  const insertText = React.useCallback((text: string) => {
    const editor = editorRef.current;
    if (!editor) return 0;

    const range = editor.getSelection(true);
    const index = range?.index ?? editor.getLength();
    if (!text) return index;

    editor.insertText(index, text, 'user');
    editor.setSelection(index + text.length, 0, 'silent');
    return index + text.length;
  }, []);

  const insertImages = React.useCallback(async (files: File[], startIndex: number) => {
    const editor = editorRef.current;
    if (!editor || files.length === 0) return;

    let index = startIndex;
    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) continue;
      editor.insertEmbed(index, 'image', dataUrl, 'user');
      index += 1;
      editor.insertText(index, '\n', 'user');
      index += 1;
    }
    editor.setSelection(index, 0, 'silent');
  }, []);

  const handlePasteCapture = React.useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const clipboardData = event.clipboardData;
    const imageFiles = Array.from(clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    const plainText = clipboardData.getData('text/plain');

    if (!plainText && imageFiles.length === 0) return;

    event.preventDefault();
    event.stopPropagation();

    const nextIndex = insertText(plainText);
    void insertImages(imageFiles, nextIndex);
  }, [insertImages, insertText]);

  return (
    <div className={className} onPasteCapture={handlePasteCapture}>
      <div ref={editorHostRef} />
    </div>
  );
};

export default PlainMemoEditor;
