const router = require('express').Router();
const { Notification } = require('../models/index');

// GET /api/notifications?userId=xxx  — all notifications for a user
router.get('/', async (req, res, next) => {
  try {
    const userId = parseInt(req.query.userId, 10);
    if (!userId) return res.status(400).json({ error: 'userId is required.' });

    const notifications = await Notification.findAll({
      where: { recipient_id: userId },
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    res.json(notifications);
  } catch (e) { next(e); }
});

// GET /api/notifications/unread-count?userId=xxx
router.get('/unread-count', async (req, res, next) => {
  try {
    const userId = parseInt(req.query.userId, 10);
    if (!userId) return res.status(400).json({ error: 'userId is required.' });

    const count = await Notification.count({ where: { recipient_id: userId, is_read: false } });
    res.json({ count });
  } catch (e) { next(e); }
});

// PATCH /api/notifications/read-all?userId=xxx  — must be before /:id route
router.patch('/read-all', async (req, res, next) => {
  try {
    const userId = parseInt(req.query.userId, 10);
    if (!userId) return res.status(400).json({ error: 'userId is required.' });

    await Notification.update({ is_read: true }, { where: { recipient_id: userId, is_read: false } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const n = await Notification.findByPk(req.params.id);
    if (!n) return res.status(404).json({ error: 'Notification not found.' });
    await n.update({ is_read: true });
    res.json(n);
  } catch (e) { next(e); }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const n = await Notification.findByPk(req.params.id);
    if (!n) return res.status(404).json({ error: 'Notification not found.' });
    await n.destroy();
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
