import { google } from "googleapis";
import { logger } from "./logger.js";

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (
    connectionSettings &&
    connectionSettings.settings?.expires_at &&
    new Date(connectionSettings.settings.expires_at).getTime() > Date.now()
  ) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" +
      hostname +
      "/api/v2/connection?include_secrets=true&connector_names=google-mail",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    },
  )
    .then((res) => res.json())
    .then((data: any) => data.items?.[0]);

  const accessToken =
    connectionSettings?.settings?.access_token ||
    connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error("Gmail not connected — configure Google Mail integration");
  }
  return accessToken;
}

async function getGmailClient() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

const OFFICIAL_EMAIL = "craftershopy@gmail.com";

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  fromName = "Shopy Crafter",
): Promise<boolean> {
  try {
    const gmail = await getGmailClient();

    const boundary = "boundary_" + Date.now();
    const rawParts = [
      `From: ${fromName} <${OFFICIAL_EMAIL}>`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(
        htmlBody.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " "),
      ).toString("base64"),
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(htmlBody).toString("base64"),
      "",
      `--${boundary}--`,
    ];

    const raw = Buffer.from(rawParts.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    logger.info({ to, subject }, "Gmail: email sent successfully");
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, "Gmail: failed to send email");
    return false;
  }
}

export interface EmailAttachment {
  filename: string;
  content: string;
  mimeType: string;
}

export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  htmlBody: string,
  attachments: EmailAttachment[],
  fromName = "Shopy Crafter",
): Promise<boolean> {
  try {
    const gmail = await getGmailClient();

    const outer = "outer_" + Date.now();
    const inner = "inner_" + Date.now();

    const lines: string[] = [
      `From: ${fromName} <${OFFICIAL_EMAIL}>`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${outer}"`,
      "",
      `--${outer}`,
      `Content-Type: multipart/alternative; boundary="${inner}"`,
      "",
      `--${inner}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(htmlBody.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")).toString("base64"),
      "",
      `--${inner}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(htmlBody).toString("base64"),
      "",
      `--${inner}--`,
    ];

    for (const att of attachments) {
      lines.push(
        "",
        `--${outer}`,
        `Content-Type: ${att.mimeType}; name="${att.filename}"`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from(att.content).toString("base64"),
      );
    }

    lines.push("", `--${outer}--`);

    const raw = Buffer.from(lines.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    logger.info({ to, subject, attachments: attachments.map(a => a.filename) }, "Gmail: email with attachment sent");
    return true;
  } catch (err) {
    logger.error({ err, to, subject }, "Gmail: failed to send email with attachment");
    return false;
  }
}

export function isGmailAvailable(): boolean {
  return !!(
    process.env.REPLIT_CONNECTORS_HOSTNAME &&
    (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL)
  );
}
