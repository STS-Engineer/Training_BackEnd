const nodemailer = require('nodemailer');

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

/**
 * @param {{ owner, training, manager, decision: 'approved'|'rejected', comment?: string, validationStep?: '1st'|'2nd' }} params
 */
async function sendTrainingResultEmail({ owner, training, manager, decision, comment, validationStep }) {
  const isApproved    = decision === 'approved';
  const accentColor   = isApproved ? '#16a34a' : '#dc2626';
  const badgeBg       = isApproved ? '#dcfce7'  : '#fee2e2';
  const badgeText     = isApproved ? '#15803d'  : '#b91c1c';
  const decisionLabel = isApproved ? 'Approved ✓' : 'Rejected ✕';
  const managerName   = manager.display_name || `${manager.first_name} ${manager.last_name}`;
  const stepLabel     = validationStep === '1st' ? '1st Validation'
                      : validationStep === '2nd' ? '2nd Validation'
                      : null;
  const isPending2nd  = isApproved && validationStep === '1st';

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Training Request Update</title>
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
            <h1 style="margin:0; font-size:24px; font-weight:700; color:#1e3a5f; line-height:1.3;">
              Training Request Update
            </h1>
            ${stepLabel ? `<p style="margin:10px 0 0; font-size:12px; font-weight:700; letter-spacing:2px;
                      color:${accentColor}; text-transform:uppercase;">${stepLabel}</p>` : ''}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 20px; font-size:15px; color:#111827; font-weight:600; line-height:1.6;">
              Hello <strong style="color:#1e3a5f;">${owner.display_name || owner.first_name}</strong>,
            </p>
            <p style="margin:0 0 24px; font-size:14px; color:#1f2937; line-height:1.7;">
              Your training request <strong>&ldquo;${training.name}&rdquo;</strong> has been reviewed
              by <strong>${managerName}</strong>${stepLabel ? ` (${stepLabel})` : ''}.
              ${isPending2nd
                ? `<br/><span style="color:#d97706; font-weight:600;">⏳ This is a pre-approval. Your request is now pending the 2nd validation.</span>`
                : ''}
            </p>

            <!-- Decision badge -->
            <div style="text-align:center; margin-bottom:28px;">
              <span style="display:inline-block; padding:10px 32px; background:${badgeBg};
                           color:${badgeText}; border-radius:50px; font-size:16px;
                           font-weight:800; border:1px solid ${accentColor};">
                ${decisionLabel}
              </span>
            </div>

            <!-- Details -->
            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:12px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">Training Details</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr style="background:#ffffff;">
                  <td style="padding:11px 16px; font-size:13px; color:#1e3a5f; font-weight:700;
                             border-bottom:1px solid #d1d5db; width:38%;">Training Title</td>
                  <td style="padding:11px 16px; font-size:13px; color:#111827; font-weight:500;
                             border-bottom:1px solid #d1d5db;">${training.name}</td>
                </tr>
                ${stepLabel ? `
                <tr style="background:#eef2f7;">
                  <td style="padding:11px 16px; font-size:13px; color:#1e3a5f; font-weight:700;
                             border-bottom:1px solid #d1d5db;">Validation Step</td>
                  <td style="padding:11px 16px; font-size:13px; font-weight:700; border-bottom:1px solid #d1d5db;
                             color:${accentColor};">${stepLabel} — ${decisionLabel}</td>
                </tr>` : ''}
                <tr style="background:#eef2f7;">
                  <td style="padding:11px 16px; font-size:13px; color:#1e3a5f; font-weight:700;
                             border-bottom:1px solid #d1d5db;">Department</td>
                  <td style="padding:11px 16px; font-size:13px; color:#111827; font-weight:500;
                             border-bottom:1px solid #d1d5db;">${training.department}</td>
                </tr>
                <tr style="background:#ffffff;">
                  <td style="padding:11px 16px; font-size:13px; color:#1e3a5f; font-weight:700;
                             border-bottom:1px solid #d1d5db;">Publication Date</td>
                  <td style="padding:11px 16px; font-size:13px; color:#111827; font-weight:500;
                             border-bottom:1px solid #d1d5db;">${formatDate(training.publication_date)}</td>
                </tr>
                <tr style="background:#eef2f7;">
                  <td style="padding:11px 16px; font-size:13px; color:#1e3a5f; font-weight:700;
                             border-bottom:1px solid #d1d5db;">Decision by</td>
                  <td style="padding:11px 16px; font-size:13px; color:#111827; font-weight:500;
                             border-bottom:1px solid #d1d5db;">${managerName}</td>
                </tr>
                ${comment ? `
                <tr style="background:#ffffff;">
                  <td style="padding:11px 16px; font-size:13px; color:#1e3a5f; font-weight:700;
                             border-bottom:1px solid #d1d5db; vertical-align:top;">Comment</td>
                  <td style="padding:11px 16px; font-size:13px; color:#111827; font-weight:500;
                             border-bottom:1px solid #d1d5db;">${comment}</td>
                </tr>` : ''}
              </table>
            </div>

            <p style="margin:0; font-size:13px; color:#6b7280; text-align:center;">
              For any questions, please contact your manager or the HR department.
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

  const subjectStep = stepLabel ? ` [${stepLabel}]` : '';
  const subjectDecision = isApproved && validationStep === '1st' ? 'Pre-Approved (Pending 2nd Validation)' : decision;

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || 'administration.STS@avocarbon.com',
    to:      owner.email,
    subject: `[AVOCarbon]${subjectStep} Your training request "${training.name}" has been ${subjectDecision}`,
    html,
  });

  console.log(`📧 Result email (${decision}${stepLabel ? ', ' + stepLabel : ''}) sent to ${owner.email}`);
}

module.exports = { sendTrainingResultEmail };
