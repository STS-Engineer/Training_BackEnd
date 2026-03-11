const nodemailer = require('nodemailer');
const jwt        = require('jsonwebtoken');

const transporter = nodemailer.createTransport({
  host:       process.env.SMTP_HOST,
  port:       parseInt(process.env.SMTP_PORT || '587', 10),
  secure:     process.env.SMTP_SECURE === 'true',
  requireTLS: true,
  auth:   process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
  tls: { rejectUnauthorized: false },
});

transporter.verify((err) => {
  if (err) console.error('❌ SMTP connection error:', err.message);
  else     console.log('✅ SMTP server ready.');
});

function generateActionToken(trainingId, managerId) {
  return jwt.sign(
    { trainingId, managerId },
    process.env.JWT_SECRET,
    { expiresIn: '90d' },
  );
}

function verifyActionToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// ── Second validator tokens ───────────────────────────────────────────────────

function generateSecondValidatorToken(trainingId) {
  return jwt.sign(
    { trainingId, role: 'second_validator' },
    process.env.JWT_SECRET,
    { expiresIn: '90d' },
  );
}

function verifySecondValidatorToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.role !== 'second_validator') throw new Error('Invalid token type.');
  return payload;
}

async function sendTrainingApprovalEmail({ manager, training, requesters, owner }) {
  const token = generateActionToken(training.id, manager.id);
  const base  = process.env.BACKEND_URL || 'http://localhost:3000';

  const approveUrl       = `${base}/api/email-actions/approve/${token}`;
  const rejectUrl        = `${base}/api/email-actions/reject/${token}`;
  const requestUpdateUrl = `${base}/api/email-actions/request-update/${token}`;

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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Training Approval Request</title>
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
              Training Approval Request
            </h1>
            <p style="margin:10px 0 0; font-size:13px; color:#1e3a5f; opacity:0.75;">
              A new training request requires your review
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 20px; font-size:15px; color:#111827; font-weight:600; line-height:1.6;">
              Hello <strong style="color:#1e3a5f;">${manager.display_name || manager.first_name}</strong>,
            </p>
            <p style="margin:0 0 28px; font-size:14px; color:#1f2937; line-height:1.7;">
              A training request has been submitted by <strong>${requesterNames}</strong>
              and is awaiting your approval. Please review the details below and take action.
            </p>

            <!-- Training details card -->
            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:12px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">Training Details</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row('Training Title',   training.name,                        false)}
                ${row('Department',       training.department,                   true)}
                ${row('Type of Training', training.type_of_training,             false)}
                ${row('Requirement',      training.requirement,                  true)}
                ${row('Requested By',     requesterNames,                        false)}
                ${row('Publication Date', formatDate(training.publication_date), true)}
                ${row('Objectives',       training.training_objectives,          false)}
                ${row('Target Audience',  training.target_audience,              true)}
                ${row('Requested KPIs',   training.requested_kpis,               false)}
                ${training.information ? row('Additional Info', training.information, true) : ''}
              </table>
            </div>

            <!-- Action buttons -->
            <p style="margin:0 0 20px; font-size:14px; color:#111827; font-weight:700; text-align:center;">
              Please choose an action:
            </p>
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
            </table>

            <p style="margin:24px 0 0; font-size:12px; color:#6b7280; text-align:center; font-weight:500;">
              ⏱ These links are valid for <strong style="color:#374151;">3 months</strong>.
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

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || 'administration.STS@avocarbon.com',
    to:      manager.email,
    subject: `[AVOCarbon] Training Approval Required: ${training.name}`,
    html,
  });

  console.log(`📧 Approval email sent to ${manager.email}`);
}

/**
 * Sent to managers after the training creator re-submits following an update request.
 * Same structure as approval email but with an amber header to indicate re-review.
 */
async function sendTrainingUpdatedEmail({ manager, training, requesters }) {
  const token = generateActionToken(training.id, manager.id);
  const base  = process.env.BACKEND_URL || 'http://localhost:3000';

  const approveUrl       = `${base}/api/email-actions/approve/${token}`;
  const rejectUrl        = `${base}/api/email-actions/reject/${token}`;
  const requestUpdateUrl = `${base}/api/email-actions/request-update/${token}`;

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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Training Updated — Re-evaluation Required</title>
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
              Training Updated — Re-evaluation Required
            </h1>
            <p style="margin:10px 0 0; font-size:13px; color:#92400e;">
              The requester has updated their training request following your feedback
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 20px; font-size:15px; color:#111827; font-weight:600; line-height:1.6;">
              Hello <strong style="color:#1e3a5f;">${manager.display_name || manager.first_name}</strong>,
            </p>
            <p style="margin:0 0 28px; font-size:14px; color:#1f2937; line-height:1.7;">
              <strong>${requesterNames}</strong> has updated the training request
              <strong>&ldquo;${training.name}&rdquo;</strong> following your update request.
              Please review the updated details below and take action.
            </p>

            <!-- Training details card -->
            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:12px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">Updated Training Details</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row('Training Title',   training.name,                        false)}
                ${row('Department',       training.department,                   true)}
                ${row('Type of Training', training.type_of_training,             false)}
                ${row('Requirement',      training.requirement,                  true)}
                ${row('Requested By',     requesterNames,                        false)}
                ${row('Publication Date', formatDate(training.publication_date), true)}
                ${row('Objectives',       training.training_objectives,          false)}
                ${row('Target Audience',  training.target_audience,              true)}
                ${row('Requested KPIs',   training.requested_kpis,               false)}
                ${training.information ? row('Additional Info', training.information, true) : ''}
              </table>
            </div>

            <!-- Action buttons -->
            <p style="margin:0 0 20px; font-size:14px; color:#111827; font-weight:700; text-align:center;">
              Please choose an action:
            </p>
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
            </table>

            <p style="margin:24px 0 0; font-size:12px; color:#6b7280; text-align:center; font-weight:500;">
              ⏱ These links are valid for <strong style="color:#374151;">3 months</strong>.
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

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || 'administration.STS@avocarbon.com',
    to:      manager.email,
    subject: `[AVOCarbon] Training Updated — Re-evaluation Required: ${training.name}`,
    html,
  });

  console.log(`📧 Updated notification sent to ${manager.email}`);
}

// ── Second validator emails ───────────────────────────────────────────────────

/**
 * Sent to the predefined second validator when the first manager approves.
 * Same structure as the first approval email but using /second-* routes.
 */
async function sendSecondValidatorApprovalEmail({ training, requesters }) {
  const token = generateSecondValidatorToken(training.id);
  const base  = process.env.BACKEND_URL || 'http://localhost:3000';

  const approveUrl       = `${base}/api/email-actions/second-approve/${token}`;
  const rejectUrl        = `${base}/api/email-actions/second-reject/${token}`;
  const requestUpdateUrl = `${base}/api/email-actions/second-request-update/${token}`;

  const validatorEmail = process.env.SECOND_VALIDATOR_EMAIL;
  const validatorName  = process.env.SECOND_VALIDATOR_NAME || 'Validator';

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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Second Validation Required</title>
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
              Second Validation Required
            </h1>
            <p style="margin:10px 0 0; font-size:13px; color:#1e3a5f; opacity:0.75;">
              A training request has been pre-approved and requires your final review
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 20px; font-size:15px; color:#111827; font-weight:600; line-height:1.6;">
              Hello <strong style="color:#1e3a5f;">${validatorName}</strong>,
            </p>
            <p style="margin:0 0 28px; font-size:14px; color:#1f2937; line-height:1.7;">
              A training request submitted by <strong>${requesterNames}</strong>
              has been pre-approved by the first manager and now requires your final validation.
              Please review the details below and take action.
            </p>

            <!-- Training details card -->
            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:12px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">Training Details</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row('Training Title',   training.name,                        false)}
                ${row('Department',       training.department,                   true)}
                ${row('Type of Training', training.type_of_training,             false)}
                ${row('Requirement',      training.requirement,                  true)}
                ${row('Requested By',     requesterNames,                        false)}
                ${row('Publication Date', formatDate(training.publication_date), true)}
                ${row('Objectives',       training.training_objectives,          false)}
                ${row('Target Audience',  training.target_audience,              true)}
                ${row('Requested KPIs',   training.requested_kpis,               false)}
                ${training.information ? row('Additional Info', training.information, true) : ''}
              </table>
            </div>

            <!-- Action buttons -->
            <p style="margin:0 0 20px; font-size:14px; color:#111827; font-weight:700; text-align:center;">
              Please choose an action:
            </p>
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
            </table>

            <p style="margin:24px 0 0; font-size:12px; color:#6b7280; text-align:center; font-weight:500;">
              ⏱ These links are valid for <strong style="color:#374151;">3 months</strong>.
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

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || 'administration.STS@avocarbon.com',
    to:      validatorEmail,
    subject: `[AVOCarbon] Second Validation Required: ${training.name}`,
    html,
  });

  console.log(`📧 Second validator approval email sent to ${validatorEmail}`);
}

/**
 * Sent to the second validator after the creator re-submits following
 * a second-validator update request.
 */
async function sendSecondValidatorUpdatedEmail({ training, requesters }) {
  const token = generateSecondValidatorToken(training.id);
  const base  = process.env.BACKEND_URL || 'http://localhost:3000';

  const approveUrl       = `${base}/api/email-actions/second-approve/${token}`;
  const rejectUrl        = `${base}/api/email-actions/second-reject/${token}`;
  const requestUpdateUrl = `${base}/api/email-actions/second-request-update/${token}`;

  const validatorEmail = process.env.SECOND_VALIDATOR_EMAIL;
  const validatorName  = process.env.SECOND_VALIDATOR_NAME || 'Validator';

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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Training Updated — Second Validation Required</title>
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
              Training Updated — Second Validation Required
            </h1>
            <p style="margin:10px 0 0; font-size:13px; color:#92400e;">
              The requester has updated their training request following your feedback
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 20px; font-size:15px; color:#111827; font-weight:600; line-height:1.6;">
              Hello <strong style="color:#1e3a5f;">${validatorName}</strong>,
            </p>
            <p style="margin:0 0 28px; font-size:14px; color:#1f2937; line-height:1.7;">
              <strong>${requesterNames}</strong> has updated the training request
              <strong>&ldquo;${training.name}&rdquo;</strong> following your update request.
              Please review the updated details below and take action.
            </p>

            <!-- Training details card -->
            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:12px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">Updated Training Details</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row('Training Title',   training.name,                        false)}
                ${row('Department',       training.department,                   true)}
                ${row('Type of Training', training.type_of_training,             false)}
                ${row('Requirement',      training.requirement,                  true)}
                ${row('Requested By',     requesterNames,                        false)}
                ${row('Publication Date', formatDate(training.publication_date), true)}
                ${row('Objectives',       training.training_objectives,          false)}
                ${row('Target Audience',  training.target_audience,              true)}
                ${row('Requested KPIs',   training.requested_kpis,               false)}
                ${training.information ? row('Additional Info', training.information, true) : ''}
              </table>
            </div>

            <!-- Action buttons -->
            <p style="margin:0 0 20px; font-size:14px; color:#111827; font-weight:700; text-align:center;">
              Please choose an action:
            </p>
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
            </table>

            <p style="margin:24px 0 0; font-size:12px; color:#6b7280; text-align:center; font-weight:500;">
              ⏱ These links are valid for <strong style="color:#374151;">3 months</strong>.
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

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || 'administration.STS@avocarbon.com',
    to:      validatorEmail,
    subject: `[AVOCarbon] Training Updated — Second Validation Required: ${training.name}`,
    html,
  });

  console.log(`📧 Second validator updated email sent to ${validatorEmail}`);
}

module.exports = {
  sendTrainingApprovalEmail,
  sendTrainingUpdatedEmail,
  sendSecondValidatorApprovalEmail,
  sendSecondValidatorUpdatedEmail,
  generateActionToken,
  verifyActionToken,
  generateSecondValidatorToken,
  verifySecondValidatorToken,
};
