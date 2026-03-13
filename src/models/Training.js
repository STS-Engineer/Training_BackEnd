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

  link: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
    comment: 'Optional training link (meeting URL, LMS URL, or external resource)',
  },

  description_done: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
    comment: 'Trainer summary/details when training is completed',
  },

  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'in progress', 'done', 'updated', 'stuck', 'awaiting_owner_validation'),
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

  last_reminder_sent_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },

  trainer_done_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
    comment: 'Timestamp when the trainer marks the training as done',
  },

  documentation_path: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
    comment: 'Path to the training documentation file (PDF/Word) uploaded by the trainer',
  },

  documentation_name: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null,
    comment: 'Original filename of the training documentation',
  },

  final_validation: {
    type: DataTypes.ENUM('accepted', 'update_requested'),
    allowNull: true,
    defaultValue: null,
  },

  final_approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  owner_revision_images: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
    comment: 'JSON array of image paths uploaded by the owner when requesting revisions',
  },

  owner_comment: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
    comment: 'Comment from the training owner when requesting revisions from the trainer',
  },

  trainer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
    comment: 'ID of the CompanyMember assigned as trainer by the 2nd validator',
  },

}, {
  tableName: 'trainings',
  timestamps: true,
  underscored: true,
});

module.exports = Training;
