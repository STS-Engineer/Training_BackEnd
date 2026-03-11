const path = require('path');
const fs   = require('fs');
const { TrainingMedia, Training } = require('../models/index');

const PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_MIME = ['video/mp4', 'video/quicktime'];
const ALLOWED_MIME = [...PHOTO_MIME, ...VIDEO_MIME];

async function getMediaByTraining(trainingId) {
  await _checkTrainingExists(trainingId);
  return TrainingMedia.findAll({
    where: { training_id: trainingId },
    order: [['created_at', 'ASC']],
  });
}

async function getPhotosByTraining(trainingId) {
  await _checkTrainingExists(trainingId);
  return TrainingMedia.findAll({
    where: { training_id: trainingId, media_type: 'photo' },
    order: [['created_at', 'ASC']],
  });
}

async function getVideosByTraining(trainingId) {
  await _checkTrainingExists(trainingId);
  return TrainingMedia.findAll({
    where: { training_id: trainingId, media_type: 'video' },
    order: [['created_at', 'ASC']],
  });
}

async function getMediaById(id) {
  const media = await TrainingMedia.findByPk(id);
  if (!media) {
    const err = new Error(`Média #${id} introuvable.`);
    err.status = 404;
    throw err;
  }
  return media;
}

async function addMediaFiles(trainingId, files) {
  await _checkTrainingExists(trainingId);

  if (!files || files.length === 0) {
    const err = new Error('Aucun fichier fourni.');
    err.status = 400;
    throw err;
  }

  const created = [];
  for (const file of files) {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      const err = new Error(
        `Fichier rejeté : "${file.originalname}". Formats acceptés : JPEG, PNG, WEBP, MP4, MOV.`
      );
      err.status = 400;
      throw err;
    }

    const media_type = PHOTO_MIME.includes(file.mimetype) ? 'photo' : 'video';

    const media = await TrainingMedia.create({
      training_id: trainingId,
      file_name:   file.originalname,
      file_path:   `/uploads/photo-video/${file.filename}`,
      mime_type:   file.mimetype,
      file_size:   file.size,
      media_type,
    });
    created.push(media);
  }
  return created;
}

async function deleteMedia(id) {
  const media = await TrainingMedia.findByPk(id);
  if (!media) {
    const err = new Error(`Média #${id} introuvable.`);
    err.status = 404;
    throw err;
  }

  const fullPath = path.join(__dirname, '..', '..', 'uploads', 'photo-video', path.basename(media.file_path));
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

  await media.destroy();
  return { message: `Média #${id} supprimé.` };
}

async function _checkTrainingExists(trainingId) {
  const training = await Training.findByPk(trainingId);
  if (!training) {
    const err = new Error(`Training #${trainingId} introuvable.`);
    err.status = 404;
    throw err;
  }
}

module.exports = {
  getMediaByTraining,
  getPhotosByTraining,
  getVideosByTraining,
  getMediaById,
  addMediaFiles,
  deleteMedia,
};
