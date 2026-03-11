const multer = require('multer');
const path   = require('path');
const crypto = require('crypto');

const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024;

// ── MIME types autorisés par champ ────────────────────────────────────────────
const ALLOWED_MIME = {
  media: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'],
  quiz:  [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

// ── Dossiers de destination par champ ────────────────────────────────────────
const DEST_FOLDER = {
  media: 'photo-video',
  quiz:  'quiz',
};

// ── Storage : enregistrement sur disque local ─────────────────────────────────
const storage = multer.diskStorage({
  destination(_req, file, cb) {
    const folder = DEST_FOLDER[file.fieldname] || 'misc';
    cb(null, path.join(__dirname, '..', '..', 'uploads', folder));
  },
  filename(_req, file, cb) {
    const ext    = path.extname(file.originalname).toLowerCase();
    const unique = crypto.randomBytes(12).toString('hex');
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});

// ── Filtre MIME : rejet des types non autorisés ──────────────────────────────
function fileFilter(_req, file, cb) {
  const allowed = ALLOWED_MIME[file.fieldname];
  if (!allowed) {
    return cb(Object.assign(
      new Error(`Champ de fichier inconnu : "${file.fieldname}"`),
      { status: 400 }
    ));
  }
  if (!allowed.includes(file.mimetype)) {
    const msg = file.fieldname === 'quiz'
      ? 'Le fichier quiz doit être un document Word (.doc ou .docx).'
      : `Type de fichier non autorisé : ${file.mimetype}`;
    return cb(Object.assign(new Error(msg), { status: 400 }));
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });

const uploadTrainingFiles = upload.fields([
  { name: 'media', maxCount: 20 },
  { name: 'quiz',  maxCount: 5  },
]);

module.exports = { upload, uploadTrainingFiles };
