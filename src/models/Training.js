const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Training = sequelize.define('Training', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  name: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },

  department: {
    type: DataTypes.ENUM(
      'AVOCarbon France',
      'AVOCarbon Cyclam',
      'Assymex Monterry',
      'AVOCarbon Tianjin',
      'AVOCarbon Germany',
      'AVOCarbon Tunisia',
      'AVOCarbon Kunshan',
      'AVOCarbon India',
      'Same Tunisie Service',
      'AVOCarbon Korea',
      'Financial Department',
      'R&D Department',
      'Sales Department',
      'Purchasing Department',
      'HR Department',
      'Group Management',
      'Quality Department',
      'IT Department',
      'Project Management Department',
    ),
    allowNull: false,
  },

  type_of_training: {
    type: DataTypes.ENUM(
      'Tutorials on a new tool or process',
      'Products & Applications Training',
      'Technical Training',
      'Soft Skills Training',
    ),
    allowNull: false,
  },

  requirement: {
    type: DataTypes.ENUM(
      'Updating existing Training',
      'New Training'
    ),
    allowNull: false,
  },

  training_objectives: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { len: [1, 2000] },
  },

  target_audience: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { len: [1, 2000] },
  },

  requested_kpis: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { len: [1, 2000] },
  },

  publication_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      isDate: true,
      isAtLeast15DaysFromNow(value) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const minDate = new Date(today);
        minDate.setDate(minDate.getDate() + 15);
        if (new Date(value) < minDate) {
          throw new Error('La date de publication doit être au moins 15 jours après aujourd\'hui.');
        }
      },
    },
  },

  information: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: { len: [0, 2000] },
  },

  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'in progress', 'done', 'updated', 'stuck'),
    allowNull: false,
    defaultValue: 'pending',
  },

  manager_comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  first_approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  second_approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  rejected_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  first_validation: {
    type: DataTypes.ENUM('accepted', 'rejected', 'update_requested'),
    allowNull: true,
    defaultValue: null,
  },

  second_validation: {
    type: DataTypes.ENUM('accepted', 'rejected', 'update_requested'),
    allowNull: true,
    defaultValue: null,
  },

}, {
  tableName: 'trainings',
  timestamps: true,
  underscored: true,
});

module.exports = Training;
