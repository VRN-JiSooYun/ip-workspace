import { Form, Modal, Select, theme } from 'antd';
import React from 'react';
import {
  CONTACT_CATEGORY_OPTIONS,
  CONTACT_TYPE_LABELS,
  type ContactCategory,
  type ContactInquiryType,
} from '../../mocks/contactInquiries';
import ContactEditor from './ContactEditor';
import { hasContactContent } from './ContactContentViewer';

export type ContactWriteValues = {
  category: ContactCategory;
  type: ContactInquiryType;
  contentHtml: string;
};

type ContactWriteModalProps = {
  open: boolean;
  mode?: 'create' | 'edit';
  initialValues?: ContactWriteValues;
  onCancel: () => void;
  onSubmit: (values: ContactWriteValues) => void;
};

const ContactWriteModal: React.FC<ContactWriteModalProps> = ({
  open,
  mode = 'create',
  initialValues,
  onCancel,
  onSubmit,
}) => {
  const [form] = Form.useForm<ContactWriteValues>();
  const { token } = theme.useToken();

  return (
    <Modal
      className="contact-modal"
      title={mode === 'edit' ? '문의 수정' : '신규 문의 작성'}
      open={open}
      width={760}
      okText={mode === 'edit' ? '수정' : '등록'}
      cancelText="취소"
      style={{
        '--contact-scrollbar-track': token.colorBgContainer,
        '--contact-scrollbar-thumb': token.colorBorder,
        '--contact-scrollbar-thumb-hover': token.colorTextTertiary,
      } as React.CSSProperties}
      onCancel={onCancel}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form<ContactWriteValues>
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={initialValues ?? { category: 'Design', type: 'CHANGE', contentHtml: '' }}
        onFinish={(values) => {
          onSubmit(values);
          form.resetFields();
        }}
      >
        <div className="contact-modal-inline-fields">
          <Form.Item name="category" label="카테고리" rules={[{ required: true, message: '카테고리를 선택해주세요.' }]}>
            <Select
              classNames={{ popup: { root: 'contact-select-popup' } }}
              options={CONTACT_CATEGORY_OPTIONS.map((value) => ({ value, label: value }))}
            />
          </Form.Item>
          <Form.Item name="type" label="유형" rules={[{ required: true, message: '유형을 선택해주세요.' }]}>
            <Select
              classNames={{ popup: { root: 'contact-select-popup' } }}
              options={(Object.keys(CONTACT_TYPE_LABELS) as ContactInquiryType[])
                .map((value) => ({ value, label: CONTACT_TYPE_LABELS[value] }))}
            />
          </Form.Item>
        </div>
        <Form.Item
          name="contentHtml"
          label="내용"
          rules={[{
            validator: (_, value) => hasContactContent(value)
              ? Promise.resolve()
              : Promise.reject(new Error('문의 내용을 입력해주세요.')),
          }]}
        >
          <ContactEditor
            placeholder="문의 내용과 재현 방법을 작성해주세요."
            showImageAttachment={false}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ContactWriteModal;
