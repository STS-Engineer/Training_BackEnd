require('dotenv').config();
const sequelizeSecond = require('../config/sequelizeSecond');
const CompanyMember   = require('./User');

sequelizeSecond.authenticate()
  .then(() => console.log('✅ Connexion avocarbon_directory réussie.'))
  .catch(err => console.error('❌ Erreur connexion avocarbon_directory :', err.message));

module.exports = { sequelizeSecond, CompanyMember };