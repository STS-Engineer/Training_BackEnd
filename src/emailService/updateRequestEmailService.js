const nodemailer = require('nodemailer');

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

/**
 * @param {{ owner, training, manager, comment: string }} params
 */
async function sendUpdateRequestEmail({ owner, training, manager, comment }) {
  const managerName = manager.display_name || `${manager.first_name} ${manager.last_name}`;
  const frontendUrl = process.env.FRONTEND_URL;
  const editUrl     = `${frontendUrl}/training/edit/${training.id}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Update Required for Your Training Request</title>
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
              Update Required
            </h1>
            <p style="margin:10px 0 0; font-size:13px; color:#92400e;">
              Your training request needs to be revised before it can be approved
            </p>
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
              by <strong>${managerName}</strong>, who is requesting some updates before giving approval.
            </p>

            <!-- Manager comment box -->
            <div style="background:#fffbeb; border-left:4px solid #d97706; border-radius:0 8px 8px 0;
                        padding:16px 20px; margin-bottom:28px;">
              <p style="margin:0 0 6px; font-size:12px; font-weight:700; color:#92400e;
                        text-transform:uppercase; letter-spacing:1px;">Manager's Comment</p>
              <p style="margin:0; font-size:14px; color:#111827; line-height:1.7;">${comment}</p>
            </div>

            <!-- Training info -->
            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:12px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">Training Reference</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr style="background:#ffffff;">
                  <td style="padding:11px 16px; font-size:13px; color:#1e3a5f; font-weight:700;
                             border-bottom:1px solid #d1d5db; width:38%;">Title</td>
                  <td style="padding:11px 16px; font-size:13px; color:#111827; font-weight:500;
                             border-bottom:1px solid #d1d5db;">${training.name}</td>
                </tr>
                <tr style="background:#eef2f7;">
                  <td style="padding:11px 16px; font-size:13px; color:#1e3a5f; font-weight:700;
                             border-bottom:1px solid #d1d5db;">Department</td>
                  <td style="padding:11px 16px; font-size:13px; color:#111827; font-weight:500;
                             border-bottom:1px solid #d1d5db;">${training.department}</td>
                </tr>
                <tr style="background:#ffffff;">
                  <td style="padding:11px 16px; font-size:13px; color:#1e3a5f; font-weight:700;">
                    Requested by</td>
                  <td style="padding:11px 16px; font-size:13px; color:#111827; font-weight:500;">
                    ${managerName}</td>
                </tr>
              </table>
            </div>

            <!-- CTA button -->
            <p style="margin:0 0 20px; font-size:14px; color:#111827; font-weight:700; text-align:center;">
              Please update your training request:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${editUrl}"
                     style="display:inline-block; padding:11px 36px; background:#1e3a5f;
                            color:#ffffff; text-decoration:none; border-radius:6px;
                            font-size:13px; font-weight:700; letter-spacing:0.4px;
                            border:1px solid #1e3a5f;">
                    ✎ &nbsp;Update My Training Request
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:20px 0 0; font-size:12px; color:#6b7280; text-align:center; font-weight:500;">
              Once you submit your updates, ${managerName} will automatically receive a new review email.
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
    from:    process.env.SMTP_FROM,
    to:      owner.email,
    subject: `[AVOCarbon] Update Required: "${training.name}"`,
    html,
  });

  console.log(`📧 Update request email sent to ${owner.email}`);
}

module.exports = { sendUpdateRequestEmail };
