const quizService = require('../services/quizService');

const getQuizzesByTraining = async (req, res, next) => {
  try {
    const data = await quizService.getQuizzesByTraining(parseInt(req.params.trainingId, 10));
    res.json({ success: true, count: data.length, data });
  } catch (err) { next(err); }
};

const getQuizById = async (req, res, next) => {
  try {
    const data = await quizService.getQuizById(parseInt(req.params.id, 10));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};


const addQuizFiles = async (req, res, next) => {
  try {
    const files = req.files?.quiz || [];
    const data  = await quizService.addQuizFiles(
      parseInt(req.params.trainingId, 10),
      files
    );
    res.status(201).json({ success: true, count: data.length, data });
  } catch (err) { next(err); }
};

const deleteQuiz = async (req, res, next) => {
  try {
    const result = await quizService.deleteQuiz(parseInt(req.params.id, 10));
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

module.exports = { getQuizzesByTraining, getQuizById, addQuizFiles, deleteQuiz };
