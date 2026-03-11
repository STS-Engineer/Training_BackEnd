const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');


const TrainingMedia = sequelize.define('TrainingMedia', {
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
    allowNull: true,
  },

  file_size: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  media_type: {
    type: DataTypes.ENUM('photo', 'video'),
    allowNull: false,
  },

  training_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'training_media',
  timestamps: true,
  underscored: true,
});

module.exports = TrainingMedia;
