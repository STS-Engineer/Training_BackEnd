const router = require('express').Router();

const { createTraining, getAllTrainings, getTrainingById, updateTraining, approveTraining, rejectTraining, getTrainingsByManager, markTrainingDone, ownerAcceptTraining, ownerRequestRevision } = require('../controllers/trainingController');
const { getQuizzesByTraining, addQuizFiles }                      = require('../controllers/quizController');
const { getMediaByTraining, getPhotosByTraining, getVideosByTraining, addMediaFiles } = require('../controllers/trainingMediaController');

const { uploadTrainingFiles, uploadDocumentation } = require('../middlewares/upload');

router.post('/',                          uploadTrainingFiles, createTraining);
router.get('/',                           getAllTrainings);
router.get('/:id',                        getTrainingById);
router.put('/:id',                        uploadTrainingFiles, updateTraining);
router.patch('/:id/approve',              approveTraining);
router.patch('/:id/reject',               rejectTraining);
router.patch('/:id/done',                 uploadDocumentation, markTrainingDone);
router.patch('/:id/owner-accept',         ownerAcceptTraining);
router.patch('/:id/owner-revision',       ownerRequestRevision);
router.get('/manager/:managerId',         getTrainingsByManager);
router.get('/:trainingId/quizzes',        getQuizzesByTraining);
router.post('/:trainingId/quizzes',       uploadTrainingFiles, addQuizFiles);
router.get('/:trainingId/media',          getMediaByTraining);
router.get('/:trainingId/media/photos',   getPhotosByTraining);
router.get('/:trainingId/media/videos',   getVideosByTraining);
router.post('/:trainingId/media',         uploadTrainingFiles, addMediaFiles);

module.exports = router;
