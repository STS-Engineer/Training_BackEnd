const multer = require('multer');


function errorHandler(err, req, res, next) {
  // ── Erreurs Multer ─────────────────────────────────────────────────────────
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE:  'Fichier trop volumineux. Taille maximale autorisée : 50 Mo.',
      LIMIT_FILE_COUNT: 'Trop de fichiers envoyés.',
      LIMIT_UNEXPECTED_FILE: `Champ de fichier inattendu : "${err.field}".`,
    };
    return res.status(400).json({
      success: false,
      message: messages[err.code] || `Erreur d'upload : ${err.message}`,
      error:   messages[err.code] || `Erreur d'upload : ${err.message}`,
    });
  }

  // ── Erreurs métier avec code HTTP explicite ────────────────────────────────
  const status = err.status || err.statusCode || 500;

  if (status < 500) {
    return res.status(status).json({ success: false, message: err.message, error: err.message });
  }

  // ── Erreurs serveur ────────────────────────────────────────────────────────
  console.error('[ERROR]', err);
  return res.status(500).json({ success: false, message: 'Erreur interne du serveur.', error: 'Erreur interne du serveur.' });
}

module.exports = errorHandler;
