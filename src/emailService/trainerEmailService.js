const nodemailer = require('nodemailer');
const path = require('path');

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

function buildTrainingAttachments(training) {
  const files = [
    ...(training?.media || []),
    ...(training?.quizzes || []),
  ];

  return files
    .filter(f => f?.file_path && f?.file_name)
    .map(f => ({
      filename: f.file_name,
      path: path.join(__dirname, '..', '..', String(f.file_path).replace(/^\//, '')),
    }));
}


async function sendTrainingAssignedEmail({ trainer, training, requesters }) {
  const trainerName    = trainer.display_name || trainer.first_name || trainer.email;
  const requesterNames = requesters
    .map(r => r.display_name || `${r.first_name} ${r.last_name}`)
    .join(', ');
  const deadline = formatDate(training.publication_date);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Training Assignment</title>
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
              Training Assignment
            </h1>
            <p style="margin:10px 0 0; font-size:13px; color:#1e3a5f; opacity:0.75;">
              A training request has been fully approved and is assigned to you
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 20px; font-size:15px; color:#111827; font-weight:600; line-height:1.6;">
              Hello <strong style="color:#1e3a5f;">${trainerName}</strong>,
            </p>
            <p style="margin:0 0 28px; font-size:14px; color:#1f2937; line-height:1.7;">
              A new training has been assigned to you. Please review the details below
              and begin working on it. Once completed, upload your documentation and click
              <strong>Mark as Done</strong> in the platform to send it to the owner for validation.
            </p>

            <!-- Deadline banner -->
            <div style="border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:10px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">&#x23F0; Deadline (Publication Date)</p>
              </div>
              <div style="padding:16px 20px; text-align:center; background:#f8fafc;">
                <p style="margin:0; font-size:22px; font-weight:800; color:#1e3a5f;">${deadline}</p>
                <p style="margin:6px 0 0; font-size:12px; color:#6b7280;">
                  The training must be ready and validated before this date.
                </p>
              </div>
            </div>

            <!-- Training details -->
            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:12px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">Training Details</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row('Training Title',   training.name,                        false)}
                ${row('Department',       training.department,                   true)}
                ${row('Type',             training.type_of_training,             false)}
                ${row('Requirement',      training.requirement,                  true)}
                ${row('Requested By',     requesterNames,                        false)}
                ${row('Deadline',         deadline,                              true)}
                ${row('Objectives',       training.training_objectives,          false)}
                ${row('Target Audience',  training.target_audience,              true)}
                ${row('Requested KPIs',   training.requested_kpis,               false)}
                ${training.information ? row('Additional Info', training.information, true) : ''}
              </table>
            </div>

            <p style="margin:0; font-size:13px; color:#6b7280; text-align:center;">
              For questions, please contact the HR department or your manager.
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
    to:      trainer.email,
    subject: `[AVOCarbon] Training Assignment: "${training.name}" — Deadline ${deadline}`,
    html,
    attachments: buildTrainingAttachments(training),
  });

  console.log(`📧 Training assignment email sent to ${trainer.email} for training #${training.id}`);
}

async function sendTrainerDoneEmail({ training, trainer, requesters }) {
  const trainerName    = trainer.display_name || trainer.first_name || trainer.email;
  const requesterNames = requesters
    .map(r => r.display_name || `${r.first_name} ${r.last_name}`)
    .join(', ');
  const deadline = formatDate(training.publication_date);
  const doneAt   = formatDate(new Date());

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Training Completed</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9; padding:40px 16px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0"
             style="max-width:620px; background:#ffffff; border-radius:16px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#ffffff; border-bottom:3px solid #16a34a;
                     padding:32px 40px; text-align:center;">
            <p style="margin:0 0 6px; font-size:11px; font-weight:700; letter-spacing:3px;
                      color:#1e3a5f; text-transform:uppercase;">AVOCarbon — Administration STS</p>
            <h1 style="margin:0; font-size:24px; font-weight:700; color:#1e3a5f; line-height:1.3;">
              Training Completed
            </h1>
            <p style="margin:10px 0 0; font-size:13px; color:#15803d; font-weight:600;">
              The training has been validated and marked as done
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 28px; font-size:14px; color:#1f2937; line-height:1.7;">
              <strong>${trainerName}</strong> has completed the training
              <strong>&ldquo;${training.name}&rdquo;</strong>. The owner has validated
              the training on <strong>${doneAt}</strong>.
            </p>

            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:12px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">Training Details</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row('Training Title', training.name,       false)}
                ${row('Department',     training.department, true)}
                ${row('Requested By',   requesterNames,      false)}
                ${row('Deadline',       deadline,            true)}
                ${row('Completed On',   doneAt,              false)}
                ${row('Trainer',        trainerName,         true)}
              </table>
            </div>

            <p style="margin:0; font-size:13px; color:#6b7280; text-align:center;">
              The training status has been updated to <strong>Done</strong>.
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

  const allRecipients = requesters.map(r => r.email).filter(Boolean).join(', ');

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || 'administration.STS@avocarbon.com',
    to:      allRecipients,
    subject: `[AVOCarbon] Training Completed: "${training.name}"`,
    html,
  });

  console.log(`📧 Trainer-done email sent to ${allRecipients} for training #${training.id}`);
}

module.exports = { sendTrainingAssignedEmail, sendTrainerDoneEmail };


async function sendTrainingAssignedEmail({ trainer, training, requesters }) {
  const trainerName    = trainer.display_name || trainer.first_name || trainer.email;
  const requesterNames = requesters
    .map(r => r.display_name || `${r.first_name} ${r.last_name}`)
    .join(', ');

  const deadline = formatDate(training.publication_date);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Training Assignment</title>
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
              📋 New Training Assignment
            </h1>
            <p style="margin:10px 0 0; font-size:13px; color:#1e3a5f; opacity:0.75;">
              A training request has been fully approved and is ready for you to build
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 20px; font-size:15px; color:#111827; font-weight:600; line-height:1.6;">
              Hello <strong style="color:#1e3a5f;">${trainerName}</strong>,
            </p>
            <p style="margin:0 0 28px; font-size:14px; color:#1f2937; line-height:1.7;">
              A new training has been assigned to you. Please review the details below
              and begin working on it. Once completed, click the <strong>Mark as Done</strong>
              button in the platform.
            </p>

            <!-- Deadline banner -->
            <div style="background:#fef3c7; border:1px solid #f59e0b; border-radius:10px;
                        padding:16px 20px; margin-bottom:28px; text-align:center;">
              <p style="margin:0; font-size:13px; color:#92400e; font-weight:700; letter-spacing:0.5px;
                        text-transform:uppercase;">⏰ Deadline</p>
              <p style="margin:6px 0 0; font-size:22px; font-weight:800; color:#b45309;">
                ${deadline}
              </p>
              <p style="margin:4px 0 0; font-size:12px; color:#92400e;">
                This is the publication date — the training must be ready by this date.
              </p>
            </div>

            <!-- Training details -->
            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:12px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">Training Details</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row('Training Title',   training.name,                        false)}
                ${row('Department',       training.department,                   true)}
                ${row('Type',             training.type_of_training,             false)}
                ${row('Requirement',      training.requirement,                  true)}
                ${row('Requested By',     requesterNames,                        false)}
                ${row('Deadline',         deadline,                              true)}
                ${row('Objectives',       training.training_objectives,          false)}
                ${row('Target Audience',  training.target_audience,              true)}
                ${row('Requested KPIs',   training.requested_kpis,               false)}
                ${training.information ? row('Additional Info', training.information, true) : ''}
              </table>
            </div>

            <p style="margin:0; font-size:13px; color:#6b7280; text-align:center;">
              For questions, please contact the HR department or your manager.
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
    to:      trainer.email,
    subject: `[AVOCarbon] New Training Assignment: "${training.name}" — Deadline ${deadline}`,
    html,
    attachments: buildTrainingAttachments(training),
  });

  console.log(`📧 Training assignment email sent to trainer ${trainer.email} for training #${training.id}`);
}

/**
 * Sent to requesters/supervisors when trainer marks training as done.
 */
async function sendTrainerDoneEmail({ training, trainer, requesters }) {
  const trainerName    = trainer.display_name || trainer.first_name || trainer.email;
  const requesterNames = requesters
    .map(r => r.display_name || `${r.first_name} ${r.last_name}`)
    .join(', ');

  const deadline = formatDate(training.publication_date);
  const doneAt   = formatDate(new Date());

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Training Completed</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9; padding:40px 16px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0"
             style="max-width:620px; background:#ffffff; border-radius:16px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#ffffff; border-bottom:3px solid #16a34a;
                     padding:32px 40px; text-align:center;">
            <p style="margin:0 0 6px; font-size:11px; font-weight:700; letter-spacing:3px;
                      color:#1e3a5f; text-transform:uppercase;">AVOCarbon — Administration STS</p>
            <h1 style="margin:0; font-size:24px; font-weight:700; color:#1e3a5f; line-height:1.3;">
              ✅ Training Completed
            </h1>
            <p style="margin:10px 0 0; font-size:13px; color:#15803d; font-weight:600;">
              The trainer has marked this training as done
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <p style="margin:0 0 28px; font-size:14px; color:#1f2937; line-height:1.7;">
              <strong>${trainerName}</strong> has completed the training
              <strong>&ldquo;${training.name}&rdquo;</strong> on <strong>${doneAt}</strong>.
            </p>

            <div style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:28px;">
              <div style="background:#1e3a5f; padding:12px 16px;">
                <p style="margin:0; font-size:12px; font-weight:700; letter-spacing:1px;
                          color:#93c5fd; text-transform:uppercase;">Training Details</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row('Training Title', training.name,       false)}
                ${row('Department',     training.department, true)}
                ${row('Requested By',   requesterNames,      false)}
                ${row('Deadline',       deadline,            true)}
                ${row('Completed On',   doneAt,              false)}
                ${row('Trainer',        trainerName,         true)}
              </table>
            </div>

            <p style="margin:0; font-size:13px; color:#6b7280; text-align:center;">
              The training status has been updated to <strong>Done</strong>.
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

  const allRecipients = requesters.map(r => r.email).filter(Boolean).join(', ');

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || 'administration.STS@avocarbon.com',
    to:      allRecipients,
    subject: `[AVOCarbon] ✅ Training Completed: "${training.name}"`,
    html,
  });

  console.log(`📧 Trainer-done email sent to ${allRecipients} for training #${training.id}`);
}

module.exports = { sendTrainingAssignedEmail, sendTrainerDoneEmail };
