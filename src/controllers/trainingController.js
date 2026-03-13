const trainingService = require('../services/trainingService');

const markTrainingDone = async (req, res, next) => {
  try {
    console.log('markTrainingDone endpoint hit with training ID:', req.params.id);
    const docFile = req.files?.documentation?.[0] || req.files?.doc?.[0] || null;
    const link = req.body?.link && String(req.body.link).trim() ? String(req.body.link).trim() : null;
    const description_done = req.body?.description_done && String(req.body.description_done).trim()
      ? String(req.body.description_done).trim()
      : null;

    console.log('Documentation file received:', docFile ? docFile.originalname : 'None');
    const data = await trainingService.markTrainingDone(parseInt(req.params.id, 10), docFile, {
      link,
      description_done,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const createTraining = async (req, res, next) => {
  try {
    const mediaFiles = req.files?.media || [];
    const quizFiles  = req.files?.quiz  || [];
    const data = await trainingService.createTraining(req.body, mediaFiles, quizFiles);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

const getAllTrainings = async (req, res, next) => {
  try {
    const data = await trainingService.getAllTrainings();
    res.json({ success: true, count: data.length, data });
  } catch (err) { next(err); }
};

const approveTraining = async (req, res, next) => {
  try {
    const trainingId = parseInt(req.params.id, 10);
    const { manager_id, comment } = req.body;
    if (!manager_id) {
      return res.status(400).json({ success: false, message: 'manager_id est requis.' });
    }
    const data = await trainingService.approveTraining(trainingId, parseInt(manager_id, 10), comment);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const rejectTraining = async (req, res, next) => {
  try {
    const trainingId = parseInt(req.params.id, 10);
    const { manager_id, comment } = req.body;
    if (!manager_id) {
      return res.status(400).json({ success: false, message: 'manager_id est requis.' });
    }
    const data = await trainingService.rejectTraining(trainingId, parseInt(manager_id, 10), comment);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const getTrainingsByManager = async (req, res, next) => {
  try {
    const managerId = parseInt(req.params.managerId, 10);
    const data = await trainingService.getTrainingsByManager(managerId);
    res.json({ success: true, count: data.length, data });
  } catch (err) { next(err); }
};

const getTrainingById = async (req, res, next) => {
  try {
    const data = await trainingService.getTrainingById(parseInt(req.params.id, 10));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const updateTraining = async (req, res, next) => {
  try {
    const mediaFiles   = req.files?.media ?? [];
    const quizFiles    = req.files?.quiz  ?? [];
    const removeMedia  = [].concat(req.body?.remove_media  ?? []).filter(Boolean);
    const removeQuiz   = [].concat(req.body?.remove_quiz   ?? []).filter(Boolean);
    const data = await trainingService.updateTraining(
      parseInt(req.params.id, 10),
      req.body,
      mediaFiles,
      quizFiles,
      removeMedia,
      removeQuiz,
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const ownerAcceptTraining = async (req, res, next) => {
  try {
    const data = await trainingService.ownerAcceptTraining(parseInt(req.params.id, 10));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const ownerRequestRevision = async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: 'Un commentaire est requis.' });
    }
    const data = await trainingService.ownerRequestRevision(parseInt(req.params.id, 10), comment.trim());
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

module.exports = { createTraining, getAllTrainings, getTrainingById, updateTraining, approveTraining, rejectTraining, getTrainingsByManager, markTrainingDone, ownerAcceptTraining, ownerRequestRevision };
