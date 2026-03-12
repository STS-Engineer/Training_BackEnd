require('dotenv').config();
const { sequelize } = require('../src/models/index');

(async () => {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id          SERIAL PRIMARY KEY,
        recipient_id INTEGER NOT NULL,
        training_id  INTEGER DEFAULT NULL,
        type         VARCHAR(80) NOT NULL,
        message      TEXT NOT NULL,
        is_read      BOOLEAN NOT NULL DEFAULT FALSE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_recipient
        ON notifications (recipient_id);

      CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
        ON notifications (recipient_id, is_read);
    `);
    console.log('✅ notifications table created (or already exists).');
    process.exit(0);
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    process.exit(1);
  }
})();
