export type ConferenceCommentMailInput = {
  authorName: string;
  recipientEmail: string;
  conferenceAbbreviation: string;
  conferenceId: string;
  abstractId: string;
  abstractNumber: string | null;
  abstractTitle: string;
  comment: string;
  publicAppBaseUrl: string;
};

export type ConferenceCommentMail = {
  subject: string;
  textBody: string;
  htmlBody: string;
  abstractLink: string;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const buildConferenceCommentMail = (
  input: ConferenceCommentMailInput,
): ConferenceCommentMail => {
  const abstractPath =
    `/conferences/abstracts/${encodeURIComponent(input.abstractId)}` +
    `?conferenceId=${encodeURIComponent(input.conferenceId)}`;
  const abstractLink = new URL(abstractPath, input.publicAppBaseUrl).toString();
  const abstractNumber = input.abstractNumber?.trim() || "-";
  const subject = `${input.authorName}님이 Conference 메뉴에서 당신을 언급하셨습니다`;
  const textBody = [
    `${input.authorName}님이 ${input.recipientEmail}님에게`,
    "",
    `Conference: ${input.conferenceAbbreviation}`,
    `Abstract Number: ${abstractNumber}`,
    `Abstract Title: ${input.abstractTitle}`,
    "",
    "Comment:",
    input.comment,
    "",
    "Abstract Link:",
    abstractLink,
  ].join("\n");
  const htmlBody = [
    `<p>${escapeHtml(input.authorName)}님이 ${escapeHtml(input.recipientEmail)}님에게</p>`,
    "<p>",
    `Conference: ${escapeHtml(input.conferenceAbbreviation)}<br>`,
    `Abstract Number: ${escapeHtml(abstractNumber)}<br>`,
    `Abstract Title: ${escapeHtml(input.abstractTitle)}`,
    "</p>",
    "<p>Comment:</p>",
    `<p style="white-space:pre-wrap">${escapeHtml(input.comment)}</p>`,
    "<p>Abstract Link:<br>",
    `<a href="${escapeHtml(abstractLink)}">${escapeHtml(abstractLink)}</a></p>`,
  ].join("");
  return { subject, textBody, htmlBody, abstractLink };
};
