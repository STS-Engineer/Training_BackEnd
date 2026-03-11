const sequelize = require('../config/database');

const CompanyMember = require('./User');
const Training      = require('./Training');
const Quiz          = require('./Quiz');
const TrainingMedia = require('./TrainingMedia');

Training.belongsToMany(CompanyMember, {
  as: 'requesters',
  through: 'training_requesters',
  foreignKey: 'training_id',
  otherKey: 'member_id',
});
CompanyMember.belongsToMany(Training, {
  as: 'trainings_requested',
  through: 'training_requesters',
  foreignKey: 'member_id',
  otherKey: 'training_id',
});

Training.belongsToMany(CompanyMember, {
  as: 'requesterSupervisors',
  through: 'training_requester_supervisors',
  foreignKey: 'training_id',
  otherKey: 'member_id',
});
CompanyMember.belongsToMany(Training, {
  as: 'trainingsSupervised',
  through: 'training_requester_supervisors',
  foreignKey: 'member_id',
  otherKey: 'training_id',
});

Training.belongsToMany(CompanyMember, {
  as: 'approvalManagers',
  through: 'training_managers',
  foreignKey: 'training_id',
  otherKey: 'member_id',
});
CompanyMember.belongsToMany(Training, {
  as: 'trainingsToApprove',
  through: 'training_managers',
  foreignKey: 'member_id',
  otherKey: 'training_id',
});

Training.hasMany(Quiz, {
  as: 'quizzes',
  foreignKey: 'training_id',
  onDelete: 'CASCADE',
});
Quiz.belongsTo(Training, {
  as: 'training',
  foreignKey: 'training_id',
});

Training.hasMany(TrainingMedia, {
  as: 'media',
  foreignKey: 'training_id',
  onDelete: 'CASCADE',
});
TrainingMedia.belongsTo(Training, {
  as: 'training',
  foreignKey: 'training_id',
});

module.exports = {
  sequelize,
  CompanyMember,
  Training,
  Quiz,
  TrainingMedia,
};
