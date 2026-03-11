/**
 * emailActionRoutes.js
 * Routes GET accessibles depuis les boutons d'email (approve / reject / request-update).
 * Le token JWT encode { trainingId, managerId }.
 */
const router  = require('express').Router();
const { verifyActionToken, verifySecondValidatorToken } = require('../emailService/approvalEmailService');
const trainingService = require('../services/trainingService');

// ── Approbation via email ─────────────────────────────────────────────────────
router.get('/approve/:token', async (req, res) => {
  try {
    const { trainingId, managerId } = verifyActionToken(req.params.token);
    await trainingService.approveTraining(trainingId, managerId, null);

    return res.send(`
      <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f4f4f4;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:10px;
                    box-shadow:0 2px 8px rgba(0,0,0,.1);">
          <h2 style="color:#28a745;">✅ Formation approuvée</h2>
          <p>Votre décision a bien été enregistrée.</p>
          <p style="color:#888;font-size:13px;">Vous pouvez fermer cette fenêtre.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    const msg = err.status === 400 ? err.message
              : err.name  === 'TokenExpiredError' ? 'Ce lien a expiré.'
              : 'Lien invalide ou action déjà effectuée.';
    return res.status(400).send(`
      <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f4f4f4;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:10px;
                    box-shadow:0 2px 8px rgba(0,0,0,.1);">
          <h2 style="color:#dc3545;">⚠️ Erreur</h2>
          <p>${msg}</p>
        </div>
      </body></html>
    `);
  }
});

// ── Formulaire de refus (GET → affiche le form) ───────────────────────────────
router.get('/reject/:token', async (req, res) => {
  try {
    verifyActionToken(req.params.token); // valide le token avant d'afficher le form
  } catch {
    return res.status(400).send(`
      <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f4f4f4;">
        <h2 style="color:#dc3545;">⚠️ Lien invalide ou expiré.</h2>
      </body></html>
    `);
  }

  return res.send(`
    <html>
    <body style="font-family:Arial;background:#f4f4f4;padding:40px;">
      <div style="max-width:500px;margin:auto;background:#fff;padding:36px;
                  border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.1);">
        <h2 style="color:#dc3545;">❌ Refuser la demande</h2>
        <p>Veuillez indiquer la raison du refus :</p>
        <form method="POST" action="/api/email-actions/reject/${req.params.token}">
          <textarea name="comment" rows="5" required
            style="width:100%;padding:10px;font-size:14px;border:1px solid #ccc;
                   border-radius:6px;box-sizing:border-box;"
            placeholder="Expliquez la raison du refus..."></textarea>
          <br/><br/>
          <button type="submit"
            style="padding:12px 32px;background:#dc3545;color:#fff;border:none;
                   border-radius:6px;font-size:15px;cursor:pointer;">
            Confirmer le refus
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
          <h2 style="color:#dc3545;">⚠️ Le commentaire est obligatoire.</h2>
          <a href="/api/email-actions/reject/${req.params.token}">← Retour</a>
        </body></html>
      `);
    }

    await trainingService.rejectTraining(trainingId, managerId, comment.trim());

    return res.send(`
      <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f4f4f4;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:10px;
                    box-shadow:0 2px 8px rgba(0,0,0,.1);">
          <h2 style="color:#dc3545;">❌ Formation refusée</h2>
          <p>Votre décision a bien été enregistrée.</p>
          <p style="color:#888;font-size:13px;">Vous pouvez fermer cette fenêtre.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    const msg = err.status === 400 ? err.message
              : err.name  === 'TokenExpiredError' ? 'Ce lien a expiré.'
              : 'Lien invalide ou action déjà effectuée.';
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
        <h2 style="color:#dc3545;">⚠️ Lien invalide ou expiré.</h2>
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
          <h2 style="color:#dc3545;">⚠️ Le commentaire est obligatoire.</h2>
          <a href="/api/email-actions/request-update/${req.params.token}">← Retour</a>
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
    const msg = err.status === 400 ? err.message
              : err.name  === 'TokenExpiredError' ? 'Ce lien a expiré.'
              : 'Lien invalide ou action déjà effectuée.';
    return res.status(400).send(`
      <html><body style="font-family:Arial;text-align:center;padding:60px;background:#f4f4f4;">
        <h2 style="color:#dc3545;">⚠️ ${msg}</h2>
      </body></html>
    `);
  }
});

// ── Second validator: Approve ─────────────────────────────────────────────────
router.get('/second-approve/:token', async (req, res) => {
  try {
    const { trainingId } = verifySecondValidatorToken(req.params.token);
    await trainingService.secondApproveTraining(trainingId);

    return res.send(`
      <html><head><meta charset="UTF-8"/></head>
      <body style="font-family:Arial;text-align:center;padding:60px;background:#f1f5f9;">
        <div style="display:inline-block;background:#fff;padding:40px 60px;border-radius:10px;
                    box-shadow:0 2px 8px rgba(0,0,0,.1);">
          <h2 style="color:#16a34a;">✅ Training Fully Approved</h2>
          <p>Your final approval has been recorded. The requester will be notified.</p>
          <p style="color:#888;font-size:13px;">You can close this window.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    const msg = err.status === 400 ? err.message
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
    const msg = err.status === 400 ? err.message
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
    const msg = err.status === 400 ? err.message
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
