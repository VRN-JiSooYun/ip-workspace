import { buildConferenceCommentMail } from './conference-mail-template';

describe('buildConferenceCommentMail', () => {
  it('builds recipient-specific text and escaped HTML with a UUID deep link', () => {
    const mail = buildConferenceCommentMail({
      authorName: '문태훈',
      recipientEmail: 'thmoon@voronoi.io',
      conferenceAbbreviation: 'WCLC',
      conferenceId: 'conference-id',
      abstractId: 'abstract-id',
      abstractNumber: null,
      abstractTitle: '<Robert & Ginsberg>',
      comment: '@thmoon test <script>',
      publicAppBaseUrl: 'https://workspace.example/base',
    });

    expect(mail.subject).toBe('문태훈님이 Conference 메뉴에서 당신을 언급하셨습니다');
    expect(mail.textBody).toContain('Abstract Number: -');
    expect(mail.abstractLink).toBe(
      'https://workspace.example/conferences/abstracts/abstract-id?conferenceId=conference-id',
    );
    expect(mail.htmlBody).toContain('&lt;Robert &amp; Ginsberg&gt;');
    expect(mail.htmlBody).not.toContain('<script>');
  });
});
