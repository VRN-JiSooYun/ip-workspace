import React, { useEffect } from 'react';
import {
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import type {
  CreatePatentRecordInput,
  PatentRecord,
  PatentRecordLookups,
} from '../../services/patentRecordApi';

const { Text } = Typography;

type FormValues = {
  countryId: number;
  applicationNumber: string;
  internalRef?: string;
  koreanTitle?: string;
  englishTitle?: string;
  applicationDate?: dayjs.Dayjs;
  applicant?: string;
  attorneyNumber?: number;
  registrationNumber?: string;
  registrationDate?: string;
  publicationNumber?: string;
  publicationDate?: dayjs.Dayjs;
  intApplicationNumber?: string;
  intApplicationDate?: dayjs.Dayjs;
  intPublicationNumber?: string;
  intPublicationDate?: dayjs.Dayjs;
  parentApplicationNumber?: string;
  legalStatusId?: number;
  examStatusId?: number;
  exam?: boolean;
  examDate?: dayjs.Dayjs;
};

type Props = {
  open: boolean;
  /** null이면 추가, 값이 있으면 변경. */
  record: PatentRecord | null;
  lookups: PatentRecordLookups | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: CreatePatentRecordInput) => void;
};

const toDayjs = (value: string | null | undefined) =>
  value ? dayjs(value) : undefined;

/** DatePicker는 Dayjs를 주므로 ISO 문자열로, 빈 값은 null로 바꿔 보낸다. */
const fromDayjs = (value: dayjs.Dayjs | undefined) =>
  value ? value.toISOString() : null;

const trimmedOrNull = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const PatentRecordFormModal: React.FC<Props> = ({
  open,
  record,
  lookups,
  submitting,
  onCancel,
  onSubmit,
}) => {
  const [form] = Form.useForm<FormValues>();
  const isEdit = record !== null;

  useEffect(() => {
    if (!open) return;
    if (record) {
      form.setFieldsValue({
        countryId: record.countryId,
        applicationNumber: record.applicationNumber,
        internalRef: record.internalRef ?? undefined,
        koreanTitle: record.koreanTitle ?? undefined,
        englishTitle: record.englishTitle ?? undefined,
        applicationDate: toDayjs(record.applicationDate),
        applicant: record.applicant ?? undefined,
        attorneyNumber: record.attorneyNumber ?? undefined,
        registrationNumber: record.registrationNumber ?? undefined,
        registrationDate: record.registrationDate ?? undefined,
        publicationNumber: record.publicationNumber ?? undefined,
        publicationDate: toDayjs(record.publicationDate),
        intApplicationNumber: record.intApplicationNumber ?? undefined,
        intApplicationDate: toDayjs(record.intApplicationDate),
        intPublicationNumber: record.intPublicationNumber ?? undefined,
        intPublicationDate: toDayjs(record.intPublicationDate),
        parentApplicationNumber: record.parentApplicationNumber ?? undefined,
        legalStatusId: record.legalStatusId ?? undefined,
        examStatusId: record.examStatusId ?? undefined,
        exam: record.exam ?? undefined,
        examDate: toDayjs(record.examDate),
      });
    } else {
      form.resetFields();
    }
  }, [open, record, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    onSubmit({
      countryId: values.countryId,
      applicationNumber: values.applicationNumber.trim(),
      internalRef: trimmedOrNull(values.internalRef),
      koreanTitle: trimmedOrNull(values.koreanTitle),
      englishTitle: trimmedOrNull(values.englishTitle),
      applicationDate: fromDayjs(values.applicationDate),
      applicant: trimmedOrNull(values.applicant),
      attorneyNumber: values.attorneyNumber ?? null,
      registrationNumber: trimmedOrNull(values.registrationNumber),
      registrationDate: trimmedOrNull(values.registrationDate),
      publicationNumber: trimmedOrNull(values.publicationNumber),
      publicationDate: fromDayjs(values.publicationDate),
      intApplicationNumber: trimmedOrNull(values.intApplicationNumber),
      intApplicationDate: fromDayjs(values.intApplicationDate),
      intPublicationNumber: trimmedOrNull(values.intPublicationNumber),
      intPublicationDate: fromDayjs(values.intPublicationDate),
      parentApplicationNumber: trimmedOrNull(values.parentApplicationNumber),
      legalStatusId: values.legalStatusId ?? null,
      examStatusId: values.examStatusId ?? null,
      exam: values.exam ?? null,
      examDate: fromDayjs(values.examDate),
    });
  };

  return (
    <Modal
      open={open}
      title={isEdit ? '관리 특허 수정' : '관리 특허 추가'}
      okText={isEdit ? '저장' : '추가'}
      cancelText="취소"
      onCancel={onCancel}
      onOk={() => void handleOk()}
      confirmLoading={submitting}
      width={880}
      destroyOnClose
      maskClosable={false}
    >
      <Form form={form} layout="vertical" disabled={submitting} preserve={false}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          국가와 출원번호만 필수입니다. 등록·공개 정보는 확정된 뒤에 채우면 됩니다.
        </Text>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="internalRef"
              label="내부관리번호"
              tooltip="예: A25W001, F25W001US. 형식이 달라도 입력한 그대로 저장됩니다."
              rules={[{ max: 50, message: '50자 이내로 입력해 주세요.' }]}
            >
              <Input placeholder="A25W001" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="countryId"
              label="국가"
              rules={[{ required: true, message: '국가를 선택해 주세요.' }]}
            >
              <Select
                placeholder="국가 선택"
                showSearch
                optionFilterProp="label"
                options={(lookups?.countries ?? []).map((country) => ({
                  value: country.id,
                  label: country.country,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="applicationNumber"
              label="출원번호"
              rules={[
                { required: true, message: '출원번호를 입력해 주세요.' },
                { max: 100, message: '100자 이내로 입력해 주세요.' },
              ]}
            >
              <Input placeholder="10-2026-0000000" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="applicationDate" label="출원일">
              <DatePicker style={{ width: '100%' }} format="YYYY.MM.DD" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="koreanTitle" label="국문 명칭" rules={[{ max: 500 }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="englishTitle" label="영문 명칭" rules={[{ max: 500 }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="applicant" label="출원인" rules={[{ max: 200 }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="attorneyNumber" label="대리인">
              <Select
                placeholder="대리인 선택"
                allowClear
                showSearch
                optionFilterProp="label"
                options={(lookups?.attorneys ?? []).map((attorney) => ({
                  value: attorney.attorneyNumber,
                  label: attorney.attorneyName ?? `#${attorney.attorneyNumber}`,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="parentApplicationNumber"
              label="원출원번호"
              rules={[{ max: 100 }]}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="legalStatusId" label="법적 상태">
              <Select
                placeholder="법적 상태 선택"
                allowClear
                options={(lookups?.legalStatuses ?? []).map((status) => ({
                  value: status.id,
                  label: status.status,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="examStatusId" label="심사 상태">
              <Select
                placeholder="심사 상태 선택"
                allowClear
                options={(lookups?.examStatuses ?? []).map((status) => ({
                  value: status.id,
                  label: status.status,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="examDate" label="심사일">
              <DatePicker style={{ width: '100%' }} format="YYYY.MM.DD" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="exam" label="심사청구" valuePropName="checked">
              <Checkbox>청구함</Checkbox>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="registrationNumber"
              label="등록번호"
              rules={[{ max: 100 }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            {/* patent.registration_date는 ERD상 text라 자유 입력으로 둔다. */}
            <Form.Item
              name="registrationDate"
              label="등록일"
              rules={[{ max: 100 }]}
            >
              <Input placeholder="2026-08-10" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="publicationNumber"
              label="공개번호"
              rules={[{ max: 100 }]}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="publicationDate" label="공개일">
              <DatePicker style={{ width: '100%' }} format="YYYY.MM.DD" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="intApplicationNumber"
              label="국제출원번호"
              rules={[{ max: 100 }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="intApplicationDate" label="국제출원일">
              <DatePicker style={{ width: '100%' }} format="YYYY.MM.DD" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="intPublicationNumber"
              label="국제공개번호"
              rules={[{ max: 100 }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="intPublicationDate" label="국제공개일">
              <DatePicker style={{ width: '100%' }} format="YYYY.MM.DD" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default PatentRecordFormModal;
