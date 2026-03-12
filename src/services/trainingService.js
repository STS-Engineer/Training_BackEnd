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
const { sendTrainingAssignedEmail, sendTrainerDoneEmail } = require('../emailService/trainerEmailService');
const { sendOwnerValidationEmail, sendTrainerRevisionEmail } = require('../emailService/ownerValidationEmailService');
const { notify, notifyMany } = require('./notificationService');



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
    first_validation:      'accepted',
    first_approved_at:     new Date(),
    manager_comment:       comment || null,
    last_reminder_sent_at: null, 
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

  notifyMany(requesters.map(r => r.id), training.id, 'first_validation_approved',
    `Votre demande de formation "${training.name}" a été approuvée (1ère validation) et transmise au validateur final.`);

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
    notify(owner.id, training.id, 'first_validation_rejected',
      `Votre demande de formation "${training.name}" a été rejetée par le 1er validateur.`);
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

  const previousStatus = training.status; 

  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  if (previousStatus === 'updated' && !updates.status) {
    updates.status = 'pending';
    if (training.first_validation === 'accepted') {
      updates.second_validation = null;
    } else {
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

  if (removeMediaPaths.length > 0) {
    await TrainingMedia.destroy({ where: { training_id: id, file_path: removeMediaPaths } });
  }

  if (removeQuizPaths.length > 0) {
    await Quiz.destroy({ where: { training_id: id, file_path: removeQuizPaths } });
  }

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

  for (const file of quizFiles) {
    await Quiz.create({
      training_id: id,
      file_name:   file.originalname,
      file_path:   `/uploads/quiz/${file.filename}`,
      mime_type:   file.mimetype,
      file_size:   file.size,
    });
  }

  if (previousStatus === 'updated') {
    const fresh      = await getTrainingById(id);
    const requesters = await training.getRequesters();

    if (training.first_validation === 'accepted') {
      sendSecondValidatorUpdatedEmail({ training: fresh, requesters }).catch(e =>
        console.error('❌ Second validator updated email not sent:', e.message)
      );
    } else {
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

  const requesters = await training.getRequesters();
  const owner = requesters[0];
  if (owner) {
    sendUpdateRequestEmail({ owner, training, manager: managers[0], comment }).catch(e =>
      console.error(`❌ Update request email not sent to ${owner.email}:`, e.message)
    );
    notify(owner.id, training.id, 'first_validation_update_requested',
      `Des modifications sont requises pour votre demande de formation "${training.name}" (1ère validation).`);
  }

  return training;
}

// ── Second validator actions ──────────────────────────────────────────────────

async function secondApproveTraining(trainingId, trainerId) {
  if (!trainerId) {
    const err = new Error('Un trainer_id est requis pour approuver la deuxième validation.');
    err.status = 400;
    throw err;
  }

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

  const trainer = await CompanyMember.findByPk(trainerId);
  if (!trainer) {
    const err = new Error(`Aucun membre trouvé avec l'id #${trainerId}.`);
    err.status = 404;
    throw err;
  }

  await training.update({
    second_validation: 'accepted',
    status: 'in progress',
    second_approved_at: new Date(),
    trainer_id: trainerId,
  });

  const requesters = await training.getRequesters();
  const owner = requesters[0];
  if (owner) {
    sendTrainingResultEmail({ owner, training, manager: { display_name: process.env.SECOND_VALIDATOR_NAME || 'Second Validator', email: process.env.SECOND_VALIDATOR_EMAIL }, decision: 'approved', comment: null, validationStep: '2nd' }).catch(e =>
      console.error(`❌ Result email not sent to ${owner.email}:`, e.message)
    );
  }

  if (trainer.email) {
    sendTrainingAssignedEmail({ trainer, training, requesters }).catch(e =>
      console.error(`❌ Training assignment email not sent to trainer:`, e.message)
    );
  } else {
    console.warn(`⚠️ Trainer #${trainerId} has no email address.`);
  }

  notifyMany(requesters.map(r => r.id), training.id, 'second_validation_approved',
    `Votre demande de formation "${training.name}" a été approuvée (2ème validation). Un formateur a été désigné.`);
  notify(trainer.id, training.id, 'trainer_assigned',
    `Vous avez été désigné formateur pour le training "${training.name}".`);

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
    notify(owner.id, training.id, 'second_validation_rejected',
      `Votre demande de formation "${training.name}" a été rejetée par le 2ème validateur.`);
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
    notify(owner.id, training.id, 'second_validation_update_requested',
      `Des modifications sont requises pour votre demande de formation "${training.name}" (2ème validation).`);
  }

  return training;
}

// ── Trainer: mark training as done (awaiting owner validation) ──────────────

async function markTrainingDone(trainingId, docFile) {
  console.log("icii");
  const training = await Training.findByPk(trainingId);
  if (!training) {
    const err = new Error(`Training #${trainingId} introuvable.`);
    err.status = 404;
    throw err;
  }
  console.log('markTrainingDone called with docFile:', docFile);
  if (training.status !== 'in progress') {
    const err = new Error(`Le training doit être "in progress" pour être marqué comme terminé (statut actuel : ${training.status}).`);
    err.status = 400;
    throw err;
  }

  const now = new Date();
  await training.update({
    status:              'awaiting_owner_validation',
    trainer_done_at:     now,
    last_reminder_sent_at: null,
    documentation_path:  docFile ? `/uploads/documentation/${docFile.filename}` : training.documentation_path,
    documentation_name:  docFile ? docFile.originalname : training.documentation_name,
  });

  const fresh      = await getTrainingById(trainingId);
  const requesters = await training.getRequesters();
  const owner      = requesters[0];
  const trainer    = training.trainer_id ? await CompanyMember.findByPk(training.trainer_id) : null;

  if (owner && trainer) {
    sendOwnerValidationEmail({ owner, training: fresh, trainer, docFile }).catch(e =>
      console.error('❌ Owner validation email not sent:', e.message)
    );
  }

  if (owner) {
    notify(owner.id, trainingId, 'training_awaiting_owner_validation',
      `Le formateur a complété le training "${training.name}" et soumis la documentation. Votre validation est requise.`);
  }

  return fresh;
}

// ── Owner: accept the completed training → status = done ─────────────────────

async function ownerAcceptTraining(trainingId) {
  const training = await Training.findByPk(trainingId);
  if (!training) {
    const err = new Error(`Training #${trainingId} introuvable.`);
    err.status = 404;
    throw err;
  }

  if (training.status !== 'awaiting_owner_validation') {
    const err = new Error(`Ce training n'est pas en attente de validation propriétaire (statut actuel : ${training.status}).`);
    err.status = 400;
    throw err;
  }

  await training.update({
    status:              'done',
    final_validation:    'accepted',
    final_approved_at:   new Date(),
  });

  const fresh      = await getTrainingById(trainingId);
  const requesters = await training.getRequesters();
  const trainer    = training.trainer_id ? await CompanyMember.findByPk(training.trainer_id) : null;

  if (trainer && requesters.length > 0) {
    sendTrainerDoneEmail({ training: fresh, trainer, requesters }).catch(e =>
      console.error('❌ Trainer-done email not sent:', e.message)
    );
  }

  if (trainer) {
    notify(trainer.id, trainingId, 'owner_accepted',
      `Le propriétaire a validé votre soumission pour le training "${fresh.name}". Le training est maintenant terminé.`);
  }
  notifyMany(requesters.map(r => r.id), trainingId, 'training_completed',
    `Le training "${fresh.name}" a été validé par le propriétaire et est maintenant terminé.`);

  return fresh;
}

// ── Owner: request revisions from the trainer → back to in progress ──────────

async function ownerRequestRevision(trainingId, comment) {
  const training = await Training.findByPk(trainingId);
  if (!training) {
    const err = new Error(`Training #${trainingId} introuvable.`);
    err.status = 404;
    throw err;
  }

  if (training.status !== 'awaiting_owner_validation') {
    const err = new Error(`Ce training n'est pas en attente de validation propriétaire (statut actuel : ${training.status}).`);
    err.status = 400;
    throw err;
  }

  if (!comment || !comment.trim()) {
    const err = new Error('Un commentaire est requis pour demander des modifications.');
    err.status = 400;
    throw err;
  }

  await training.update({
    status:           'in progress',
    owner_comment:    comment.trim(),
    final_validation: 'update_requested',
  });

  const trainer = training.trainer_id ? await CompanyMember.findByPk(training.trainer_id) : null;
  if (trainer && trainer.email) {
    sendTrainerRevisionEmail({ trainer, training, comment: comment.trim() }).catch(e =>
      console.error('❌ Trainer revision email not sent:', e.message)
    );
  }

  if (trainer) {
    notify(trainer.id, trainingId, 'owner_revision_requested',
      `Le propriétaire a demandé des révisions pour le training "${training.name}". Consultez leurs commentaires et soumettez à nouveau.`);
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
  markTrainingDone,
  ownerAcceptTraining,
  ownerRequestRevision,
  getTrainingsByManager,
};

