require('dotenv').config();
const { sequelize } = require('../src/models/index');

(async () => {
  try {
    await sequelize.query(`
      ALTER TABLE trainings
      ADD COLUMN IF NOT EXISTS trainer_id INTEGER DEFAULT NULL;
    `);
    console.log('✅ Column trainer_id added to trainings table.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    process.exit(1);
  }
})();
