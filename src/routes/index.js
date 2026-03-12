const router = require('express').Router();

router.use('/users',         require('./userRoutes'));
router.use('/trainings',     require('./trainingRoutes'));
router.use('/quizzes',       require('./quizRoutes'));
router.use('/media',         require('./trainingMediaRoutes'));
router.use('/email-actions', require('./emailActionRoutes'));
router.use('/notifications', require('./notificationRoutes'));

module.exports = router;
