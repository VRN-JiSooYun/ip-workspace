export type SendMailInput = {
  outboxId: string;
  messageId: string;
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
};

export type MailProviderReadiness = {
  ready: boolean;
  fromEmailConfigured: boolean;
  tokenFileConfigured: boolean;
  errorCode?: string;
};

export interface MailProvider {
  readiness(): Promise<MailProviderReadiness>;
  send(input: SendMailInput): Promise<{ providerMessageId: string }>;
}
