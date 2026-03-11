const { Training, CompanyMember, Quiz, TrainingMedia } = require('../models/index');
const { Op } = require('sequelize');
const {
  sendTrainingApprovalEmail,
  sendTrainingUpdatedEmail,
  sendSecondValidatorApprovalEmail,
  sendSecondValidatorUpdatedEmail,
} = require('../emailService/approvalEmailService');
const { sendTrainingResultEmail }  = require('../emailService/resultEmailService');
const { sendUpdateRequestEmail }   = require('../emailService/updateRequestEmailService');

const PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp'];

async function createTraining(body, mediaFiles = [], quizFiles = []) {
  const {
    name,
    department,
    requester_id,
    requester_supervisor_id,
    type_of_training,
    requirement,
    training_objectives,
    target_audience,
    requested_kpis,
    publication_date,
    information,
  } = body;

  const parseIds = (val) => {
    if (val === undefined || val === null) return [];
    if (typeof val === 'string' && val.trim().startsWith('[')) {
      try { val = JSON.parse(val); } catch (_) { /* ignore */ }
    }
    return [].concat(val).map(Number).filter(Boolean);
  };

  const rIds  = parseIds(requester_id);
  const rsIds = parseIds(requester_supervisor_id);

  if (rIds.length === 0) {
    const err = new Error('Au moins un requester_id est requis.');
    err.status = 400;
    throw err;
  }
  if (rsIds.length === 0) {
    const err = new Error('Au moins un requester_supervisor_id est requis.');
    err.status = 400;
    throw err;
  }

  const requesters = await CompanyMember.findAll({ where: { id: rIds } });
  if (requesters.length !== rIds.length) {
    const err = new Error('Un ou plusieurs requesters sont introuvables.');
    err.status = 404;
    throw err;
  }

  const supervisors = await CompanyMember.findAll({ where: { id: rsIds } });
  if (supervisors.length !== rsIds.length) {
    const err = new Error('Un ou plusieurs superviseurs sont introuvables.');
    err.status = 404;
    throw err;
  }

  const managerIds = [
    ...new Set(
      requesters
        .map(r => r.manager_id)
        .filter(Boolean)
    ),
  ];

  const training = await Training.create({
    name,
    department,
    type_of_training,
    requirement,
    training_objectives,
    target_audience,
    requested_kpis,
    publication_date,
    information: information || null,
    status: 'pending',
  });

  await training.setRequesters(rIds);
  await training.setRequesterSupervisors(rsIds);

  if (managerIds.length > 0) {
    await training.setApprovalManagers(managerIds);

    const managers = await CompanyMember.findAll({ where: { id: managerIds } });
    const owner    = requesters[0];
    for (const manager of managers) {
      sendTrainingApprovalEmail({ manager, training, requesters, owner }).catch(e =>
        console.error(`❌ Email non envoyé à ${manager.email}:`, e.message)
      );
    }
  }

  for (const file of mediaFiles) {
    const media_type = PHOTO_MIME.includes(file.mimetype) ? 'photo' : 'video';
    await TrainingMedia.create({
      training_id: training.id,
      file_name:   file.originalname,
      file_path:   `/uploads/photo-video/${file.filename}`,
      mime_type:   file.mimetype,
      file_size:   file.size,
      media_type,
    });
  }

  for (const file of quizFiles) {
    await Quiz.create({
      training_id: training.id,
      file_name:   file.originalname,
      file_path:   `/uploads/quiz/${file.filename}`,
      mime_type:   file.mimetype,
      file_size:   file.size,
    });
  }

  return training;
}

async function approveTraining(trainingId, managerId, comment) {
  const training = await Training.findByPk(trainingId);
  if (!training) {
    const err = new Error(`Training #${trainingId} introuvable.`);
    err.status = 404;
    throw err;
  }

  if (training.status !== 'pending') {
    const err = new Error(`Ce training ne peut pas être approuvé (statut actuel : ${training.status}).`);
    err.status = 400;
    throw err;
  }

  if (training.first_validation !== null) {
    const err = new Error('Une décision a déjà été prise pour la première validation de ce training.');
    err.status = 400;
    throw err;
  }

  const managers = await training.getApprovalManagers({ where: { id: managerId } });
  if (managers.length === 0) {
    const err = new Error('Vous n\'êtes pas autorisé à approuver ce training.');
    err.status = 403;
    throw err;
  }

  await training.update({
    first_validation: 'accepted',
    first_approved_at: new Date(),
    manager_comment: comment || null,
  });

  const requesters = await training.getRequesters();
  sendSecondValidatorApprovalEmail({ training, requesters }).catch(e =>
    console.error('❌ Second validator email not sent:', e.message)
  );

  const owner = requesters[0];
  if (owner) {
    sendTrainingResultEmail({
      owner,
      training,
      manager: managers[0],
      decision: 'approved',
      comment: comment || null,
      validationStep: '1st',
    }).catch(e => console.error(`❌ 1st validation result email not sent to ${owner.email}:`, e.message));
  }

  return training;
}

async function rejectTraining(trainingId, managerId, comment) {
  const training = await Training.findByPk(trainingId);
  if (!training) {
    const err = new Error(`Training #${trainingId} introuvable.`);
    err.status = 404;
    throw err;
  }

  if (training.status !== 'pending') {
    const err = new Error(`Ce training ne peut pas être rejeté (statut actuel : ${training.status}).`);
    err.status = 400;
    throw err;
  }

  if (training.first_validation !== null) {
    const err = new Error('Une décision a déjà été prise pour la première validation de ce training.');
    err.status = 400;
    throw err;
  }

  const managers = await training.getApprovalManagers({ where: { id: managerId } });
  if (managers.length === 0) {
    const err = new Error('Vous n\'êtes pas autorisé à rejeter ce training.');
    err.status = 403;
    throw err;
  }

  if (!comment) {
    const err = new Error('Un commentaire est requis pour rejeter un training.');
    err.status = 400;
    throw err;
  }

  await training.update({
    status: 'rejected',
    manager_comment: comment,
    rejected_at: new Date(),
    first_validation: 'rejected',
  });

  const requesters = await training.getRequesters();
  const owner = requesters[0];
  if (owner) {
    sendTrainingResultEmail({ owner, training, manager: managers[0], decision: 'rejected', comment, validationStep: '1st' }).catch(e =>
      console.error(`❌ Result email not sent to ${owner.email}:`, e.message)
    );
  }

  return training;
}

async function getTrainingsByManager(managerId) {
  const manager = await CompanyMember.findByPk(managerId);
  if (!manager) {
    const err = new Error(`Manager #${managerId} introuvable.`);
    err.status = 404;
    throw err;
  }

  return Training.findAll({
    include: [
      {
        model: CompanyMember,
        as: 'approvalManagers',
        where: { id: managerId },
        attributes: [],
        through: { attributes: [] },
      },
      {
        model: CompanyMember,
        as: 'requesters',
        attributes: ['id', 'display_name', 'email', 'job_title', 'department'],
        through: { attributes: [] },
      },
    ],
    order: [['created_at', 'DESC']],
  });
}

async function getAllTrainings() {
  return Training.findAll({
    include: [
      {
        model: CompanyMember,
        as: 'requesters',
        attributes: ['id', 'display_name', 'email', 'job_title', 'department'],
        through: { attributes: [] },
      },
      {
        model: CompanyMember,
        as: 'requesterSupervisors',
        attributes: ['id', 'display_name', 'email', 'job_title'],
        through: { attributes: [] },
      },
      {
        model: CompanyMember,
        as: 'approvalManagers',
        attributes: ['id', 'display_name', 'email'],
        through: { attributes: [] },
      },
      { model: Quiz,          as: 'quizzes' },
      { model: TrainingMedia, as: 'media'   },
    ],
    order: [['created_at', 'DESC']],
  });
}

async function getTrainingById(id) {
  const training = await Training.findByPk(id, {
    include: [
      {
        model: CompanyMember,
        as: 'requesters',
        attributes: ['id', 'display_name', 'email', 'job_title', 'department'],
        through: { attributes: [] },
      },
      {
        model: CompanyMember,
        as: 'requesterSupervisors',
        attributes: ['id', 'display_name', 'email', 'job_title'],
        through: { attributes: [] },
      },
      {
        model: CompanyMember,
        as: 'approvalManagers',
        attributes: ['id', 'display_name', 'email'],
        through: { attributes: [] },
      },
      { model: Quiz,          as: 'quizzes' },
      { model: TrainingMedia, as: 'media'   },
    ],
  });
  if (!training) {
    const err = new Error(`Training #${id} introuvable.`);
    err.status = 404;
    throw err;
  }
  return training;
}

async function updateTraining(id, body, mediaFiles = [], quizFiles = [], removeMediaPaths = [], removeQuizPaths = []) {
  const training = await Training.findByPk(id);
  if (!training) {
    const err = new Error(`Training #${id} introuvable.`);
    err.status = 404;
    throw err;
  }

  const allowedFields = [
    'name', 'department', 'type_of_training', 'requirement',
    'training_objectives', 'target_audience', 'requested_kpis',
    'publication_date', 'information', 'status', 'manager_comment',
  ];

  const previousStatus = training.status; // capture before update

  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  // Auto-reset to pending when creator re-submits after an update request
  if (previousStatus === 'updated' && !updates.status) {
    updates.status = 'pending';
    if (training.first_validation === 'accepted') {
      // Second validator had requested the update — reset second_validation only
      updates.second_validation = null;
    } else {
      // First manager had requested the update — reset first_validation
      updates.first_validation = null;
    }
  }

  await training.update(updates);

  const parseIds = (val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string' && val.trim().startsWith('[')) {
      try { val = JSON.parse(val); } catch (_) { /* ignore */ }
    }
    return [].concat(val).map(Number).filter(Boolean);
  };

  const rIds  = parseIds(body.requester_id);
  const rsIds = parseIds(body.requester_supervisor_id);
  const mIds  = parseIds(body.manager_id);

  if (rIds  !== null) await training.setRequesters(rIds);
  if (rsIds !== null) await training.setRequesterSupervisors(rsIds);
  if (mIds  !== null) await training.setApprovalManagers(mIds);

  /* ── Remove existing media files ── */
  if (removeMediaPaths.length > 0) {
    await TrainingMedia.destroy({ where: { training_id: id, file_path: removeMediaPaths } });
  }

  /* ── Remove existing quiz files ── */
  if (removeQuizPaths.length > 0) {
    await Quiz.destroy({ where: { training_id: id, file_path: removeQuizPaths } });
  }

  /* ── Add new media files ── */
  for (const file of mediaFiles) {
    const media_type = PHOTO_MIME.includes(file.mimetype) ? 'photo' : 'video';
    await TrainingMedia.create({
      training_id: id,
      file_name:   file.originalname,
      file_path:   `/uploads/photo-video/${file.filename}`,
      mime_type:   file.mimetype,
      file_size:   file.size,
      media_type,
    });
  }

  /* ── Add new quiz files ── */
  for (const file of quizFiles) {
    await Quiz.create({
      training_id: id,
      file_name:   file.originalname,
      file_path:   `/uploads/quiz/${file.filename}`,
      mime_type:   file.mimetype,
      file_size:   file.size,
    });
  }

  // If the creator is re-submitting after an update request, notify the right party.
  if (previousStatus === 'updated') {
    const fresh      = await getTrainingById(id);
    const requesters = await training.getRequesters();

    if (training.first_validation === 'accepted') {
      // Second validator had requested the update — notify them for re-review
      sendSecondValidatorUpdatedEmail({ training: fresh, requesters }).catch(e =>
        console.error('❌ Second validator updated email not sent:', e.message)
      );
    } else {
      // First manager(s) had requested the update — notify all managers
      const managers = await training.getApprovalManagers();
      for (const manager of managers) {
        sendTrainingUpdatedEmail({ manager, training: fresh, requesters }).catch(e =>
          console.error(`❌ Updated notification not sent to ${manager.email}:`, e.message)
        );
      }
    }
  }

  return getTrainingById(id);
}

/**
 * Manager requests the creator to update the training before approval.
 * Sets status to 'updated', stores the comment, emails the owner.
 */
async function requestUpdateTraining(trainingId, managerId, comment) {
  const training = await Training.findByPk(trainingId);
  if (!training) {
    const err = new Error(`Training #${trainingId} introuvable.`);
    err.status = 404;
    throw err;
  }

  if (training.status !== 'pending') {
    const err = new Error(`Ce training ne peut pas être mis en attente de mise à jour (statut actuel : ${training.status}).`);
    err.status = 400;
    throw err;
  }

  if (training.first_validation !== null) {
    const err = new Error('Une décision a déjà été prise pour la première validation de ce training.');
    err.status = 400;
    throw err;
  }

  const managers = await training.getApprovalManagers({ where: { id: managerId } });
  if (managers.length === 0) {
    const err = new Error("Vous n'êtes pas autorisé à gérer ce training.");
    err.status = 403;
    throw err;
  }

  if (!comment) {
    const err = new Error('Un commentaire est requis pour demander une mise à jour.');
    err.status = 400;
    throw err;
  }

  await training.update({ status: 'updated', manager_comment: comment, first_validation: 'update_requested' });

  // Notify the training creator (first requester)
  const requesters = await training.getRequesters();
  const owner = requesters[0];
  if (owner) {
    sendUpdateRequestEmail({ owner, training, manager: managers[0], comment }).catch(e =>
      console.error(`❌ Update request email not sent to ${owner.email}:`, e.message)
    );
  }

  return training;
}

// ── Second validator actions ──────────────────────────────────────────────────

async function secondApproveTraining(trainingId) {
  const training = await Training.findByPk(trainingId);
  if (!training) {
    const err = new Error(`Training #${trainingId} introuvable.`);
    err.status = 404;
    throw err;
  }

  if (training.first_validation !== 'accepted') {
    const err = new Error('La première validation doit être acceptée avant la deuxième.');
    err.status = 400;
    throw err;
  }

  if (training.second_validation !== null) {
    const err = new Error('Une décision a déjà été prise pour la deuxième validation.');
    err.status = 400;
    throw err;
  }

  await training.update({
    second_validation: 'accepted',
    status: 'in progress',
    second_approved_at: new Date(),
  });

  const requesters = await training.getRequesters();
  const owner = requesters[0];
  if (owner) {
    sendTrainingResultEmail({ owner, training, manager: { display_name: process.env.SECOND_VALIDATOR_NAME || 'Second Validator', email: process.env.SECOND_VALIDATOR_EMAIL }, decision: 'approved', comment: null, validationStep: '2nd' }).catch(e =>
      console.error(`❌ Result email not sent to ${owner.email}:`, e.message)
    );
  }

  return training;
}

async function secondRejectTraining(trainingId, comment) {
  const training = await Training.findByPk(trainingId);
  if (!training) {
    const err = new Error(`Training #${trainingId} introuvable.`);
    err.status = 404;
    throw err;
  }

  if (training.first_validation !== 'accepted') {
    const err = new Error('La première validation doit être acceptée avant la deuxième.');
    err.status = 400;
    throw err;
  }

  if (training.second_validation !== null) {
    const err = new Error('Une décision a déjà été prise pour la deuxième validation.');
    err.status = 400;
    throw err;
  }

  if (!comment) {
    const err = new Error('Un commentaire est requis pour rejeter un training.');
    err.status = 400;
    throw err;
  }

  await training.update({
    second_validation: 'rejected',
    status: 'rejected',
    rejected_at: new Date(),
    manager_comment: comment,
  });

  const requesters = await training.getRequesters();
  const owner = requesters[0];
  if (owner) {
    sendTrainingResultEmail({ owner, training, manager: { display_name: process.env.SECOND_VALIDATOR_NAME || 'Second Validator', email: process.env.SECOND_VALIDATOR_EMAIL }, decision: 'rejected', comment, validationStep: '2nd' }).catch(e =>
      console.error(`❌ Result email not sent to ${owner.email}:`, e.message)
    );
  }

  return training;
}

async function secondRequestUpdateTraining(trainingId, comment) {
  const training = await Training.findByPk(trainingId);
  if (!training) {
    const err = new Error(`Training #${trainingId} introuvable.`);
    err.status = 404;
    throw err;
  }

  if (training.first_validation !== 'accepted') {
    const err = new Error('La première validation doit être acceptée avant la deuxième.');
    err.status = 400;
    throw err;
  }

  if (training.second_validation !== null) {
    const err = new Error('Une décision a déjà été prise pour la deuxième validation.');
    err.status = 400;
    throw err;
  }

  if (!comment) {
    const err = new Error('Un commentaire est requis pour demander une mise à jour.');
    err.status = 400;
    throw err;
  }

  await training.update({
    second_validation: 'update_requested',
    status: 'updated',
    manager_comment: comment,
  });

  const requesters = await training.getRequesters();
  const owner = requesters[0];
  if (owner) {
    sendUpdateRequestEmail({
      owner,
      training,
      manager: { display_name: process.env.SECOND_VALIDATOR_NAME || 'Second Validator', email: process.env.SECOND_VALIDATOR_EMAIL },
      comment,
    }).catch(e =>
      console.error(`❌ Update request email not sent to ${owner.email}:`, e.message)
    );
  }

  return training;
}

module.exports = {
  createTraining,
  getAllTrainings,
  getTrainingById,
  updateTraining,
  approveTraining,
  rejectTraining,
  requestUpdateTraining,
  secondApproveTraining,
  secondRejectTraining,
  secondRequestUpdateTraining,
  getTrainingsByManager,
};

