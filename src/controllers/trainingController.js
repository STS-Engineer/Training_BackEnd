const trainingService = require('../services/trainingService');

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

module.exports = { createTraining, getAllTrainings, getTrainingById, updateTraining, approveTraining, rejectTraining, getTrainingsByManager };
