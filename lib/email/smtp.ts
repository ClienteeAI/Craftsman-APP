import nodemailer from "nodemailer";

/**
 * Posielanie e-mailov cez SMTP majstra (nodemailer).
 *
 * Keďže posielame z JEHO schránky, ide o pravý e-mail z jeho adresy — vrátane
 * HTML, takže odkaz na ponuku môže byť klikacie tlačidlo, nie holý link.
 */

export type SmtpConn = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

function transport(c: SmtpConn) {
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
  });
}

/** Overí SMTP prihlásenie. Vyhodí chybu s dôvodom, keď nesedí. */
export async function testSmtp(c: SmtpConn): Promise<void> {
  await transport(c).verify();
}

export async function sendMail(
  c: SmtpConn,
  msg: { to: string; subject: string; html?: string; text?: string },
): Promise<void> {
  await transport(c).sendMail({
    from: c.from,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });
}
