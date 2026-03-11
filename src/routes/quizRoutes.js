const router = require('express').Router();
const { getQuizById, deleteQuiz } = require('../controllers/quizController');

router.get('/:id', getQuizById);
router.delete('/:id', deleteQuiz);

module.exports = router;
