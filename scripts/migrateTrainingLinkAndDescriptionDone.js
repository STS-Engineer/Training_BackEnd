require('dotenv').config();
const { sequelize } = require('../src/models/index');

(async () => {
  try {
    await sequelize.query(`
      ALTER TABLE trainings
      ADD COLUMN IF NOT EXISTS link VARCHAR(255) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS description_done TEXT DEFAULT NULL;
    `);

    console.log('✅ Columns link and description_done added to trainings table.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    process.exit(1);
  }
})();
