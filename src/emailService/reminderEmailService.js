const nodemailer = require('nodemailer');
const jwt        = require('jsonwebtoken');

const transporter = nodemailer.createTransport({
  host:       process.env.SMTP_HOST,
  port:       parseInt(process.env.SMTP_PORT || '587', 10),
  secure:     process.env.SMTP_SECURE === 'true',
  requireTLS: true,
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
  tls: { rejectUnauthorized: false },
});

function generateActionToken(trainingId, managerId) {
  return jwt.sign(
    { trainingId, managerId },
    process.env.JWT_SECRET,
    { expiresIn: '90d' },
  );
}

function generateSecondValidatorToken(trainingId) {
  return jwt.sign(
    { trainingId, role: 'second_validator' },
    process.env.JWT_SECRET,
    { expiresIn: '90d' },
  );
}

function buildActionButtons(approveUrl, rejectUrl, requestUpdateUrl) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:0 6px;">
          <a href="${approveUrl}"
             style="display:inline-block; padding:9px 22px; background:#16a34a;
                    color:#ffffff; text-decoration:none; border-radius:6px;
                    font-size:13px; font-weight:700; letter-spacing:0.4px;
                    border:1px solid #15803d;">
            ✓ &nbsp;Approve
          </a>
        </td>
        <td align="center" style="padding:0 6px;">
          <a href="${rejectUrl}"
             style="display:inline-block; padding:9px 22px; background:#dc2626;
                    color:#ffffff; text-decoration:none; border-radius:6px;
                    font-size:13px; font-weight:700; letter-spacing:0.4px;
                    border:1px solid #b91c1c;">
            ✕ &nbsp;Reject
          </a>
        </td>
        <td align="center" style="padding:0 6px;">
          <a href="${requestUpdateUrl}"
             style="display:inline-block; padding:9px 22px; background:#1e3a5f;
                    color:#ffffff; text-decoration:none; border-radius:6px;
                    font-size:13px; font-weight:700; letter-spacing:0.4px;
                    border:1px solid #1e3a5f;">
            ✎ &nbsp;Request Update
          </a>
        </td>
      </tr>
    </table>`;
}

function buildTrainingTable(training, requesters) {
  const requesterNames = requesters
    .map(r => r.display_name || `${r.first_name} ${r.last_name}`)
    .join(', ');

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  const row = (label, value, shade) => `
    <tr style="background:${shade ? '#eef2f7' : '#ffffff'};">
      <td style="padding:12px 16px; font-size:13px; color:#1e3a5f; font-weight:700;
                 white-space:nowrap; border-bottom:1px solid #d1d5db; width:38%;">${label}</td>
      <td style="padding:12px 16px; font-size:13px; color:#111827; font-weight:500;
                 border-bottom:1px solid #d1d5db;">${value || '—'}</td>
    </tr>`;

  return `
    <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
      <div style="background:#1e3a5f; padding:12px 16px;">
        <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                  color:#93c5fd; text-transform:uppercase;">Training Details</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${row('Training Title',   training.name,                        false)}
        ${row('Department',       training.department,                   true)}
        ${row('Type of Training', training.type_of_training,             false)}
        ${row('Requested By',     requesterNames,                        true)}
        ${row('Publication Date', formatDate(training.publication_date), false)}
        ${row('Objectives',       training.training_objectives,          true)}
        ${row('Target Audience',  training.target_audience,              false)}
        ${row('Requested KPIs',   training.requested_kpis,               true)}
        ${training.information ? row('Additional Info', training.information, false) : ''}
      </table>
    </div>`;
}

function wrapInLayout({ headerLabel, headerNote, recipientName, bodyHtml, accentColor = '#1e3a5f' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reminder: Pending Training Validation</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9; padding:40px 16px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0"
             style="max-width:620px; background:#ffffff; border-radius:16px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#ffffff; border-bottom:3px solid ${accentColor};
                     padding:32px 40px; text-align:center;">
            <p style="margin:0 0 6px; font-size:11px; font-weight:700; letter-spacing:3px;
                      color:#1e3a5f; text-transform:uppercase;">AVOCarbon — Administration STS</p>
            <h1 style="margin:0; font-size:22px; font-weight:700; color:#1e3a5f; line-height:1.3;">
              ⏰ Reminder: ${headerLabel}
            </h1>
            <p style="margin:10px 0 0; font-size:13px; color:#92400e; font-weight:600;">
              ${headerNote}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 20px; font-size:15px; color:#111827; font-weight:600; line-height:1.6;">
              Hello <strong style="color:#1e3a5f;">${recipientName}</strong>,
            </p>
            ${bodyHtml}
            <p style="margin:24px 0 0; font-size:12px; color:#6b7280; text-align:center; font-weight:500;">
              ⏱ Action links are valid for <strong style="color:#374151;">3 months</strong>.
              If buttons don't work, copy the link directly into your browser.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc; border-top:1px solid #e5e7eb;
                     padding:20px 40px; text-align:center;">
            <p style="margin:0; font-size:11px; color:#9ca3af; line-height:1.6;">
              &copy; ${new Date().getFullYear()} AVOCarbon — Administration STS. All rights reserved.<br/>
              This is an automated reminder. Please do not reply directly to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Sends a reminder to a 1st-validation manager.
 */
async function sendFirstValidationReminder({ manager, training, requesters }) {
  const base  = process.env.BACKEND_URL;
  const token = generateActionToken(training.id, manager.id);

  const approveUrl       = `${base}/api/email-actions/approve/${token}`;
  const rejectUrl        = `${base}/api/email-actions/reject/${token}`;
  const requestUpdateUrl = `${base}/api/email-actions/request-update/${token}`;

  const bodyHtml = `
    <div style="background:#fef3c7; border:1px solid #f59e0b; border-radius:8px;
                padding:14px 18px; margin-bottom:24px;">
      <p style="margin:0; font-size:14px; color:#92400e; font-weight:600;">
        ⚠️ This training request is still awaiting your <strong>1st validation</strong>.
        Please review and take action as soon as possible.
      </p>
    </div>
    ${buildTrainingTable(training, requesters)}
    <p style="margin:0 0 20px; font-size:14px; color:#111827; font-weight:700; text-align:center;">
      Please choose an action:
    </p>
    ${buildActionButtons(approveUrl, rejectUrl, requestUpdateUrl)}`;

  const recipientName = manager.display_name || manager.first_name || manager.email;
  const html = wrapInLayout({
    headerLabel: '1st Validation Pending',
    headerNote:  'This is a reminder — action is still required',
    recipientName,
    bodyHtml,
    accentColor: '#d97706',
  });

  await transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to:      manager.email,
    subject: `[AVOCarbon] ⏰ Reminder: 1st Validation Required — ${training.name}`,
    html,
  });

  console.log(`📧 1st validation reminder sent to ${manager.email} for training #${training.id}`);
}

/**
 * Sends a reminder to the predefined 2nd validator.
 */
async function sendSecondValidationReminder({ training, requesters }) {
  const base            = process.env.BACKEND_URL;
  const token           = generateSecondValidatorToken(training.id);
  const validatorEmail  = process.env.SECOND_VALIDATOR_EMAIL;
  const validatorName   = process.env.SECOND_VALIDATOR_NAME || 'Validator';

  const approveUrl       = `${base}/api/email-actions/second-approve/${token}`;
  const rejectUrl        = `${base}/api/email-actions/second-reject/${token}`;
  const requestUpdateUrl = `${base}/api/email-actions/second-request-update/${token}`;

  const bodyHtml = `
    <div style="background:#fef3c7; border:1px solid #f59e0b; border-radius:8px;
                padding:14px 18px; margin-bottom:24px;">
      <p style="margin:0; font-size:14px; color:#92400e; font-weight:600;">
        ⚠️ This training request has been pre-approved and is still awaiting your
        <strong>2nd (final) validation</strong>.
        Please review and take action as soon as possible.
      </p>
    </div>
    ${buildTrainingTable(training, requesters)}
    <p style="margin:0 0 20px; font-size:14px; color:#111827; font-weight:700; text-align:center;">
      Please choose an action:
    </p>
    ${buildActionButtons(approveUrl, rejectUrl, requestUpdateUrl)}`;

  const html = wrapInLayout({
    headerLabel: '2nd Validation Pending',
    headerNote:  'This is a reminder — final approval is still required',
    recipientName: validatorName,
    bodyHtml,
    accentColor: '#d97706',
  });

  await transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to:      validatorEmail,
    subject: `[AVOCarbon] ⏰ Reminder: 2nd Validation Required — ${training.name}`,
    html,
  });

  console.log(`📧 2nd validation reminder sent to ${validatorEmail} for training #${training.id}`);
}

module.exports = { sendFirstValidationReminder, sendSecondValidationReminder };
