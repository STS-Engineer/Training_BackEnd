const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { isAllowedQuizMime, QUIZ_FILE_DESCRIPTION } = require('../constants/quizFiles');

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
      isAllowedQuizFile(value) {
        if (!isAllowedQuizMime(value)) {
          throw new Error(QUIZ_FILE_DESCRIPTION);
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
