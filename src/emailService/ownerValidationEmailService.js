const nodemailer = require('nodemailer');
const jwt        = require('jsonwebtoken');
const path       = require('path');

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

// ── Token helpers ─────────────────────────────────────────────────────────────

function generateOwnerToken(trainingId) {
  return jwt.sign(
    { trainingId, role: 'owner_validation' },
    process.env.JWT_SECRET,
    { expiresIn: '90d' },
  );
}

function verifyOwnerToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.role !== 'owner_validation') throw new Error('Invalid token type.');
  return payload;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d) {
  return d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';
}

function row(label, value, shade) {
  return `
    <tr style="background:${shade ? '#eef2f7' : '#ffffff'};">
      <td style="padding:12px 16px; font-size:13px; color:#1e3a5f; font-weight:700;
                 white-space:nowrap; border-bottom:1px solid #d1d5db; width:38%;">${label}</td>
      <td style="padding:12px 16px; font-size:13px; color:#111827; font-weight:500;
                 border-bottom:1px solid #d1d5db;">${value || '—'}</td>
    </tr>`;
}

// ── Owner validation email ────────────────────────────────────────────────────

async function sendOwnerValidationEmail({ owner, training, trainer, docFile }) {
  const token      = generateOwnerToken(training.id);
  const base       = process.env.BACKEND_URL;
  const acceptUrl  = `${base}/api/email-actions/owner-accept/${token}`;
  const reviseUrl  = `${base}/api/email-actions/owner-request-revision/${token}`;

  const ownerName   = owner.display_name   || `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email;
  const trainerName = trainer.display_name || trainer.first_name  || trainer.email;
  const trainingLinkBlock = training.link
    ? `
      <a href="${training.link}" target="_blank" rel="noopener noreferrer"
         style="display:inline-block; margin-top:8px; padding:8px 14px; background:#eff6ff;
                color:#1d4ed8; text-decoration:none; border:1px solid #bfdbfe; border-radius:999px;
                font-size:12px; font-weight:700; letter-spacing:0.2px;">
        Open Training Link
      </a>
      <p style="margin:10px 0 0; font-size:12px; color:#475569; word-break:break-all;">${training.link}</p>
    `
    : `<p style="margin:8px 0 0; font-size:13px; color:#94a3b8; font-style:italic;">No link provided.</p>`;
  const descriptionDoneBlock = training.description_done
    ? `<p style="margin:8px 0 0; font-size:13px; color:#1f2937; line-height:1.75;">${String(training.description_done).replace(/\n/g, '<br/>')}</p>`
    : `<p style="margin:8px 0 0; font-size:13px; color:#94a3b8; font-style:italic;">No completion description provided.</p>`;

  const docNote = docFile
    ? `<p style="margin:12px 0 0; font-size:13px; color:#1e3a5f; text-align:center;">
        &#128206; The training documentation is attached to this email (<strong>${docFile.originalname}</strong>).
       </p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Training Ready for Your Validation</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9; padding:40px 16px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0"
             style="max-width:620px; background:#ffffff; border-radius:16px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#ffffff; border-bottom:3px solid #1e3a5f;
                     padding:32px 40px; text-align:center;">
            <p style="margin:0 0 6px; font-size:11px; font-weight:700; letter-spacing:3px;
                      color:#1e3a5f; text-transform:uppercase;">AVOCarbon — Administration STS</p>
            <h1 style="margin:0; font-size:24px; font-weight:700; color:#1e3a5f; line-height:1.3;">
              Training Validation Required
            </h1>
            <p style="margin:10px 0 0; font-size:13px; color:#1e3a5f; opacity:0.75;">
              The trainer has completed the training and is awaiting your approval
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 20px; font-size:15px; color:#111827; font-weight:600; line-height:1.6;">
              Hello <strong style="color:#1e3a5f;">${ownerName}</strong>,
            </p>
            <p style="margin:0 0 28px; font-size:14px; color:#1f2937; line-height:1.7;">
              <strong>${trainerName}</strong> has completed the training
              <strong>&ldquo;${training.name}&rdquo;</strong>
              ${docFile ? 'and submitted the documentation ' : ''}
              for your review. Please validate or request changes below.
            </p>

            <!-- Training details -->
            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:12px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">Training Details</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row('Training Title',      training.name,                         false)}
                ${row('Department',          training.department,                    true)}
                ${row('Type',               training.type_of_training,              false)}
                ${row('Requirement',         training.requirement,                   true)}
                ${row('Target Audience',     training.target_audience,               false)}
                ${row('Training Objectives', training.training_objectives,           true)}
                ${row('Requested KPIs',      training.requested_kpis,               false)}
                ${row('Publication Date',    formatDate(training.publication_date),  true)}
                ${training.information ? row('Additional Info', training.information, false) : ''}
              </table>
            </div>

            <!-- Delivery details -->
            <div style="border:1px solid #dbeafe; background:#f8fbff; border-radius:14px; margin:0 0 22px; overflow:hidden;">
              <div style="background:linear-gradient(90deg,#e0ecff 0%, #f0f7ff 100%); padding:10px 14px; border-bottom:1px solid #dbeafe;">
                <p style="margin:0; font-size:12px; font-weight:800; letter-spacing:1px; color:#1e3a5f; text-transform:uppercase;">
                  Link & Completion Notes
                </p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:14px 16px; border-bottom:1px dashed #dbeafe;">
                    <p style="margin:0; font-size:11px; font-weight:800; letter-spacing:0.8px; color:#1e40af; text-transform:uppercase;">Training Link</p>
                    ${trainingLinkBlock}
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0; font-size:11px; font-weight:800; letter-spacing:0.8px; color:#0f766e; text-transform:uppercase;">Completion Description</p>
                    ${descriptionDoneBlock}
                  </td>
                </tr>
              </table>
            </div>

            ${docNote}

            <!-- Action buttons -->
            <p style="margin:24px 0 16px; font-size:14px; color:#111827; font-weight:700; text-align:center;">
              Please choose an action:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 6px;">
                  <a href="${acceptUrl}"
                     style="display:inline-block; padding:9px 22px; background:#16a34a;
                            color:#ffffff; text-decoration:none; border-radius:6px;
                            font-size:13px; font-weight:700; letter-spacing:0.4px;
                            border:1px solid #15803d;">
                    ✓ &nbsp;Accept Training
                  </a>
                </td>
                <td align="center" style="padding:0 6px;">
                  <a href="${reviseUrl}"
                     style="display:inline-block; padding:9px 22px; background:#d97706;
                            color:#ffffff; text-decoration:none; border-radius:6px;
                            font-size:13px; font-weight:700; letter-spacing:0.4px;
                            border:1px solid #b45309;">
                    ✎ &nbsp;Request Modifications
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0; font-size:12px; color:#6b7280; text-align:center; font-weight:500;">
              &#x23F1; These links are valid for <strong style="color:#374151;">3 months</strong>.
              If you cannot click the buttons, copy the link directly into your browser.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc; border-top:1px solid #e5e7eb;
                     padding:20px 40px; text-align:center;">
            <p style="margin:0; font-size:11px; color:#9ca3af; line-height:1.6;">
              &copy; ${new Date().getFullYear()} AVOCarbon — Administration STS. All rights reserved.<br/>
              This is an automated message, please do not reply directly to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const attachments = [];
  if (docFile) {
    attachments.push({
      filename: docFile.originalname,
      path:     path.join(__dirname, '..', '..', 'uploads', 'documentation', docFile.filename),
    });
  }

  await transporter.sendMail({
    from:        process.env.SMTP_FROM,
    to:          owner.email,
    subject:     `[AVOCarbon] Training Validation Required: "${training.name}"`,
    html,
    attachments,
  });

  console.log(`📧 Owner validation email sent to ${owner.email} for training #${training.id}`);
}

// ── Trainer revision email ────────────────────────────────────────────────────

async function sendTrainerRevisionEmail({ trainer, training, comment, imageFiles = [] }) {
  const trainerName = trainer.display_name || trainer.first_name || trainer.email;

  const imagesSection = imageFiles.length
    ? `
      <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
        <div style="background:#1e3a5f; padding:12px 16px;">
          <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                    color:#93c5fd; text-transform:uppercase;">Reference Images (${imageFiles.length})</p>
        </div>
        <div style="padding:16px 20px; background:#f8fafc;">
          <p style="margin:0 0 10px; font-size:13px; color:#475569;"
            >The owner has attached the following image(s) to illustrate the required changes.
             They are also attached to this email.</p>
          <table cellpadding="0" cellspacing="0"><tr>
            ${imageFiles.map(f => `
              <td style="padding:4px;">
                <img src="cid:revimg_${f.filename}" alt="${f.originalname}"
                     style="max-width:160px; max-height:120px; border-radius:6px;
                            border:1px solid #e2e8f0; display:block;"/>
              </td>`).join('')}
          </tr></table>
        </div>
      </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Training Revision Required</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9; padding:40px 16px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0"
             style="max-width:620px; background:#ffffff; border-radius:16px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#ffffff; border-bottom:3px solid #d97706;
                     padding:32px 40px; text-align:center;">
            <p style="margin:0 0 6px; font-size:11px; font-weight:700; letter-spacing:3px;
                      color:#1e3a5f; text-transform:uppercase;">AVOCarbon — Administration STS</p>
            <h1 style="margin:0; font-size:24px; font-weight:700; color:#1e3a5f; line-height:1.3;">
              Revision Requested
            </h1>
            <p style="margin:10px 0 0; font-size:13px; color:#d97706; font-weight:600;">
              The training owner has reviewed your submission and requested changes
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 20px; font-size:15px; color:#111827; font-weight:600; line-height:1.6;">
              Hello <strong style="color:#1e3a5f;">${trainerName}</strong>,
            </p>
            <p style="margin:0 0 24px; font-size:14px; color:#1f2937; line-height:1.7;">
              Your submission for the training <strong>&ldquo;${training.name}&rdquo;</strong>
              has been reviewed. The owner has requested the following modifications before
              the training can be validated.
            </p>

            <!-- Owner comment -->
            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:12px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">Owner's Comments</p>
              </div>
              <div style="padding:16px 20px; background:#fffbeb; border-left:4px solid #d97706;">
                <p style="margin:0; font-size:14px; color:#1c1917; line-height:1.7;">
                  ${comment.replace(/\n/g, '<br/>')}
                </p>
              </div>
            </div>

            ${imagesSection}

            <!-- Training info -->
            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:12px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">Training Details</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row('Training Title',    training.name,                         false)}
                ${row('Department',        training.department,                    true)}
                ${row('Publication Date',  formatDate(training.publication_date),  false)}
              </table>
            </div>

            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px;
                        padding:14px 18px; text-align:center;">
              <p style="margin:0; font-size:13px; color:#1e3a5f; line-height:1.6;">
                Once you have made the required corrections, please upload a new documentation
                file and mark the training as done again to submit it for re-validation.
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc; border-top:1px solid #e5e7eb;
                     padding:20px 40px; text-align:center;">
            <p style="margin:0; font-size:11px; color:#9ca3af; line-height:1.6;">
              &copy; ${new Date().getFullYear()} AVOCarbon — Administration STS. All rights reserved.<br/>
              This is an automated message, please do not reply directly to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const attachments = imageFiles.map(f => ({
    filename: f.originalname,
    path:     path.join(__dirname, '..', '..', 'uploads', 'revision-images', f.filename),
    cid:      `revimg_${f.filename}`,
  }));

  await transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to:      trainer.email,
    subject: `[AVOCarbon] Revision Required: "${training.name}"`,
    html,
    attachments,
  });

  console.log(`📧 Trainer revision email sent to ${trainer.email} for training #${training.id}`);
}

// ── Owner validation REMINDER email ──────────────────────────────────────────

async function sendOwnerValidationReminderEmail({ owner, training }) {
  const token      = generateOwnerToken(training.id);
  const base       = process.env.BACKEND_URL;
  const acceptUrl  = `${base}/api/email-actions/owner-accept/${token}`;
  const reviseUrl  = `${base}/api/email-actions/owner-request-revision/${token}`;

  const ownerName = owner.display_name || `${owner.first_name || ''} ${owner.last_name || ''}`.trim() || owner.email;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reminder: Training Awaiting Your Validation</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9; padding:40px 16px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0"
             style="max-width:620px; background:#ffffff; border-radius:16px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#ffffff; border-bottom:3px solid #d97706;
                     padding:32px 40px; text-align:center;">
            <p style="margin:0 0 6px; font-size:11px; font-weight:700; letter-spacing:3px;
                      color:#1e3a5f; text-transform:uppercase;">AVOCarbon — Administration STS</p>
            <h1 style="margin:0; font-size:24px; font-weight:700; color:#1e3a5f; line-height:1.3;">
              ⏰ Reminder: Validation Required
            </h1>
            <p style="margin:10px 0 0; font-size:13px; color:#d97706; font-weight:600;">
              A training is still awaiting your approval
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 20px; font-size:15px; color:#111827; font-weight:600; line-height:1.6;">
              Hello <strong style="color:#1e3a5f;">${ownerName}</strong>,
            </p>
            <p style="margin:0 0 28px; font-size:14px; color:#1f2937; line-height:1.7;">
              This is a friendly reminder that the training
              <strong>&ldquo;${training.name}&rdquo;</strong> is still awaiting your
              validation. The trainer has submitted the documentation and is waiting for
              your decision.
            </p>

            <!-- Training info -->
            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:12px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">Training Details</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row('Training Title',   training.name,                        false)}
                ${row('Department',       training.department,                   true)}
                ${row('Publication Date', formatDate(training.publication_date), false)}
              </table>
            </div>

            <!-- Action buttons -->
            <p style="margin:0 0 16px; font-size:14px; color:#111827; font-weight:700; text-align:center;">
              Please take action:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 6px;">
                  <a href="${acceptUrl}"
                     style="display:inline-block; padding:9px 22px; background:#16a34a;
                            color:#ffffff; text-decoration:none; border-radius:6px;
                            font-size:13px; font-weight:700; border:1px solid #15803d;">
                    ✓ &nbsp;Accept Training
                  </a>
                </td>
                <td align="center" style="padding:0 6px;">
                  <a href="${reviseUrl}"
                     style="display:inline-block; padding:9px 22px; background:#d97706;
                            color:#ffffff; text-decoration:none; border-radius:6px;
                            font-size:13px; font-weight:700; border:1px solid #b45309;">
                    ✎ &nbsp;Request Modifications
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0; font-size:12px; color:#6b7280; text-align:center;">
              Links are valid for <strong style="color:#374151;">3 months</strong>.
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

  await transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to:      owner.email,
    subject: `[AVOCarbon] ⏰ Reminder: Training Validation Required — "${training.name}"`,
    html,
  });

  console.log(`📧 Owner validation reminder sent to ${owner.email} for training #${training.id}`);
}

module.exports = {
  generateOwnerToken,
  verifyOwnerToken,
  sendOwnerValidationEmail,
  sendTrainerRevisionEmail,
  sendOwnerValidationReminderEmail,
};
