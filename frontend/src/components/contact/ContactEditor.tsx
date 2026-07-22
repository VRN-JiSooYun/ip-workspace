import { App as AntApp, Button, Space, Typography } from 'antd';
import { ImagePlus } from 'lucide-react';
import Quill from 'quill';
import React from 'react';
import 'quill/dist/quill.snow.css';

type ContactEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  showImageAttachment?: boolean;
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const ContactEditor: React.FC<ContactEditorProps> = ({
  value,
  onChange,
  placeholder,
  showImageAttachment = true,
}) => {
  const { message } = AntApp.useApp();
  const editorHostRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<Quill | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
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
        toolbar: [
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link'],
          ['clean'],
        ],
        clipboard: { matchVisual: false },
      },
      formats: ['bold', 'italic', 'underline', 'list', 'bullet', 'link', 'image'],
    });

    const handleTextChange = () => {
      const html = editor.root.innerHTML;
      latestValueRef.current = html;
      onChangeRef.current?.(html);
    };

    editorRef.current = editor;
    editor.root.innerHTML = latestValueRef.current;
    editor.on('text-change', handleTextChange);

    return () => {
      editor.off('text-change', handleTextChange);
      editorRef.current = null;
    };
  }, [placeholder]);

  React.useEffect(() => {
    const editor = editorRef.current;
    const nextValue = value || '';
    latestValueRef.current = nextValue;
    if (!editor || editor.root.innerHTML === nextValue) return;
    editor.root.innerHTML = nextValue;
  }, [value]);

  const insertImages = React.useCallback(async (files: File[]) => {
    const editor = editorRef.current;
    if (!editor || files.length === 0) return;

    const validFiles = files.filter((file) => {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        void message.warning(`${file.name}: PNG, JPG, GIF, WEBP 이미지만 첨부할 수 있습니다.`);
        return false;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        void message.warning(`${file.name}: 이미지 크기는 5MB 이하여야 합니다.`);
        return false;
      }
      return true;
    });

    let index = editor.getSelection(true)?.index ?? editor.getLength();
    for (const file of validFiles) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        editor.insertEmbed(index, 'image', dataUrl, 'user');
        index += 1;
        editor.insertText(index, '\n', 'user');
        index += 1;
      } catch {
        void message.error(`${file.name}: 이미지를 읽지 못했습니다.`);
      }
    }
    editor.setSelection(index, 0, 'silent');
  }, [message]);

  const handlePasteCapture = React.useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (imageFiles.length === 0) return;

    event.preventDefault();
    event.stopPropagation();
    void insertImages(imageFiles);
  }, [insertImages]);

  return (
    <div className="contact-editor" onPasteCapture={handlePasteCapture}>
      <div ref={editorHostRef} />
      {showImageAttachment ? (
        <div className="contact-editor-footer">
          <Space size={8}>
            <Button
              size="small"
              icon={<ImagePlus size={14} />}
              onClick={() => fileInputRef.current?.click()}
            >
              이미지 첨부
            </Button>
            <Typography.Text type="secondary">PNG, JPG, GIF, WEBP · 파일당 5MB 이하</Typography.Text>
          </Space>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            multiple
            hidden
            onChange={(event) => {
              void insertImages(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

export default ContactEditor;
