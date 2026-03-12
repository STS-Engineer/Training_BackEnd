const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  recipient_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'ID of the CompanyMember who receives this notification',
  },

  training_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID of the related Training (nullable for system notifications)',
  },

  type: {
    type: DataTypes.STRING(80),
    allowNull: false,
    comment: 'Event type slug, e.g. first_validation_approved, trainer_assigned…',
  },

  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  is_read: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'notifications',
  timestamps: true,
  underscored: true,
});

module.exports = Notification;
