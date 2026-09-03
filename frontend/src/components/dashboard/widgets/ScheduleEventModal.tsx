import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Checkbox, DatePicker, Form, Input, Modal, Select, Spin, TimePicker } from 'antd';
import dayjs from 'dayjs';
import {
  CALENDAR_EVENT_COLORS,
  CALENDAR_EVENT_COLOR_LABELS,
  DEFAULT_CALENDAR_EVENT_COLOR,
  type CalendarEvent,
  type CalendarEventColor,
  type CalendarEventInput,
  type CalendarEventPatent,
} from '../../../utils/calendarEvents';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

/** 등록 모드에서 미리 채워 넣을 값. 날짜 칸이나 시간 격자를 누른 자리에서 온다. */
export type ScheduleEventDraft = {
  date: string;
  startTime?: string | null;
  endTime?: string | null;
};

type Props = {
  open: boolean;
  /** null이면 등록, 값이 있으면 수정. */
  event: CalendarEvent | null;
  draft: ScheduleEventDraft | null;
  /** 내가 속한 팀. 팀 공개를 고를 수 있는 범위다(서버도 같은 조건을 다시 본다). */
  teams: { id: string; name: string }[];
  /**
   * 연결할 특허 찾기. 빈 문자열이면 최근 등록순으로 몇 건을 준다.
   * 모달이 API를 직접 부르지 않는 이유는 나머지 대시보드 위젯과 같다 — IO는 훅이 갖는다.
   */
  searchPatents: (keyword: string) => Promise<CalendarEventPatent[]>;
  /** 저장이 끝날 때까지 기다린다(서버 저장이라 실패할 수 있다). */
  onSubmit: (input: CalendarEventInput) => void | Promise<void>;
  onClose: () => void;
};

/** 특허 한 건을 한 줄로 부르는 이름. 내부관리번호가 없는 행은 출원번호로 부른다. */
export const patentOptionLabel = (patent: CalendarEventPatent): string => {
  const number = patent.internalRef ?? patent.applicationNumber;
  return patent.title ? `${number} · ${patent.title}` : number;
};

/** 검색어를 친 뒤 이만큼 조용하면 묻는다. 한 글자마다 부르지 않기 위한 값이다. */
const PATENT_SEARCH_DEBOUNCE = 300;

/**
 * 공개 범위를 한 칸으로 다룬다.
 *
 * 값이 둘(visibility + teamId)이지만 사용자가 고르는 것은 "누구에게 보일까" 하나다.
 * 칸을 둘로 나누면 '팀 공개인데 팀을 안 고른' 상태를 사용자가 만들 수 있다.
 */
const PRIVATE_SCOPE = 'PRIVATE';

const scopeOf = (event: CalendarEvent | null): string => (
  event?.visibility === 'TEAM' && event.teamId ? event.teamId : PRIVATE_SCOPE
);

type FormValues = {
  title: string;
  range: [dayjs.Dayjs, dayjs.Dayjs];
  allDay: boolean;
  time?: [dayjs.Dayjs, dayjs.Dayjs];
  color: CalendarEventColor;
  /** 'PRIVATE' 또는 팀 id. */
  scope: string;
  /** 연결한 관리 특허의 id. 고르지 않으면 undefined. */
  patentId?: number;
  memo?: string;
};

/**
 * `HH:mm` → Dayjs. 날짜는 아무 날이나 붙여도 되지만(TimePicker는 시각만 본다), 형식
 * 인자로 파싱하려면 customParseFormat 플러그인이 필요하므로 ISO 문자열로 만든다.
 */
const TIME_BASE_DATE = '2000-01-01';

const toTime = (value: string | null | undefined): dayjs.Dayjs | null => (
  value ? dayjs(`${TIME_BASE_DATE}T${value}:00`) : null
);

const defaultTimeRange = (): [dayjs.Dayjs, dayjs.Dayjs] => [
  dayjs(`${TIME_BASE_DATE}T09:00:00`),
  dayjs(`${TIME_BASE_DATE}T10:00:00`),
];

/** 색 고르기. antd Form이 넣어 주는 value/onChange만 쓰는 작은 입력 컴포넌트다. */
const ColorChoice: React.FC<{
  value?: CalendarEventColor;
  onChange?: (next: CalendarEventColor) => void;
}> = ({ value, onChange }) => (
  <div className="db-cal-color-choice" role="radiogroup" aria-label="일정 색">
    {CALENDAR_EVENT_COLORS.map((color) => (
      <button
        key={color}
        type="button"
        role="radio"
        aria-checked={value === color}
        aria-label={CALENDAR_EVENT_COLOR_LABELS[color]}
        title={CALENDAR_EVENT_COLOR_LABELS[color]}
        className={`db-cal-color-swatch db-cal-tone-${color}${
          value === color ? ' db-cal-color-swatch-on' : ''
        }`}
        onClick={() => onChange?.(color)}
      />
    ))}
  </div>
);

/**
 * 일정 등록·수정 모달.
 *
 * 달력 칸을 누르면 등록으로, 일정 팝업의 '수정'을 누르면 수정으로 열린다. 두 경우가
 * 같은 폼을 쓰는 이유는 채워야 하는 값이 같기 때문이다 — 제목만 다르게 붙인다.
 *
 * 값 다듬기(기간 뒤집힘, 종일일 때 시각 버리기 등)는 utils/calendarEvents의
 * sanitizeCalendarEventInput이 마지막에 한 번 더 한다. 폼은 사람이 읽을 수 있는 오류만
 * 막고, 저장 가능한 모양을 보장하는 책임은 그쪽에 둔다.
 */
const ScheduleEventModal: React.FC<Props> = ({
  open,
  event,
  draft,
  teams,
  searchPatents,
  onSubmit,
  onClose,
}) => {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const allDay = Form.useWatch('allDay', form) ?? true;

  // ---- 연결 특허 고르기 ----------------------------------------------------

  const [patentOptions, setPatentOptions] = useState<CalendarEventPatent[]>([]);
  const [patentLoading, setPatentLoading] = useState(false);
  /** 늦게 온 응답이 최신 검색 결과를 덮지 않게 하는 표식(useCalendarEvents와 같은 방식). */
  const patentRequestId = useRef(0);
  const patentTimer = useRef<number | null>(null);

  const loadPatents = useCallback(async (keyword: string) => {
    const id = patentRequestId.current + 1;
    patentRequestId.current = id;
    setPatentLoading(true);
    try {
      const found = await searchPatents(keyword);
      if (patentRequestId.current !== id) return;
      setPatentOptions(found);
    } catch {
      // 검색 실패로 모달 전체를 막지 않는다. 목록만 비우고 나머지는 그대로 저장할 수 있다.
      if (patentRequestId.current === id) setPatentOptions([]);
    } finally {
      if (patentRequestId.current === id) setPatentLoading(false);
    }
  }, [searchPatents]);

  const searchPatentsDebounced = useCallback((keyword: string) => {
    if (patentTimer.current !== null) window.clearTimeout(patentTimer.current);
    patentTimer.current = window.setTimeout(() => {
      patentTimer.current = null;
      void loadPatents(keyword.trim());
    }, PATENT_SEARCH_DEBOUNCE);
  }, [loadPatents]);

  useEffect(() => () => {
    if (patentTimer.current !== null) window.clearTimeout(patentTimer.current);
  }, []);

  /**
   * 열릴 때 최근 등록 몇 건을 미리 채운다. 빈 목록으로 열면 무엇을 칠 수 있는 칸인지
   * 알기 어렵다. 수정 모드에서 이미 연결된 특허는 아래 options에서 따로 얹는다.
   */
  useEffect(() => {
    if (!open) return;
    void loadPatents('');
  }, [loadPatents, open]);

  /**
   * 이미 연결된 특허는 검색 결과에 없어도 보여야 한다(그 이름을 모르면 '무엇이 연결돼
   * 있는지'가 id 숫자로만 남는다). 중복은 id로 걸러 한 번만 놓는다.
   */
  const patentSelectOptions = useMemo(() => {
    const linked = event?.patent;
    const merged = linked && !patentOptions.some((item) => item.id === linked.id)
      ? [linked, ...patentOptions]
      : patentOptions;
    return merged.map((item) => ({ value: item.id, label: patentOptionLabel(item) }));
  }, [event?.patent, patentOptions]);

  useEffect(() => {
    if (!open) return;

    if (event) {
      form.setFieldsValue({
        title: event.title,
        range: [dayjs(event.start), dayjs(event.end)],
        allDay: event.allDay,
        time: event.allDay
          ? undefined
          : [
            toTime(event.startTime) ?? defaultTimeRange()[0],
            toTime(event.endTime) ?? defaultTimeRange()[1],
          ],
        color: event.color,
        scope: scopeOf(event),
        patentId: event.patent?.id,
        memo: event.memo ?? undefined,
      });
      return;
    }

    const date = draft?.date ?? dayjs().format('YYYY-MM-DD');
    const timed = Boolean(draft?.startTime);
    form.setFieldsValue({
      title: '',
      range: [dayjs(date), dayjs(date)],
      allDay: !timed,
      time: timed
        ? [
          toTime(draft?.startTime) ?? defaultTimeRange()[0],
          toTime(draft?.endTime) ?? defaultTimeRange()[1],
        ]
        : undefined,
      color: DEFAULT_CALENDAR_EVENT_COLOR,
      scope: PRIVATE_SCOPE,
      patentId: undefined,
      memo: undefined,
    });
  }, [draft, event, form, open]);

  /**
   * 종일을 껐는데 시각이 비어 있으면 기본값을 넣어 준다. 빈 칸을 남겨 두면 저장하려다
   * "시간을 선택하세요"만 보게 되는데, 사람이 원한 것은 '시각이 있는 일정'이지 오류가 아니다.
   */
  useEffect(() => {
    if (!open || allDay) return;
    if (form.getFieldValue('time')) return;
    form.setFieldValue('time', defaultTimeRange());
  }, [allDay, form, open]);

  const submit = async () => {
    const values = await form.validateFields();
    const [start, end] = values.range;
    setSaving(true);
    try {
      await onSubmit({
        title: values.title,
        start: start.format('YYYY-MM-DD'),
        end: end.format('YYYY-MM-DD'),
        allDay: values.allDay,
        startTime: values.allDay ? null : values.time?.[0]?.format('HH:mm') ?? null,
        endTime: values.allDay ? null : values.time?.[1]?.format('HH:mm') ?? null,
        color: values.color,
        memo: values.memo ?? null,
        visibility: values.scope === PRIVATE_SCOPE ? 'PRIVATE' : 'TEAM',
        teamId: values.scope === PRIVATE_SCOPE ? null : values.scope,
        patentId: values.patentId ?? null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={event ? '일정 수정' : '일정 등록'}
      okText={event ? '저장' : '등록'}
      cancelText="취소"
      width={440}
      confirmLoading={saving}
      onOk={submit}
      onCancel={onClose}
    >
      <Form form={form} layout="vertical" requiredMark={false} preserve={false}>
        <Form.Item
          name="title"
          label="제목"
          rules={[{ required: true, message: '제목을 입력하세요.' }]}
        >
          <Input placeholder="일정 제목" maxLength={100} autoFocus />
        </Form.Item>

        <Form.Item
          name="range"
          label="기간"
          rules={[{ required: true, message: '기간을 선택하세요.' }]}
        >
          <RangePicker style={{ width: '100%' }} format="YYYY.MM.DD" allowClear={false} />
        </Form.Item>

        <Form.Item name="allDay" valuePropName="checked" style={{ marginBottom: 8 }}>
          <Checkbox>종일</Checkbox>
        </Form.Item>

        <Form.Item
          name="time"
          label="시간"
          hidden={allDay}
          rules={[{ required: !allDay, message: '시간을 선택하세요.' }]}
        >
          <TimePicker.RangePicker
            style={{ width: '100%' }}
            format="HH:mm"
            minuteStep={5}
            allowClear={false}
            order={false}
          />
        </Form.Item>

        {/* 연결한 특허는 일정 팝업에서 '특허 관리' 목록으로 바로 넘어가는 링크가 된다. */}
        <Form.Item
          name="patentId"
          label="관련 특허"
        >
          <Select
            allowClear
            showSearch
            placeholder="내부관리번호 · 명칭으로 찾기"
            aria-label="관련 특허 선택"
            // 검색은 서버가 한다. 받아 온 목록을 다시 거르면 이름이 조금 다른 건이 사라진다.
            filterOption={false}
            onSearch={searchPatentsDebounced}
            onClear={() => void loadPatents('')}
            notFoundContent={patentLoading ? <Spin size="small" /> : '결과가 없습니다.'}
            options={patentSelectOptions}
          />
        </Form.Item>

        <Form.Item name="color" label="색">
          <ColorChoice />
        </Form.Item>

        <Form.Item
          name="scope"
          label="공개 범위"
          extra={teams.length === 0 ? '속한 팀이 없어 비공개로만 만들 수 있습니다.' : undefined}
        >
          <Select
            disabled={teams.length === 0}
            options={[
              { value: PRIVATE_SCOPE, label: '비공개 (나만 보기)' },
              ...teams.map((team) => ({ value: team.id, label: `${team.name} 팀 공개` })),
            ]}
          />
        </Form.Item>

        <Form.Item name="memo" label="메모">
          <TextArea rows={2} maxLength={300} placeholder="선택 입력" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ScheduleEventModal;
