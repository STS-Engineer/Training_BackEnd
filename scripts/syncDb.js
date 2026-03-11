require('dotenv').config();
const { sequelize } = require('../src/models/index');

sequelize.sync() 
  .then(() => {
    console.log('✅ Colonne department mise à jour en ENUM.');
    process.exit(0);
  })
  .catch(e => {
    console.error('❌', e.message);
    process.exit(1);
  });
