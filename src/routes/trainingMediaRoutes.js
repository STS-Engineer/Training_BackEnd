const router = require('express').Router();
const { getMediaById, deleteMedia } = require('../controllers/trainingMediaController');

router.get('/:id', getMediaById);
router.delete('/:id', deleteMedia);

module.exports = router;
