const router = require('express').Router();
const {
  signIn,
  getAllUsers,
  getUserById,
} = require('../controllers/userController');

router.post('/signin', signIn);
router.get('/', getAllUsers);
router.get('/:id', getUserById);

module.exports = router;
