const trainingMediaService = require('../services/trainingMediaService');

const getMediaByTraining = async (req, res, next) => {
  try {
    const data = await trainingMediaService.getMediaByTraining(parseInt(req.params.trainingId, 10));
    res.json({ success: true, count: data.length, data });
  } catch (err) { next(err); }
};

const getPhotosByTraining = async (req, res, next) => {
  try {
    const data = await trainingMediaService.getPhotosByTraining(parseInt(req.params.trainingId, 10));
    res.json({ success: true, count: data.length, data });
  } catch (err) { next(err); }
};

const getVideosByTraining = async (req, res, next) => {
  try {
    const data = await trainingMediaService.getVideosByTraining(parseInt(req.params.trainingId, 10));
    res.json({ success: true, count: data.length, data });
  } catch (err) { next(err); }
};

const getMediaById = async (req, res, next) => {
  try {
    const data = await trainingMediaService.getMediaById(parseInt(req.params.id, 10));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};


const addMediaFiles = async (req, res, next) => {
  try {
    const files = req.files?.media || [];
    const data  = await trainingMediaService.addMediaFiles(
      parseInt(req.params.trainingId, 10),
      files
    );
    res.status(201).json({ success: true, count: data.length, data });
  } catch (err) { next(err); }
};

const deleteMedia = async (req, res, next) => {
  try {
    const result = await trainingMediaService.deleteMedia(parseInt(req.params.id, 10));
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

module.exports = {
  getMediaByTraining,
  getPhotosByTraining,
  getVideosByTraining,
  getMediaById,
  addMediaFiles,
  deleteMedia,
};
