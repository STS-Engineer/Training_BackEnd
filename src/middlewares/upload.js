const multer = require('multer');
const path   = require('path');
const crypto = require('crypto');
const { isAllowedQuizMime, QUIZ_FILE_DESCRIPTION } = require('../constants/quizFiles');

const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024;

// ── MIME types autorisés par champ ────────────────────────────────────────────
const ALLOWED_MIME = {
  media:            ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'],
  quiz:             null,
  documentation:    [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  doc:              [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  revision_images:  ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
};

// ── Dossiers de destination par champ ────────────────────────────────────────────
const DEST_FOLDER = {
  media:           'photo-video',
  quiz:            'quiz',
  documentation:   'documentation',
  doc:             'documentation',
  revision_images: 'revision-images',
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
  if (file.fieldname === 'quiz') {
    return cb(null, true);
  }
  if (!allowed) {
    return cb(Object.assign(
      new Error(`Champ de fichier inconnu : "${file.fieldname}"`),
      { status: 400 }
    ));
  }
  if (!allowed.includes(file.mimetype)) {
    const msg = file.fieldname === 'quiz'
      ? QUIZ_FILE_DESCRIPTION
      : (file.fieldname === 'documentation' || file.fieldname === 'doc')
      ? 'La documentation doit être un fichier PDF ou Word (.pdf, .doc, .docx).'
      : `Type de fichier non autorisé : ${file.mimetype}`;
    return cb(Object.assign(new Error(msg), { status: 400 }));
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });

const uploadTrainingFiles = upload.fields([
  { name: 'media',         maxCount: 20 },
  { name: 'quiz',          maxCount: 5  },
]);

const uploadDocumentation = upload.fields([
  { name: 'doc', maxCount: 1 },
]);

const uploadRevisionImages = upload.fields([
  { name: 'revision_images', maxCount: 10 },
]);

module.exports = { upload, uploadTrainingFiles, uploadDocumentation, uploadRevisionImages };
