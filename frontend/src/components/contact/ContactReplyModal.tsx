import { Descriptions, Form, Modal, theme } from 'antd';
import React from 'react';
import {
  CONTACT_STATUS_LABELS,
  CONTACT_TYPE_LABELS,
  type ContactInquiry,
} from '../../mocks/contactInquiries';
import { formatDisplayDate } from '../../utils/displayFormat';
import ContactContentViewer, { hasContactContent } from './ContactContentViewer';
import ContactEditor from './ContactEditor';

export type ContactReplyValues = { commentHtml: string };

type ContactReplyModalProps = {
  inquiry: ContactInquiry | null;
  onCancel: () => void;
  onSubmit: (values: ContactReplyValues) => void;
};

const ContactReplyModal: React.FC<ContactReplyModalProps> = ({ inquiry, onCancel, onSubmit }) => {
  const [form] = Form.useForm<ContactReplyValues>();
  const { token } = theme.useToken();

  React.useEffect(() => {
    if (!inquiry) return;
    form.setFieldValue('commentHtml', inquiry.commentHtml ?? '');
  }, [form, inquiry]);

  return (
    <Modal
      className="contact-modal"
      title="문의 답글 작성"
      open={Boolean(inquiry)}
      width={800}
      okText="답글 등록"
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
      {inquiry ? (
        <>
          <Descriptions className="contact-reply-summary" size="small" bordered column={2}>
            <Descriptions.Item label="카테고리">{inquiry.category}</Descriptions.Item>
            <Descriptions.Item label="상태">{CONTACT_STATUS_LABELS[inquiry.status]}</Descriptions.Item>
            <Descriptions.Item label="작성일">{formatDisplayDate(inquiry.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="유형">{CONTACT_TYPE_LABELS[inquiry.type]}</Descriptions.Item>
            <Descriptions.Item label="작성자" span={2}>{inquiry.authorName}</Descriptions.Item>
            <Descriptions.Item label="문의 내용" span={2}>
              <ContactContentViewer html={inquiry.contentHtml} alwaysExpanded />
            </Descriptions.Item>
          </Descriptions>
          <Form<ContactReplyValues>
            form={form}
            layout="vertical"
            preserve={false}
            onFinish={(values) => {
              onSubmit(values);
              form.resetFields();
            }}
          >
            <Form.Item
              name="commentHtml"
              label="답글 내용"
              rules={[{
                validator: (_, value) => hasContactContent(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error('답글 내용을 입력해주세요.')),
              }]}
            >
              <ContactEditor
                placeholder="답글 내용을 작성해주세요."
                showImageAttachment={false}
              />
            </Form.Item>
          </Form>
        </>
      ) : null}
    </Modal>
  );
};

export default ContactReplyModal;
