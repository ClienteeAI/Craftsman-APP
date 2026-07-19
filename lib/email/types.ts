/**
 * Vlastná e-mailová schránka majstra (IMAP na čítanie, SMTP na posielanie).
 */

/** Uložené nastavenie schránky, BEZ hesla (to sa von nikdy neposiela). */
export type EmailAccount = {
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
};

/** Vstup pri pripájaní schránky — vrátane hesla (len smerom dnu). */
export type EmailAccountInput = EmailAccount & { password: string };

/** Riadok v zozname schránky. */
export type MailSummary = {
  uid: number;
  from: string;
  fromName: string | null;
  subject: string;
  date: string | null;
  seen: boolean;
};

/** Otvorený e-mail. */
export type MailDetail = {
  uid: number;
  from: string;
  to: string;
  subject: string;
  date: string | null;
  html: string | null;
  text: string | null;
  attachments: { filename: string; size: number }[];
};
