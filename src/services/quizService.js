const path = require('path');
const fs   = require('fs');
const { Quiz, Training } = require('../models/index');
const { isAllowedQuizMime, QUIZ_FILE_DESCRIPTION } = require('../constants/quizFiles');

async function getQuizzesByTraining(trainingId) {
  await _checkTrainingExists(trainingId);
  return Quiz.findAll({
    where: { training_id: trainingId },
    order: [['created_at', 'ASC']],
  });
}

async function getQuizById(id) {
  const quiz = await Quiz.findByPk(id);
  if (!quiz) {
    const err = new Error(`Quiz #${id} introuvable.`);
    err.status = 404;
    throw err;
  }
  return quiz;
}

async function addQuizFiles(trainingId, files) {
  await _checkTrainingExists(trainingId);

  if (!files || files.length === 0) {
    const err = new Error('Aucun fichier fourni.');
    err.status = 400;
    throw err;
  }

  const created = [];
  for (const file of files) {
    if (!isAllowedQuizMime(file.mimetype)) {
      const err = new Error(`Fichier rejete : "${file.originalname}". ${QUIZ_FILE_DESCRIPTION}`);
      err.status = 400;
      throw err;
    }

    const quiz = await Quiz.create({
      training_id: trainingId,
      file_name:   file.originalname,
      file_path:   `/uploads/quiz/${file.filename}`,
      mime_type:   file.mimetype,
      file_size:   file.size,
    });
    created.push(quiz);
  }

  return created;
}

async function deleteQuiz(id) {
  const quiz = await Quiz.findByPk(id);
  if (!quiz) {
    const err = new Error(`Quiz #${id} introuvable.`);
    err.status = 404;
    throw err;
  }

  const fullPath = path.join(__dirname, '..', '..', 'uploads', 'quiz', path.basename(quiz.file_path));
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

  await quiz.destroy();
  return { message: `Quiz #${id} supprime.` };
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
  getQuizzesByTraining,
  getQuizById,
  addQuizFiles,
  deleteQuiz,
};
