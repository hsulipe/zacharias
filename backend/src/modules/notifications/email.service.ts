import nodemailer from "nodemailer";
import { config } from "../../config";

function createTransport() {
  if (!config.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    auth: config.SMTP_USER
      ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
      : undefined,
  });
}

interface ExpiryAlertDoc {
  id: string;
  title: string;
  expires_at: Date;
  uploader_email: string;
  uploader_name: string;
}

export async function sendExpiryAlert(doc: ExpiryAlertDoc): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn(`[Email] SMTP not configured. Skipping alert for document ${doc.id}`);
    return;
  }

  const daysLeft = Math.ceil(
    (new Date(doc.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  await transport.sendMail({
    from: config.SMTP_FROM,
    to: doc.uploader_email,
    subject: `[GED] Document "${doc.title}" expires in ${daysLeft} day(s)`,
    text: `Hello ${doc.uploader_name},\n\nThe document "${doc.title}" (ID: ${doc.id}) is set to expire in ${daysLeft} day(s) on ${new Date(doc.expires_at).toLocaleDateString()}.\n\nPlease review it at your earliest convenience.\n\n— GED System`,
    html: `
      <p>Hello ${doc.uploader_name},</p>
      <p>The document <strong>"${doc.title}"</strong> (ID: ${doc.id}) is set to expire in <strong>${daysLeft} day(s)</strong> on ${new Date(doc.expires_at).toLocaleDateString()}.</p>
      <p>Please review it at your earliest convenience.</p>
      <p>— GED System</p>
    `,
  });
}

interface DeadlineAlertParams {
  email: string;
  name: string;
  document_id: string;
  document_title: string;
  label: string;
  due_at: Date;
  days_left: number;
}

export async function sendDeadlineAlert(params: DeadlineAlertParams): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn(`[Email] SMTP not configured. Skipping deadline alert for ${params.document_id}`);
    return;
  }

  const dueDateStr = new Date(params.due_at).toLocaleDateString("pt-BR");

  await transport.sendMail({
    from: config.SMTP_FROM,
    to: params.email,
    subject: `[GED] Prazo "${params.label}" vence em ${params.days_left} dia(s)`,
    text: `Olá ${params.name},\n\nO prazo "${params.label}" do documento "${params.document_title}" vence em ${params.days_left} dia(s) (${dueDateStr}).\n\nPor favor, tome as ações necessárias.\n\n— GED System`,
    html: `
      <p>Olá ${params.name},</p>
      <p>O prazo <strong>"${params.label}"</strong> do documento <strong>"${params.document_title}"</strong> vence em <strong>${params.days_left} dia(s)</strong> (${dueDateStr}).</p>
      <p>Por favor, tome as ações necessárias.</p>
      <p>— GED System</p>
    `,
  });
}
