const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');


const Quiz = sequelize.define('Quiz', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  file_name: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },

  file_path: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },

  mime_type: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      isWordFile(value) {
        const allowed = [
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (!allowed.includes(value)) {
          throw new Error('Le fichier quiz doit être un document Word (.doc ou .docx).');
        }
      },
    },
  },

  file_size: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  training_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'quizzes',
  timestamps: true,
  underscored: true,
});

module.exports = Quiz;
