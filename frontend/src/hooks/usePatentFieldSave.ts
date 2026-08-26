import { useCallback, useEffect, useRef, useState } from 'react';
import {
  patentRecordApi,
  type PatentRecord,
  type UpdatePatentRecordInput,
} from '../services/patentRecordApi';

/**
 * JIRA식 필드별 저장.
 *
 * 하단 [저장] 한 번이 아니라 필드 하나가 바뀔 때마다 그 키만 담아 PATCH한다. 서버의
 * `PATCH /patent-records/:id`는 이미 부분 갱신이고 감사 로그도 바뀐 필드만 남기므로,
 * 여기서 할 일은 **저장 상태를 필드별로 들고 있는 것**이다.
 *
 * ## 텍스트는 타자 중에 저장하지 않는다
 *
 * 처음에는 텍스트도 350ms 디바운스로 자동 저장했다. 요청 수만 보면 괜찮은 규칙이지만
 * **활동 피드가 타자 기록이 됐다** — '보로노이'를 치다 한 번 멈추면 `출원인 없음 → 보로`,
 * 다시 멈추면 `보로 → 보로노이`가 남는다. 서버가 값이 같은 저장을 걸러 줘도(같은 값
 * 재전송은 로그를 만들지 않는다) 중간값들은 전부 진짜 변경이라 걸러지지 않는다.
 *
 * 그래서 텍스트는 **blur·Enter로 확정할 때 한 번**만 보낸다. 사람이 "이 칸을 다 고쳤다"고
 * 판단하는 순간과 이력 한 줄이 일치한다. 화면을 벗어나기 전에 확정하지 못한 초안은
 * 다른 특허로 옮기거나 모달을 닫을 때 hook이 대신 보낸다(flushPendingEdits).
 *
 * select·날짜·체크박스는 한 번의 조작이 곧 최종값이라 즉시 보낸다.
 */

/** 저장 완료 표시를 남겨 두는 시간. 너무 짧으면 저장된 줄 모른다. */
const SAVED_BADGE_MS = 1500;

export type FieldSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type FieldSaveState = {
  status: FieldSaveStatus;
  /** status가 'error'일 때만 있다. */
  message?: string;
};

export type PatentFieldKey = keyof UpdatePatentRecordInput;

/**
 * 아직 서버로 나가지 않은 텍스트 한 칸.
 *
 * serverValue를 함께 들고 있는 이유: 확정할 때 "정말 달라졌는가"를 판단해야 한다.
 * 칸에 들어갔다 그냥 나온 것(포커스만 지나간 것)으로 PATCH가 나가면 안 된다.
 */
type TextDraft = { value: string; serverValue: string };

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '저장하지 못했습니다.';

/** 저장에 보낼 값으로 다듬는다. 빈 문자열은 컬럼을 비우라는 뜻(null)이다. */
const toSavedText = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/** 저장 한 번의 결과. 실패해도 reject하지 않는다 — 부르는 쪽이 고를 수 있게 값으로 준다. */
type SaveResult = { ok: true } | { ok: false; message: string };

export const usePatentFieldSave = (options: {
  /** 지금 보고 있는 특허. null이면 아무것도 하지 않는다. */
  patent: PatentRecord | null;
  /** 저장이 성공하면 갱신된 행을 넘긴다. 목록 행 갱신에 그대로 쓸 수 있다. */
  onSaved: (next: PatentRecord) => void;
}) => {
  const { patent, onSaved } = options;
  const patentId = patent?.id ?? null;

  const [states, setStates] = useState<Partial<Record<PatentFieldKey, FieldSaveState>>>({});
  const [draft, setDraft] = useState<Partial<Record<PatentFieldKey, string>>>({});

  /**
   * 초안의 원본. state와 별개로 ref에도 두는 이유는 **정리(cleanup)에서 읽어야** 하기
   * 때문이다 — 모달이 닫히는 시점의 state는 이미 지난 렌더의 값이다.
   */
  const draftsRef = useRef(new Map<PatentFieldKey, TextDraft>());
  /** 완료 표시를 되돌리는 타이머. */
  const badgeTimers = useRef(new Map<PatentFieldKey, number>());
  const latest = useRef({ patentId, onSaved });
  latest.current = { patentId, onSaved };

  const clearBadgeTimers = useCallback(() => {
    badgeTimers.current.forEach((id) => window.clearTimeout(id));
    badgeTimers.current.clear();
  }, []);

  const setState = useCallback((key: PatentFieldKey, next: FieldSaveState) => {
    setStates((current) => ({ ...current, [key]: next }));
  }, []);

  /**
   * 실제 전송. 필드 하나만 담는다.
   *
   * 요청마다 새 requestId를 만들어 보낸다 — 서버가 그 값으로 감사 로그 행을 묶으므로,
   * 한 번의 저장에서 나온 변경들이 활동 피드에서 한 덩이로 보인다.
   *
   * targetId를 받는 이유: 모달을 닫으며 마지막 초안을 보낼 때는 이미 '지금 보는 특허'가
   * 바뀐 뒤다. 그때도 **그 초안이 속한 특허**로 가야 한다.
   */
  const send = useCallback(async (
    key: PatentFieldKey,
    value: unknown,
    targetId?: number,
  ): Promise<SaveResult> => {
    const id = targetId ?? latest.current.patentId;
    if (id === null) return { ok: true };

    // 화면을 떠난 뒤의 저장이면 상태 표시는 뜻이 없다(볼 화면이 없다).
    const visible = () => latest.current.patentId === id;
    if (visible()) setState(key, { status: 'saving' });

    try {
      const updated = await patentRecordApi.update(
        id,
        { [key]: value } as UpdatePatentRecordInput,
        globalThis.crypto?.randomUUID?.(),
      );
      // 저장 중에 다른 특허로 옮겨 갔으면 그 화면에 남의 결과를 밀어 넣지 않는다.
      if (!visible()) return { ok: true };
      latest.current.onSaved(updated);
      setState(key, { status: 'saved' });

      const badge = window.setTimeout(() => {
        badgeTimers.current.delete(key);
        setState(key, { status: 'idle' });
      }, SAVED_BADGE_MS);
      badgeTimers.current.set(key, badge);
      return { ok: true };
    } catch (error) {
      const message = getErrorMessage(error);
      if (visible()) setState(key, { status: 'error', message });
      return { ok: false, message };
    }
  }, [setState]);

  /** 초안 하나를 확정해 보낸다. 달라지지 않았으면 아무것도 하지 않는다. */
  const flushDraft = useCallback((
    key: PatentFieldKey,
    targetId?: number,
  ): Promise<SaveResult> | null => {
    const pending = draftsRef.current.get(key);
    if (!pending) return null;
    draftsRef.current.delete(key);

    const next = toSavedText(pending.value);
    const before = toSavedText(pending.serverValue);
    // 들어갔다 그냥 나온 칸으로 요청도 이력도 만들지 않는다.
    if (next === before) return null;
    return send(key, next, targetId);
  }, [send]);

  /**
   * 다른 특허로 옮기거나 화면이 사라질 때.
   *
   * 초안을 버리지 않고 **보낸다.** 자동 저장을 걷어낸 대신, 확정하지 않고 창을 닫아도
   * 글이 사라지지 않는다는 보장은 남겨야 한다(blur는 언마운트에서 오지 않는다).
   */
  useEffect(() => {
    const closingId = patentId;
    return () => {
      Array.from(draftsRef.current.keys()).forEach((key) => {
        void flushDraft(key, closingId ?? undefined);
      });
      draftsRef.current.clear();
      clearBadgeTimers();
    };
  }, [patentId, flushDraft, clearBadgeTimers]);

  /** 특허가 바뀌면 이전 특허의 상태 표시는 지운다(초안은 위에서 이미 보냈다). */
  useEffect(() => {
    setDraft({});
    setStates({});
  }, [patentId]);

  /** 타자. 화면에만 반영한다 — 여기서는 아무것도 보내지 않는다. */
  const editText = useCallback((
    key: PatentFieldKey,
    value: string,
    serverValue: string | null | undefined,
  ) => {
    draftsRef.current.set(key, { value, serverValue: serverValue ?? '' });
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  /** blur·Enter. 이 칸을 다 고쳤다는 뜻이다. 여기서 한 번 보낸다. */
  const commitText = useCallback((key: PatentFieldKey) => {
    void flushDraft(key);
  }, [flushDraft]);

  /** select·날짜·체크박스. 한 번의 조작이 곧 최종값이라 즉시 보낸다. */
  const saveValue = useCallback((key: PatentFieldKey, value: unknown) => {
    void send(key, value);
  }, [send]);

  /**
   * 명시적 [저장] 버튼이 있는 필드(설명)용. 실패를 **throw로** 알린다 —
   * 부르는 쪽이 편집기를 닫을지 열어 둘지 결정해야 한다.
   */
  const saveField = useCallback(async (key: PatentFieldKey, value: unknown) => {
    const result = await send(key, value);
    if (!result.ok) throw new Error(result.message);
  }, [send]);

  /**
   * 입력에 넣을 값. 초안이 있으면 초안, 없으면 서버 값.
   * 초안을 지우지 않는 이유: 저장 실패 후에도 사용자가 치던 값이 남아야 다시 시도할 수 있다.
   */
  const textValue = useCallback((key: PatentFieldKey, serverValue: string | null | undefined) => (
    draft[key] ?? serverValue ?? ''
  ), [draft]);

  /** 저장 실패한 필드의 초안을 버리고 서버 값으로 되돌린다. */
  const revert = useCallback((key: PatentFieldKey) => {
    draftsRef.current.delete(key);
    setDraft((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setState(key, { status: 'idle' });
  }, [setState]);

  return {
    states,
    stateOf: (key: PatentFieldKey): FieldSaveState => states[key] ?? { status: 'idle' },
    textValue,
    editText,
    commitText,
    saveValue,
    saveField,
    revert,
    /** 아직 서버로 나가지 않은 편집이 있는지. */
    hasPendingEdits: () => draftsRef.current.size > 0,
  };
};
