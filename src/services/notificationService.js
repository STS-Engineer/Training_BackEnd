const { Notification } = require('../models/index');

/**
 * Create a single in-app notification for one recipient.
 * Silently ignores missing recipientId.
 */
async function notify(recipientId, trainingId, type, message) {
  if (!recipientId) return;
  try {
    await Notification.create({ recipient_id: recipientId, training_id: trainingId, type, message });
  } catch (e) {
    console.error('❌ Failed to create notification:', e.message);
  }
}

/**
 * Batch-notify multiple recipients with the same message.
 */
async function notifyMany(recipientIds, trainingId, type, message) {
  for (const id of (recipientIds || []).filter(Boolean)) {
    await notify(id, trainingId, type, message);
  }
}

module.exports = { notify, notifyMany };
