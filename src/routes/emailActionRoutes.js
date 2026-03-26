const router  = require('express').Router();
const { verifyActionToken, verifySecondValidatorToken } = require('../emailService/approvalEmailService');
const { verifyOwnerToken } = require('../emailService/ownerValidationEmailService');
const trainingService = require('../services/trainingService');
const { CompanyMember } = require('../models/index');
const { uploadRevisionImages } = require('../middlewares/upload');

// ── Approbation via email ─────────────────────────────────────────────────────
router.get('/approve/:token', async (req, res) => {
  try {
    const { trainingId, managerId } = verifyActionToken(req.params.token);
    await trainingService.approveTraining(trainingId, managerId, null);

    return res.send(`
      <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f4f4f4;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:10px;
                    box-shadow:0 2px 8px rgba(0,0,0,.1);">
          <h2 style="color:#28a745;">✅ Training Approved</h2>
          <p>Your decision has been recorded.</p>
          <p style="color:#888;font-size:13px;">You can close this window.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    const msg = err.status ? err.message
          : err.name  === 'TokenExpiredError' ? 'This link has expired.'
          : 'Invalid link or action already taken.';
    return res.status(400).send(`
      <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f4f4f4;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:10px;
                    box-shadow:0 2px 8px rgba(0,0,0,.1);">
          <h2 style="color:#dc3545;">⚠️ Error</h2>
          <p>${msg}</p>
        </div>
      </body></html>
    `);
  }
});

// ── Formulaire de refus (GET → affiche le form) ───────────────────────────────
router.get('/reject/:token', async (req, res) => {
  try {
    verifyActionToken(req.params.token);
  } catch {
    return res.status(400).send(`
      <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f4f4f4;">
        <h2 style="color:#dc3545;">⚠️ Invalid or expired link.</h2>
      </body></html>
    `);
  }

  return res.send(`
    <html>
    <body style="font-family:Arial;background:#f4f4f4;padding:40px;">
      <div style="max-width:500px;margin:auto;background:#fff;padding:36px;
                  border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.1);">
        <h2 style="color:#dc3545;">❌ Reject Request</h2>
        <p>Please provide the reason for rejection:</p>
        <form method="POST" action="/api/email-actions/reject/${req.params.token}">
          <textarea name="comment" rows="5" required
            style="width:100%;padding:10px;font-size:14px;border:1px solid #ccc;
                   border-radius:6px;box-sizing:border-box;"
            placeholder="Explain the reason for rejection..."></textarea>
          <br/><br/>
          <button type="submit"
            style="padding:12px 32px;background:#dc3545;color:#fff;border:none;
                   border-radius:6px;font-size:15px;cursor:pointer;">
            Confirm Rejection
          </button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// ── Soumission du refus (POST → enregistre + affiche confirmation) ────────────
router.post('/reject/:token', express_urlencoded, async (req, res) => {
  try {
    const { trainingId, managerId } = verifyActionToken(req.params.token);
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).send(`
        <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f4f4f4;">
          <h2 style="color:#dc3545;">⚠️ A comment is required.</h2>
          <a href="/api/email-actions/reject/${req.params.token}">← Back</a>
        </body></html>
      `);
    }

    await trainingService.rejectTraining(trainingId, managerId, comment.trim());

    return res.send(`
      <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f4f4f4;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:10px;
                    box-shadow:0 2px 8px rgba(0,0,0,.1);">
          <h2 style="color:#dc3545;">❌ Training Rejected</h2>
          <p>Your decision has been recorded.</p>
          <p style="color:#888;font-size:13px;">You can close this window.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    const msg = err.status ? err.message
          : err.name  === 'TokenExpiredError' ? 'This link has expired.'
          : 'Invalid link or action already taken.';
    return res.status(400).send(`
      <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f4f4f4;">
        <h2 style="color:#dc3545;">⚠️ ${msg}</h2>
      </body></html>
    `);
  }
});

// Middleware urlencoded local pour parser le body du formulaire HTML
function express_urlencoded(req, res, next) {
  require('express').urlencoded({ extended: false })(req, res, next);
}

// ── Formulaire de demande de mise à jour (GET → affiche le form) ──────────────
router.get('/request-update/:token', async (req, res) => {
  try {
    verifyActionToken(req.params.token);
  } catch {
    return res.status(400).send(`
      <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f4f4f4;">
        <h2 style="color:#dc3545;">⚠️ Invalid or expired link.</h2>
      </body></html>
    `);
  }

  return res.send(`
    <html>
    <head><meta charset="UTF-8"/></head>
    <body style="font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;padding:40px;margin:0;">
      <div style="max-width:520px;margin:auto;background:#fff;padding:36px 40px;
                  border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:3px;
                  color:#1e3a5f;text-transform:uppercase;">AVOCarbon — Administration STS</p>
        <h2 style="margin:8px 0 6px;color:#1e3a5f;font-size:20px;">✎ Request Training Update</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
          Please describe the changes you require before you can approve this training request.
        </p>
        <form method="POST" action="/api/email-actions/request-update/${req.params.token}">
          <label style="display:block;font-size:13px;font-weight:600;color:#1e3a5f;margin-bottom:6px;">
            Your comment / required updates
          </label>
          <textarea name="comment" rows="6" required
            style="width:100%;padding:10px 12px;font-size:14px;color:#111827;
                   border:1px solid #d1d5db;border-radius:8px;box-sizing:border-box;
                   resize:vertical;line-height:1.6;"
            placeholder="Describe what needs to be updated..."></textarea>
          <br/><br/>
          <button type="submit"
            style="padding:10px 28px;background:#1e3a5f;color:#fff;border:none;
                   border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;">
            ✎ &nbsp;Send Update Request
          </button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// ── Soumission de la demande de mise à jour ───────────────────────────────────
router.post('/request-update/:token', express_urlencoded, async (req, res) => {
  try {
    const { trainingId, managerId } = verifyActionToken(req.params.token);
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).send(`
        <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f4f4f4;">
          <h2 style="color:#dc3545;">⚠️ A comment is required.</h2>
          <a href="/api/email-actions/request-update/${req.params.token}">← Back</a>
        </body></html>
      `);
    }

    await trainingService.requestUpdateTraining(trainingId, managerId, comment.trim());

    return res.send(`
      <html>
      <head><meta charset="UTF-8"/></head>
      <body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:60px;background:#f1f5f9;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:16px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <p style="margin:0 0 4px;font-size:11px;color:#1e3a5f;font-weight:700;letter-spacing:2px;
                    text-transform:uppercase;">AVOCarbon — Administration STS</p>
          <h2 style="color:#1e3a5f;margin:12px 0 8px;">✎ Update Request Sent</h2>
          <p style="color:#374151;font-size:14px;">
            The training requester has been notified and will update their request.<br/>
            You will receive a new review email once they re-submit.
          </p>
          <p style="color:#9ca3af;font-size:12px;margin-top:20px;">You can close this window.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    const msg = err.status ? err.message
          : err.name  === 'TokenExpiredError' ? 'This link has expired.'
          : 'Invalid link or action already taken.';
    return res.status(400).send(`
      <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f4f4f4;">
        <h2 style="color:#dc3545;">⚠️ ${msg}</h2>
      </body></html>
    `);
  }
});

// ── Second validator: Approve — show trainer selection form ───────────────────
router.get('/second-approve/:token', async (req, res) => {
  try {
    verifySecondValidatorToken(req.params.token);
  } catch {
    return res.status(400).send(`
      <html><head><meta charset="UTF-8"/></head>
      <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
        <h2 style="color:#dc3545;">⚠️ Invalid or expired link.</h2>
      </body></html>
    `);
  }

  let members = [];
  try {
    members = await CompanyMember.findAll({
      attributes: ['id', 'first_name', 'last_name', 'display_name', 'email'],
      order: [['first_name', 'ASC'], ['last_name', 'ASC']],
    });
  } catch (e) {
    console.error('❌ Could not fetch members for trainer selection:', e.message);
  }

  const options = members.map(m => {
    const label = m.display_name || `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email;
    return `<option value="${m.id}">${label} (${m.email || '—'})</option>`;
  }).join('\n');

  return res.send(`
    <html>
    <head>
      <meta charset="UTF-8"/>
      <title>Assign Trainer &amp; Approve</title>
      <style>
        *, *::before, *::after { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 40px 16px; }
        .card { max-width: 540px; margin: 0 auto; background: #fff; border-radius: 14px;
                box-shadow: 0 4px 24px rgba(0,0,0,.08); }
        .header { background: #fff; border-bottom: 3px solid #1e3a5f; padding: 28px 36px; text-align: center;
                  border-radius: 14px 14px 0 0; }
        .header p  { margin: 0 0 4px; font-size: 11px; font-weight: 700; letter-spacing: 3px;
                     color: #1e3a5f; text-transform: uppercase; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; color: #1e3a5f; }
        .body { padding: 32px 36px; }
        label { display: block; font-size: 13px; font-weight: 700; color: #1e3a5f;
                text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .combo-wrap { position: relative; }
        .combo-input {
          width: 100%; padding: 11px 40px 11px 14px; font-size: 14px; color: #111827;
          border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb;
          outline: none; cursor: text; transition: border-color .15s, box-shadow .15s;
        }
        .combo-input:focus { border-color: #1e3a5f; box-shadow: 0 0 0 3px rgba(30,58,95,.15); background:#fff; }
        .combo-input.selected { border-color: #16a34a; background: #f0fdf4; color: #15803d; font-weight: 600; }
        .combo-arrow {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          pointer-events: none; color: #9ca3af; font-size: 12px;
        }
        .combo-dropdown {
          display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: #fff; border: 1px solid #d1d5db; border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,.12); max-height: 240px; overflow-y: auto;
          z-index: 99;
        }
        .combo-dropdown.open { display: block; }
        .combo-option {
          padding: 10px 14px; font-size: 14px; color: #111827; cursor: pointer;
          border-bottom: 1px solid #f3f4f6; line-height: 1.4;
        }
        .combo-option:last-child { border-bottom: none; }
        .combo-option:hover, .combo-option.active { background: #eef2f7; color: #1e3a5f; }
        .combo-option .email { font-size: 12px; color: #6b7280; }
        .combo-option.no-result { color: #9ca3af; font-style: italic; cursor: default; }
        .combo-option.no-result:hover { background: transparent; }
        .btn { display: block; width: 100%; margin-top: 24px; padding: 12px;
               background: #16a34a; color: #fff; font-size: 15px; font-weight: 700;
               border: none; border-radius: 8px; cursor: pointer; letter-spacing: 0.3px; }
        .btn:hover { background: #15803d; }
        .btn:disabled { background: #d1d5db; cursor: not-allowed; }
        .footer { background: #f8fafc; border-top: 1px solid #e5e7eb; padding: 16px 36px;
                  text-align: center; font-size: 11px; color: #9ca3af;
                  border-radius: 0 0 14px 14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <p>AVOCarbon — Administration STS</p>
          <h1>Assign Trainer &amp; Approve</h1>
        </div>
        <div class="body">
          <p style="margin:0 0 24px; font-size:14px; color:#374151; line-height:1.7;">
            Please select the person who will be responsible for delivering this training,
            then confirm your approval.
          </p>
          <form method="POST" action="/api/email-actions/second-approve/${req.params.token}" id="approveForm">
            <input type="hidden" name="trainer_id" id="trainer_id_hidden"/>
            <label for="combo_input">Assign Trainer</label>
            <div class="combo-wrap">
              <input type="text" id="combo_input" class="combo-input"
                     placeholder="Search by name or email…" autocomplete="off" required/>
              <span class="combo-arrow">&#9660;</span>
              <div class="combo-dropdown" id="combo_dropdown"></div>
            </div>
            <button type="submit" class="btn" id="submit_btn" disabled>✅ &nbsp;Approve &amp; Assign</button>
          </form>
        </div>
        <div class="footer">
          AVOCarbon — Administration STS &nbsp;|&nbsp; Automated notification.
        </div>
      </div>
      <script>
        const members = ${JSON.stringify(members.map(m => ({
          id:    m.id,
          name:  m.display_name || ((m.first_name || '') + ' ' + (m.last_name || '')).trim() || m.email,
          email: m.email || '',
        })))};

        const input    = document.getElementById('combo_input');
        const dropdown = document.getElementById('combo_dropdown');
        const hidden   = document.getElementById('trainer_id_hidden');
        const btn      = document.getElementById('submit_btn');
        let activeIdx  = -1;

        function renderList(q) {
          const filtered = q
            ? members.filter(m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
            : members;
          dropdown.innerHTML = '';
          activeIdx = -1;
          if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="combo-option no-result">No results found</div>';
          } else {
            filtered.forEach((m, i) => {
              const div = document.createElement('div');
              div.className = 'combo-option';
              div.dataset.id   = m.id;
              div.dataset.name = m.name;
              div.dataset.idx  = i;
              div.innerHTML    = m.name + (m.email ? '<br/><span class="email">' + m.email + '</span>' : '');
              div.addEventListener('mousedown', e => { e.preventDefault(); selectMember(m); });
              dropdown.appendChild(div);
            });
          }
        }

        function selectMember(m) {
          input.value    = m.name + (m.email ? ' (' + m.email + ')' : '');
          hidden.value   = m.id;
          input.classList.add('selected');
          btn.disabled   = false;
          closeDropdown();
        }

        function openDropdown() {
          renderList(input.value.toLowerCase().trim());
          dropdown.classList.add('open');
        }

        function closeDropdown() {
          dropdown.classList.remove('open');
          activeIdx = -1;
        }

        input.addEventListener('focus', openDropdown);
        input.addEventListener('input', () => {
          input.classList.remove('selected');
          hidden.value = '';
          btn.disabled = true;
          renderList(input.value.toLowerCase().trim());
          dropdown.classList.add('open');
        });
        input.addEventListener('blur', () => setTimeout(closeDropdown, 150));

        input.addEventListener('keydown', e => {
          const items = dropdown.querySelectorAll('.combo-option:not(.no-result)');
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIdx = Math.min(activeIdx + 1, items.length - 1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIdx = Math.max(activeIdx - 1, 0);
          } else if (e.key === 'Enter' && activeIdx >= 0) {
            e.preventDefault();
            items[activeIdx] && items[activeIdx].dispatchEvent(new MouseEvent('mousedown'));
          } else if (e.key === 'Escape') {
            closeDropdown();
          } else { return; }
          items.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
          if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
        });

        document.getElementById('approveForm').addEventListener('submit', e => {
          if (!hidden.value) { e.preventDefault(); input.focus(); }
        });
      </script>
    </body>
    </html>
  `);
});

// ── Second validator: Approve — process form submission ───────────────────────
router.post('/second-approve/:token', async (req, res) => {
  try {
    const { trainingId } = verifySecondValidatorToken(req.params.token);
    const trainerId = parseInt(req.body.trainer_id, 10);
    if (!trainerId) {
      return res.status(400).send(`
        <html><head><meta charset="UTF-8"/></head>
        <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
          <h2 style="color:#dc3545;">⚠️ Please select a trainer before submitting.</h2>
        </body></html>
      `);
    }
    await trainingService.secondApproveTraining(trainingId, trainerId);

    return res.send(`
      <html><head><meta charset="UTF-8"/></head>
      <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:10px;
                    box-shadow:0 2px 8px rgba(0,0,0,.1);">
          <h2 style="color:#16a34a;">✅ Training Fully Approved</h2>
          <p>Your final approval has been recorded and the trainer has been notified.</p>
          <p style="color:#888;font-size:13px;">You can close this window.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    const msg = err.status ? err.message
          : err.name  === 'TokenExpiredError' ? 'This link has expired.'
          : 'Invalid link or action already taken.';
    return res.status(err.status || 400).send(`
      <html><head><meta charset="UTF-8"/></head>
      <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:10px;
                    box-shadow:0 2px 8px rgba(0,0,0,.1);">
          <h2 style="color:#dc3545;">⚠️ Error</h2><p>${msg}</p>
        </div>
      </body></html>
    `);
  }
});

// ── Second validator: Reject form (GET) ───────────────────────────────────────
router.get('/second-reject/:token', async (req, res) => {
  try {
    verifySecondValidatorToken(req.params.token);
  } catch {
    return res.status(400).send(`
      <html><head><meta charset="UTF-8"/></head>
      <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
        <h2 style="color:#dc3545;">⚠️ Invalid or expired link.</h2>
      </body></html>
    `);
  }

  return res.send(`
    <html>
    <head><meta charset="UTF-8"/></head>
    <body style="font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;padding:40px;margin:0;">
      <div style="max-width:500px;margin:auto;background:#fff;padding:36px;
                  border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.1);">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:3px;
                  color:#1e3a5f;text-transform:uppercase;">AVOCarbon — Administration STS</p>
        <h2 style="color:#dc2626;">❌ Reject Training Request</h2>
        <p>Please provide the reason for rejection:</p>
        <form method="POST" action="/api/email-actions/second-reject/${req.params.token}">
          <textarea name="comment" rows="5" required
            style="width:100%;padding:10px;font-size:14px;border:1px solid #ccc;
                   border-radius:6px;box-sizing:border-box;"
            placeholder="Explain the reason for rejection..."></textarea>
          <br/><br/>
          <button type="submit"
            style="padding:10px 28px;background:#dc2626;color:#fff;border:none;
                   border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;">
            Confirm Rejection
          </button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// ── Second validator: Reject submit (POST) ────────────────────────────────────
router.post('/second-reject/:token', express_urlencoded, async (req, res) => {
  try {
    const { trainingId } = verifySecondValidatorToken(req.params.token);
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).send(`
        <html><head><meta charset="UTF-8"/></head>
        <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
          <h2 style="color:#dc3545;">⚠️ A comment is required.</h2>
          <a href="/api/email-actions/second-reject/${req.params.token}">← Back</a>
        </body></html>
      `);
    }

    await trainingService.secondRejectTraining(trainingId, comment.trim());

    return res.send(`
      <html><head><meta charset="UTF-8"/></head>
      <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:10px;
                    box-shadow:0 2px 8px rgba(0,0,0,.1);">
          <h2 style="color:#dc2626;">❌ Training Rejected</h2>
          <p>Your decision has been recorded. The requester will be notified.</p>
          <p style="color:#888;font-size:13px;">You can close this window.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    const msg = err.status ? err.message
          : err.name  === 'TokenExpiredError' ? 'This link has expired.'
          : 'Invalid link or action already taken.';
    return res.status(400).send(`
      <html><head><meta charset="UTF-8"/></head>
      <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
        <h2 style="color:#dc3545;">⚠️ ${msg}</h2>
      </body></html>
    `);
  }
});

// ── Second validator: Request Update form (GET) ───────────────────────────────
router.get('/second-request-update/:token', async (req, res) => {
  try {
    verifySecondValidatorToken(req.params.token);
  } catch {
    return res.status(400).send(`
      <html><head><meta charset="UTF-8"/></head>
      <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
        <h2 style="color:#dc3545;">⚠️ Invalid or expired link.</h2>
      </body></html>
    `);
  }

  return res.send(`
    <html>
    <head><meta charset="UTF-8"/></head>
    <body style="font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;padding:40px;margin:0;">
      <div style="max-width:520px;margin:auto;background:#fff;padding:36px 40px;
                  border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:3px;
                  color:#1e3a5f;text-transform:uppercase;">AVOCarbon — Administration STS</p>
        <h2 style="margin:8px 0 6px;color:#1e3a5f;font-size:20px;">✎ Request Training Update</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
          Please describe the changes you require before you can approve this training request.
        </p>
        <form method="POST" action="/api/email-actions/second-request-update/${req.params.token}">
          <label style="display:block;font-size:13px;font-weight:600;color:#1e3a5f;margin-bottom:6px;">
            Your comment / required updates
          </label>
          <textarea name="comment" rows="6" required
            style="width:100%;padding:10px 12px;font-size:14px;color:#111827;
                   border:1px solid #d1d5db;border-radius:8px;box-sizing:border-box;
                   resize:vertical;line-height:1.6;"
            placeholder="Describe what needs to be updated..."></textarea>
          <br/><br/>
          <button type="submit"
            style="padding:10px 28px;background:#1e3a5f;color:#fff;border:none;
                   border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;">
            ✎ &nbsp;Send Update Request
          </button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// ── Second validator: Request Update submit (POST) ────────────────────────────
router.post('/second-request-update/:token', express_urlencoded, async (req, res) => {
  try {
    const { trainingId } = verifySecondValidatorToken(req.params.token);
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).send(`
        <html><head><meta charset="UTF-8"/></head>
        <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
          <h2 style="color:#dc3545;">⚠️ A comment is required.</h2>
          <a href="/api/email-actions/second-request-update/${req.params.token}">← Back</a>
        </body></html>
      `);
    }

    await trainingService.secondRequestUpdateTraining(trainingId, comment.trim());

    return res.send(`
      <html>
      <head><meta charset="UTF-8"/></head>
      <body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:60px;background:#f1f5f9;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:16px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <p style="margin:0 0 4px;font-size:11px;color:#1e3a5f;font-weight:700;letter-spacing:2px;
                    text-transform:uppercase;">AVOCarbon — Administration STS</p>
          <h2 style="color:#1e3a5f;margin:12px 0 8px;">✎ Update Request Sent</h2>
          <p style="color:#374151;font-size:14px;">
            The training requester has been notified and will update their request.<br/>
            You will receive a new review email once they re-submit.
          </p>
          <p style="color:#9ca3af;font-size:12px;margin-top:20px;">You can close this window.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    const msg = err.status ? err.message
          : err.name  === 'TokenExpiredError' ? 'This link has expired.'
          : 'Invalid link or action already taken.';
    return res.status(400).send(`
      <html><head><meta charset="UTF-8"/></head>
      <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
        <h2 style="color:#dc3545;">⚠️ ${msg}</h2>
      </body></html>
    `);
  }
});

// ── Owner: Accept training (GET) ──────────────────────────────────────────────
router.get('/owner-accept/:token', async (req, res) => {
  try {
    const { trainingId } = verifyOwnerToken(req.params.token);
    await trainingService.ownerAcceptTraining(trainingId);

    return res.send(`
      <html><head><meta charset="UTF-8"/></head>
      <body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:60px;background:#f1f5f9;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:16px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <p style="margin:0 0 4px;font-size:11px;color:#1e3a5f;font-weight:700;letter-spacing:2px;
                    text-transform:uppercase;">AVOCarbon — Administration STS</p>
          <h2 style="color:#16a34a;margin:12px 0 8px;">✅ Training Accepted</h2>
          <p style="color:#374151;font-size:14px;">
            You have validated the training. The trainer has been notified.
          </p>
          <p style="color:#9ca3af;font-size:12px;margin-top:20px;">You can close this window.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    const msg = err.status ? err.message
          : err.name  === 'TokenExpiredError' ? 'This link has expired.'
          : 'Invalid link or action already taken.';
    return res.status(400).send(`
      <html><head><meta charset="UTF-8"/></head>
      <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:10px;
                    box-shadow:0 2px 8px rgba(0,0,0,.1);">
          <h2 style="color:#dc3545;">⚠️ Error</h2><p>${msg}</p>
        </div>
      </body></html>
    `);
  }
});

// ── Owner: Request revision form (GET) ────────────────────────────────────────
router.get('/owner-request-revision/:token', async (req, res) => {
  try {
    verifyOwnerToken(req.params.token);
  } catch {
    return res.status(400).send(`
      <html><head><meta charset="UTF-8"/></head>
      <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
        <h2 style="color:#dc3545;">⚠️ Invalid or expired link.</h2>
      </body></html>
    `);
  }

  return res.send(`
    <html>
    <head>
      <meta charset="UTF-8"/>
      <title>Request Modifications</title>
      <style>
        *, *::before, *::after { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 40px 16px; }
        .card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px;
                box-shadow: 0 4px 24px rgba(0,0,0,.08); overflow: hidden; }
        .header { background: #fff; border-bottom: 3px solid #d97706; padding: 28px 36px; text-align: center; }
        .header p  { margin: 0 0 4px; font-size: 11px; font-weight: 700; letter-spacing: 3px;
                     color: #1e3a5f; text-transform: uppercase; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; color: #d97706; }
        .body { padding: 30px 36px; }
        label.field-label { display: block; font-size: 12px; font-weight: 800; letter-spacing: 1px;
                            color: #1e3a5f; text-transform: uppercase; margin-bottom: 8px; }
        textarea {
          width: 100%; padding: 12px 14px; font-size: 14px; color: #111827; font-family: inherit;
          border: 1.5px solid #d1d5db; border-radius: 10px; resize: vertical; line-height: 1.65;
          background: #f9fafb; transition: border-color .15s, box-shadow .15s;
        }
        textarea:focus { outline: none; border-color: #d97706; box-shadow: 0 0 0 3px rgba(217,119,6,.15); background:#fff; }
        .upload-zone {
          border: 2px dashed #d1d5db; border-radius: 12px; padding: 24px 16px;
          text-align: center; background: #f9fafb; cursor: pointer; transition: border-color .2s, background .2s;
          position: relative;
        }
        .upload-zone:hover, .upload-zone.drag { border-color: #d97706; background: #fffbeb; }
        .upload-zone input[type=file] { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .upload-icon { font-size: 32px; margin-bottom: 8px; }
        .upload-zone p { margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5; }
        .upload-zone strong { color: #1e3a5f; }
        #previews { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
        .preview-thumb { position: relative; display: inline-block; }
        .preview-thumb img { width: 80px; height: 80px; object-fit: cover; border-radius: 8px;
                             border: 2px solid #e5e7eb; display: block; }
        .preview-thumb button {
          position: absolute; top: -6px; right: -6px; background: #ef4444; color: #fff;
          border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px;
          cursor: pointer; line-height: 1; padding: 0; font-weight: 700;
        }
        .btn {
          display: block; width: 100%; margin-top: 24px; padding: 13px;
          background: #d97706; color: #fff; font-size: 15px; font-weight: 700;
          border: none; border-radius: 10px; cursor: pointer; letter-spacing: 0.3px;
          transition: background .15s;
        }
        .btn:hover { background: #b45309; }
        .footer { background: #f8fafc; border-top: 1px solid #e5e7eb; padding: 14px 36px;
                  text-align: center; font-size: 11px; color: #9ca3af; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <p>AVOCarbon — Administration STS</p>
          <h1>✎ Request Modifications</h1>
        </div>
        <div class="body">
          <p style="margin:0 0 24px; font-size:14px; color:#374151; line-height:1.7;">
            Please describe the changes required and optionally attach reference images
            to illustrate what needs to be revised.
          </p>

          <form method="POST" action="/api/email-actions/owner-request-revision/${req.params.token}"
                enctype="multipart/form-data" id="revForm">

            <!-- Comment -->
            <label class="field-label" for="comment">Your comments / required modifications</label>
            <textarea name="comment" id="comment" rows="6" required
              placeholder="Describe what needs to be revised..."></textarea>

            <!-- Image upload -->
            <label class="field-label" style="margin-top:20px;">
              Reference Images <span style="font-weight:400;color:#9ca3af;text-transform:none;">(optional, max 10)</span>
            </label>
            <div class="upload-zone" id="dropZone">
              <input type="file" name="revision_images" id="imageInput"
                     accept="image/jpeg,image/png,image/webp,image/gif" multiple/>
              <div class="upload-icon">🖼️</div>
              <p><strong>Click to select</strong> or drag &amp; drop images here</p>
              <p style="font-size:12px;margin-top:4px;">JPG · PNG · WebP · GIF — up to 10 files</p>
            </div>
            <div id="previews"></div>

            <button type="submit" class="btn">✎ &nbsp;Send Revision Request</button>
          </form>
        </div>
        <div class="footer">AVOCarbon — Administration STS &nbsp;|&nbsp; Automated notification.</div>
      </div>

      <script>
        const input    = document.getElementById('imageInput');
        const previews = document.getElementById('previews');
        const zone     = document.getElementById('dropZone');
        let dataTransfer = new DataTransfer();

        function renderPreviews() {
          previews.innerHTML = '';
          Array.from(dataTransfer.files).forEach((file, i) => {
            const url   = URL.createObjectURL(file);
            const wrap  = document.createElement('div');
            wrap.className = 'preview-thumb';
            wrap.innerHTML = '<img src="' + url + '" alt="' + file.name + '"/>'
                           + '<button type="button" data-i="' + i + '">✕</button>';
            previews.appendChild(wrap);
          });
          input.files = dataTransfer.files;
        }

        input.addEventListener('change', () => {
          Array.from(input.files).forEach(f => {
            if (dataTransfer.files.length < 10) dataTransfer.items.add(f);
          });
          renderPreviews();
        });

        previews.addEventListener('click', e => {
          if (e.target.tagName === 'BUTTON') {
            const idx = parseInt(e.target.dataset.i, 10);
            const newDT = new DataTransfer();
            Array.from(dataTransfer.files).forEach((f, i) => { if (i !== idx) newDT.items.add(f); });
            dataTransfer = newDT;
            renderPreviews();
          }
        });

        zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
        zone.addEventListener('drop', e => {
          e.preventDefault(); zone.classList.remove('drag');
          Array.from(e.dataTransfer.files).forEach(f => {
            if (f.type.startsWith('image/') && dataTransfer.files.length < 10) dataTransfer.items.add(f);
          });
          renderPreviews();
        });
      </script>
    </body>
    </html>
  `);
});

// ── Owner: Request revision submit (POST) ─────────────────────────────────────
router.post('/owner-request-revision/:token', uploadRevisionImages, async (req, res) => {
  try {
    const { trainingId } = verifyOwnerToken(req.params.token);
    const comment = req.body?.comment;
    const imageFiles = req.files?.revision_images || [];

    if (!comment || !comment.trim()) {
      return res.status(400).send(`
        <html><head><meta charset="UTF-8"/></head>
        <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
          <h2 style="color:#dc3545;">⚠️ A comment is required.</h2>
          <a href="/api/email-actions/owner-request-revision/${req.params.token}">← Back</a>
        </body></html>
      `);
    }

    await trainingService.ownerRequestRevision(trainingId, comment.trim(), imageFiles);

    return res.send(`
      <html>
      <head><meta charset="UTF-8"/></head>
      <body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:60px;background:#f1f5f9;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:16px;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <p style="margin:0 0 4px;font-size:11px;color:#1e3a5f;font-weight:700;letter-spacing:2px;
                    text-transform:uppercase;">AVOCarbon — Administration STS</p>
          <h2 style="color:#d97706;margin:12px 0 8px;">✎ Revision Request Sent</h2>
          <p style="color:#374151;font-size:14px;">
            The trainer has been notified and will revise the training.<br/>
            You will receive a new validation email once the corrections are made.
          </p>
          <p style="color:#9ca3af;font-size:12px;margin-top:20px;">You can close this window.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    const msg = err.status ? err.message
          : err.name  === 'TokenExpiredError' ? 'This link has expired.'
          : 'Invalid link or action already taken.';
    return res.status(400).send(`
      <html><head><meta charset="UTF-8"/></head>
      <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
        <h2 style="color:#dc3545;">⚠️ ${msg}</h2>
      </body></html>
    `);
  }
});

module.exports = router;
