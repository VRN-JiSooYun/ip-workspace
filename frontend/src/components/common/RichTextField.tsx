import React from 'react';
import { Button, Typography } from 'antd';
import { ImagePlus, Loader2 } from 'lucide-react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { hasRichContent, sanitizeRichHtml } from '../../utils/richText';
import './RichTextField.css';

const { Text } = Typography;

/**
 * JIRA의 '설명'과 같은 필드 — 평소에는 읽는 글이고, 누르면 편집기가 열리고,
 * **[저장]을 눌러야** 나간다.
 *
 * 왜 자동 저장이 아닌가. 이 화면의 다른 필드는 값을 고치는 순간 PATCH가 나가고 활동
 * 피드에 한 줄이 남는다. 한 칸짜리 값에는 맞는 규칙이지만 문단에는 맞지 않는다 —
 * 글을 쓰는 동안 손이 멈출 때마다 저장이 나가면 "설명 A → AB", "AB → ABC"가 줄줄이
 * 쌓여 피드가 타자 기록이 된다. 문단은 **다 쓰고 나서 한 번** 저장하는 것이 사람의
 * 단위이고, 그래야 이력 한 줄이 하나의 뜻을 갖는다.
 *
 * 이미지는 data URL로 넣지 않는다. uploadImage가 있으면 먼저 파일 저장소로 보내고,
 * 완료된 URL만 본문에 심는다. 그래서 note 컬럼과 목록 응답의 크기는 이미지 크기와
 * 무관하게 유지된다.
 */

/** JIRA 설명 툴바에서 이 화면에 뜻이 있는 것만. 색·글꼴은 뺀다(거름망이 class를 지운다). */
const TEXT_TOOLBAR = [
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'code-block'],
];

const toolbarFor = (withImages: boolean) => [
  ...TEXT_TOOLBAR,
  withImages ? ['link', 'image'] : ['link'],
  ['clean'],
];

/**
 * 편집기가 만들 수 있는 서식. 이미지는 uploadImage가 있는 화면에서만 활성화한다.
 */
const TEXT_FORMATS = [
  'bold', 'italic', 'underline', 'strike',
  'list', 'bullet', 'blockquote', 'code-block', 'link',
];

/** 서버 DTO의 상한과 같다. 넘으면 저장이 400으로 떨어지므로 여기서 먼저 막는다. */
const MAX_LENGTH = 20000;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result ?? ''));
  reader.onerror = () => reject(reader.error ?? new Error('IMAGE_PREVIEW_READ_FAILED'));
  reader.readAsDataURL(file);
});

const imageKey = (source: string): string => {
  try {
    return new URL(source, window.location.origin).pathname;
  } catch {
    return source;
  }
};

const absoluteImageKey = (source: string): string => {
  try {
    return new URL(source, window.location.origin).href;
  } catch {
    return source;
  }
};

const replaceImageSources = (
  html: string,
  replace: (source: string) => string,
): string => {
  if (!html || typeof DOMParser === 'undefined') return html;
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  documentNode.querySelectorAll('img').forEach((image) => {
    const source = image.getAttribute('src');
    if (source) image.setAttribute('src', replace(source));
  });
  return documentNode.body.innerHTML;
};

const imageSources = (html: string | null): string[] => {
  if (!html || typeof DOMParser === 'undefined') return [];
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(documentNode.querySelectorAll('img'))
    .map((image) => image.getAttribute('src') ?? '')
    .filter(Boolean);
};

/**
 * 편집기의 현재 본문 → 컬럼에 넣을 값.
 *
 * 거름망을 통과시키고, 내용이 없으면 null로 접는다(편집기는 내용을 지워도
 * `<p><br></p>`를 남긴다). 저장할 값과 비교할 값을 늘 같은 함수로 만들어야
 * '안 바뀌었는데 저장됨'이 생기지 않는다.
 */
const toStored = (html: string): string | null => {
  const clean = sanitizeRichHtml(html);
  return hasRichContent(clean) ? clean : null;
};

type Props = {
  /** 서버가 준 값. 편집 중이 아닐 때 이 값을 그린다. */
  value: string | null | undefined;
  /**
   * [저장]을 눌렀을 때. 내용이 비면 null이 온다(컬럼을 비우라는 뜻).
   * 실패하면 throw해야 한다 — 이 컴포넌트가 편집 상태를 유지하고 오류를 보여 준다.
   */
  onSave: (next: string | null) => Promise<void>;
  readOnly?: boolean;
  /** 비어 있을 때 읽기 상태에 뜨는 안내. 누르면 편집기가 열린다. */
  emptyText?: string;
  placeholder?: string;
  /** 파일 저장소 업로드가 완료되면 영구 이미지 URL을 돌려준다. */
  uploadImage?: (file: File) => Promise<{ url: string; storageUrl?: string }>;
  /** 편집 취소 또는 저장 시 본문에서 빠진 이미지를 정리한다. */
  deleteImage?: (imageUrl: string) => Promise<void>;
  /** canonical 저장 경로를 현재 환경에서 실제 조회할 API URL로 바꾼다. */
  resolveImageUrl?: (storedUrl: string) => string;
};

const RichTextField: React.FC<Props> = ({
  value,
  onSave,
  readOnly = false,
  emptyText = '설명을 추가하세요',
  placeholder = '설명을 입력하세요',
  uploadImage,
  deleteImage,
  resolveImageUrl,
}) => {
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [uploadingCount, setUploadingCount] = React.useState(0);
  const [draggingImage, setDraggingImage] = React.useState(false);

  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<Quill | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const dragDepthRef = React.useRef(0);
  const uploadImageRef = React.useRef(uploadImage);
  const deleteImageRef = React.useRef(deleteImage);
  const resolveImageUrlRef = React.useRef(resolveImageUrl);
  const uploadedImagesRef = React.useRef(new Set<string>());
  const storageImageUrlsRef = React.useRef(new Map<string, string>());
  /**
   * 편집을 열었을 때 편집기에 담긴 값. 저장 여부는 **이것과** 비교해서 정한다.
   *
   * 서버 값과 직접 비교하면 안 된다 — 편집기는 넘겨받은 글을 자기 형식으로 다시 쓴다
   * (옛 행의 평문 `기타 메모입니다.`는 `<p>기타 메모입니다.</p>`가 된다). 그 차이로
   * 저장이 나가면 **열었다 닫기만 해도 "설명을 수정했습니다"가 남는다.**
   */
  const baselineRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    uploadImageRef.current = uploadImage;
    deleteImageRef.current = deleteImage;
    resolveImageUrlRef.current = resolveImageUrl;
  }, [deleteImage, resolveImageUrl, uploadImage]);

  const serverHtml = value ?? '';
  const readHtml = React.useMemo(() => {
    const clean = sanitizeRichHtml(serverHtml);
    return replaceImageSources(clean, (source) => resolveImageUrl?.(source) ?? source);
  }, [resolveImageUrl, serverHtml]);
  const hasContent = hasRichContent(serverHtml);

  /**
   * 편집기는 편집을 시작할 때 만들고 끝낼 때 버린다.
   *
   * 살려 두고 감추지 않는 이유: Quill 인스턴스가 살아 있으면 서버 값이 바뀔 때마다
   * (다른 사람의 저장, 목록 갱신) 편집 중인 본문을 덮어써야 할지 말지를 계속 판단해야
   * 한다. 편집기가 열려 있는 동안에는 **화면의 글이 유일한 원본**이라고 정해 두면
   * 그 판단이 사라진다.
   */
  React.useEffect(() => {
    if (!editing) return undefined;
    const host = hostRef.current;
    if (!host) return undefined;

    const editor = new Quill(host, {
      theme: 'snow',
      placeholder,
      modules: {
        toolbar: {
          container: toolbarFor(Boolean(uploadImageRef.current)),
          handlers: {
            image: () => fileInputRef.current?.click(),
          },
        },
        clipboard: { matchVisual: false },
      },
      formats: uploadImageRef.current ? [...TEXT_FORMATS, 'image'] : TEXT_FORMATS,
    });
    editorRef.current = editor;

    // DB에는 배포 환경과 무관한 canonical 경로를 두고, 화면에 넣을 때만 현재 API base로
    // 바꾼다. 저장할 때 되돌릴 수 있도록 display URL → canonical 경로를 함께 기억한다.
    storageImageUrlsRef.current.clear();
    const cleanServerHtml = sanitizeRichHtml(serverHtml);
    editor.root.innerHTML = replaceImageSources(cleanServerHtml, (source) => {
      const displayUrl = resolveImageUrlRef.current?.(source) ?? source;
      storageImageUrlsRef.current.set(absoluteImageKey(displayUrl), source);
      return displayUrl;
    });
    /**
     * innerHTML로 밀어 넣은 것은 아직 Quill이 읽지 않은 상태다. update()가 지금 읽게
     * 만든다 — 이걸 건너뛰면 옛 행의 평문 `기타 메모입니다.`가 기준값이 되고, 잠시 뒤
     * Quill이 `<p>기타 메모입니다.</p>`로 다시 쓴 순간 **손대지도 않은 글이 '바뀐' 것이
     * 된다.** 열었다 저장만 눌러도 이력이 남는 길이 여기였다.
     */
    editor.update('silent');
    baselineRef.current = toStored(cleanServerHtml);
    // getLength()는 끝의 개행까지 센다. 한 칸 앞이 글 끝이다.
    editor.setSelection(Math.max(editor.getLength() - 1, 0), 0);
    editor.focus();

    return () => {
      editorRef.current = null;
      // Quill은 툴바를 host **바깥**(앞 형제)에 붙인다. 편집을 닫으면 이 자리가 통째로
      // 언마운트되지만, 그 전에 다시 열리는 경우에 툴바가 겹쳐 남지 않게 직접 지운다.
      const toolbar = host.previousElementSibling;
      if (toolbar?.classList.contains('ql-toolbar')) toolbar.remove();
      host.innerHTML = '';
      host.className = '';
      dragDepthRef.current = 0;
      setDraggingImage(false);
    };
    // serverHtml은 편집을 여는 순간의 값만 쓴다. 편집 중 갱신으로 다시 만들지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, placeholder]);

  const removeImages = React.useCallback((sources: Iterable<string>) => {
    const remove = deleteImageRef.current;
    if (!remove) return;
    for (const source of sources) {
      void remove(source).catch(() => undefined);
    }
  }, []);

  React.useEffect(() => () => {
    removeImages(uploadedImagesRef.current);
    uploadedImagesRef.current.clear();
    storageImageUrlsRef.current.clear();
  }, [removeImages]);

  const insertImages = React.useCallback(async (files: File[]) => {
    const editor = editorRef.current;
    const upload = uploadImageRef.current;
    if (!editor || !upload || files.length === 0) return;

    const validFiles = files.filter((file) => {
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        setError(`${file.name || '이미지'}: PNG, JPG, GIF, WEBP 형식만 사용할 수 있습니다.`);
        return false;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setError(`${file.name || '이미지'}: 파일당 10MB까지 업로드할 수 있습니다.`);
        return false;
      }
      return true;
    });
    if (validFiles.length === 0) return;

    setError('');
    setUploadingCount((current) => current + validFiles.length);
    let index = editor.getSelection(true)?.index ?? Math.max(editor.getLength() - 1, 0);
    const previews: { file: File; previewUrl: string }[] = [];
    for (const file of validFiles) {
      let previewUrl: string;
      try {
        // Quill 1.3의 Image blot은 blob: URL을 //:0으로 바꾼다. 저장 전 임시 미리보기만
        // data URL을 쓰고, 업로드가 끝나면 즉시 Backend URL로 교체한다.
        previewUrl = await readFileAsDataUrl(file);
      } catch {
        setError(`${file.name || '이미지'}: 미리보기를 만들지 못했습니다.`);
        setUploadingCount((current) => Math.max(0, current - 1));
        continue;
      }
      editor.insertEmbed(index, 'image', previewUrl, 'user');
      index += 1;
      editor.insertText(index, '\n', 'user');
      index += 1;
      previews.push({ file, previewUrl });
    }
    if (previews.length === 0) return;
    editor.setSelection(index, 0, 'silent');

    await Promise.all(previews.map(async ({ file, previewUrl }) => {
      try {
        const uploaded = await upload(file);
        const storageUrl = uploaded.storageUrl ?? uploaded.url;
        uploadedImagesRef.current.add(storageUrl);
        storageImageUrlsRef.current.set(absoluteImageKey(uploaded.url), storageUrl);
        const preview = Array.from(editor.root.querySelectorAll('img'))
          .find((image) => image.src === previewUrl);
        if (!preview) {
          removeImages([storageUrl]);
          uploadedImagesRef.current.delete(storageUrl);
          storageImageUrlsRef.current.delete(absoluteImageKey(uploaded.url));
          return;
        }
        const blot = Quill.find(preview);
        const liveIndex = editor.getIndex(blot);
        editor.deleteText(liveIndex, 1, 'silent');
        editor.insertEmbed(liveIndex, 'image', uploaded.url, 'user');
      } catch (caught) {
        const preview = Array.from(editor.root.querySelectorAll('img'))
          .find((image) => image.src === previewUrl);
        if (preview) {
          const blot = Quill.find(preview);
          editor.deleteText(editor.getIndex(blot), 1, 'user');
        }
        setError(caught instanceof Error ? caught.message : `${file.name}: 업로드하지 못했습니다.`);
      } finally {
        setUploadingCount((current) => Math.max(0, current - 1));
      }
    }));
  }, [removeImages]);

  const close = React.useCallback(() => {
    if (uploadingCount > 0) {
      setError('이미지 업로드가 끝난 뒤 편집을 종료할 수 있습니다.');
      return;
    }
    removeImages(uploadedImagesRef.current);
    uploadedImagesRef.current.clear();
    storageImageUrlsRef.current.clear();
    setEditing(false);
    setError('');
  }, [removeImages, uploadingCount]);

  const handleSave = React.useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || saving) return;
    if (uploadingCount > 0) {
      setError('이미지 업로드가 끝난 뒤 저장할 수 있습니다.');
      return;
    }

    const storageHtml = replaceImageSources(editor.root.innerHTML, (source) => (
      storageImageUrlsRef.current.get(absoluteImageKey(source)) ?? source
    ));
    const next = toStored(storageHtml);
    if (next !== null && next.length > MAX_LENGTH) {
      setError(`설명이 너무 깁니다(${next.length.toLocaleString()}자). ${MAX_LENGTH.toLocaleString()}자까지 저장할 수 있습니다.`);
      return;
    }

    // 손대지 않았으면 요청도 활동 기록도 만들지 않는다.
    if (next === baselineRef.current) {
      close();
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave(next);
      const nextKeys = new Set(imageSources(next).map(imageKey));
      const removed = [
        ...imageSources(baselineRef.current).filter((source) => !nextKeys.has(imageKey(source))),
        ...Array.from(uploadedImagesRef.current).filter((source) => !nextKeys.has(imageKey(source))),
      ];
      removeImages(new Map(removed.map((source) => [imageKey(source), source])).values());
      uploadedImagesRef.current.clear();
      storageImageUrlsRef.current.clear();
      setSaving(false);
      setEditing(false);
    } catch (caught) {
      // 편집기를 닫지 않는다 — 닫으면 방금 쓴 글이 사라진다.
      setSaving(false);
      setError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
    }
  }, [close, onSave, removeImages, saving, uploadingCount]);

  const handlePasteCapture = React.useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!uploadImageRef.current) return;
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (files.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    void insertImages(files);
  }, [insertImages]);

  const handleDragEnter = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!uploadImageRef.current || !Array.from(event.dataTransfer.items).some((item) => item.type.startsWith('image/'))) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDraggingImage(true);
  }, []);

  const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!draggingImage) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDraggingImage(false);
  }, [draggingImage]);

  const handleDrop = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!uploadImageRef.current) return;
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setDraggingImage(false);
    void insertImages(files);
  }, [insertImages]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation(); // 모달까지 올라가면 상세 창이 통째로 닫힌다.
      close();
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void handleSave();
    }
  }, [close, handleSave]);

  if (!editing) {
    return (
      <div className="rich-text-field">
        {hasContent ? (
          <div
            className={`rich-text-read${readOnly ? '' : ' is-editable'}`}
            role={readOnly ? undefined : 'button'}
            tabIndex={readOnly ? undefined : 0}
            onClick={readOnly ? undefined : () => setEditing(true)}
            onKeyDown={readOnly ? undefined : (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setEditing(true);
              }
            }}
            // 거름망을 통과한 조각만 들어간다(utils/richText).
            dangerouslySetInnerHTML={{ __html: readHtml }}
          />
        ) : readOnly ? (
          <Text type="secondary" style={{ fontSize: 12 }}>설명이 없습니다.</Text>
        ) : (
          <button
            type="button"
            className="rich-text-empty"
            onClick={() => setEditing(true)}
          >
            {emptyText}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="rich-text-field is-editing"
      onKeyDown={handleKeyDown}
      onPasteCapture={handlePasteCapture}
      onDragEnter={handleDragEnter}
      onDragOver={(event) => {
        if (draggingImage) event.preventDefault();
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`rich-text-editor${draggingImage ? ' is-dragging-image' : ''}`}>
        <div ref={hostRef} />
        {draggingImage && (
          <div className="rich-text-drop-overlay">
            <ImagePlus size={24} />
            <span>이미지를 여기에 놓으세요</span>
          </div>
        )}
      </div>
      {/*
        편집기 상자 **바깥**이다.

        Quill이 만드는 툴바·본문은 테두리 하나로 묶인 한 상자로 읽힌다. 버튼이 그 안에
        들어가 보이면 '본문의 일부'가 되어, 어디까지가 내가 쓴 글이고 어디부터가 조작
        장치인지 흐려진다. 그래서 편집기와 형제로 두고 자리도 따로 잡는다.
      */}
      <div className="rich-text-footer">
        <div className="rich-text-actions">
          <Button
            type="primary"
            size="small"
            loading={saving}
            disabled={uploadingCount > 0}
            onClick={() => void handleSave()}
          >
            저장
          </Button>
          <Button type="text" size="small" disabled={saving || uploadingCount > 0} onClick={close}>
            취소
          </Button>
        </div>
        {uploadingCount > 0 ? (
          <Text type="secondary" className="rich-text-upload-status">
            <Loader2 size={12} /> 이미지 {uploadingCount.toLocaleString()}개 업로드 중
          </Text>
        ) : (
          <Text type="secondary" className="rich-text-hint">
            이미지 드롭/붙여넣기 · ⌘/Ctrl + Enter 저장 · Esc 취소
          </Text>
        )}
      </div>
      {uploadImage && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          hidden
          onChange={(event) => {
            void insertImages(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      )}
      {error && (
        <Text type="danger" style={{ fontSize: 12 }}>{error}</Text>
      )}
    </div>
  );
};

export default RichTextField;
