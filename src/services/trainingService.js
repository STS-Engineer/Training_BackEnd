const { sequelize, Training, CompanyMember, Quiz, TrainingMedia } = require('../models/index');
const { Op, QueryTypes } = require('sequelize');
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

async function getTrainingWithAttachments(trainingId) {
  return Training.findByPk(trainingId, {
    include: [
      { model: Quiz, as: 'quizzes' },
      { model: TrainingMedia, as: 'media' },
    ],
  });
}

async function getMembersByTrainingLink(trainingId, joinTable) {
  const rows = await sequelize.query(
    `SELECT member_id
       FROM ${joinTable}
      WHERE training_id = :trainingId
      ORDER BY created_at ASC, member_id ASC`,
    {
      replacements: { trainingId },
      type: QueryTypes.SELECT,
    }
  );

  const memberIds = rows.map(row => Number(row.member_id)).filter(Boolean);
  if (memberIds.length === 0) return [];

  const members = await CompanyMember.findAll({
    where: { id: memberIds },
  });

  const membersById = new Map(members.map(member => [Number(member.id), member]));
  return memberIds.map(id => membersById.get(id)).filter(Boolean);
}

async function getRequestersForTraining(trainingId) {
  return getMembersByTrainingLink(trainingId, 'training_requesters');
}

async function getRequesterSupervisorsForTraining(trainingId) {
  return getMembersByTrainingLink(trainingId, 'training_requester_supervisors');
}

async function getApprovalManagersForTraining(trainingId, managerId = null) {
  const managers = await getMembersByTrainingLink(trainingId, 'training_managers');
  if (managerId === null || managerId === undefined) return managers;
  return managers.filter(manager => Number(manager.id) === Number(managerId));
}

async function hydrateTrainingRelations(training) {
  if (!training) return training;

  const [requesters, requesterSupervisors, approvalManagers] = await Promise.all([
    getRequestersForTraining(training.id),
    getRequesterSupervisorsForTraining(training.id),
    getApprovalManagersForTraining(training.id),
  ]);

  training.setDataValue('requesters', requesters);
  training.setDataValue('requesterSupervisors', requesterSupervisors);
  training.setDataValue('approvalManagers', approvalManagers);

  return training;
}

async function hydrateTrainingRelationsList(trainings) {
  return Promise.all(trainings.map(training => hydrateTrainingRelations(training)));
}

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

  if (managerIds.length > 0) {
    const managers = await CompanyMember.findAll({ where: { id: managerIds } });
    const owner = requesters[0];
    const trainingWithAttachments = await getTrainingWithAttachments(training.id);
    for (const manager of managers) {
      sendTrainingApprovalEmail({ manager, training: trainingWithAttachments || training, requesters, owner }).catch(e =>
        console.error(`❌ Email non envoyé à ${manager.email}:`, e.message)
      );
    }
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

  const managers = await getApprovalManagersForTraining(training.id, managerId);
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

  const requesters = await getRequestersForTraining(training.id);
  const trainingWithAttachments = await getTrainingWithAttachments(training.id);
  sendSecondValidatorApprovalEmail({ training: trainingWithAttachments || training, requesters }).catch(e =>
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
    `Your training request "${training.name}" has been approved (1st validation) and forwarded to the final validator.`);

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

  const managers = await getApprovalManagersForTraining(training.id, managerId);
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

  const requesters = await getRequestersForTraining(training.id);
  const owner = requesters[0];
  if (owner) {
    sendTrainingResultEmail({ owner, training, manager: managers[0], decision: 'rejected', comment, validationStep: '1st' }).catch(e =>
      console.error(`❌ Result email not sent to ${owner.email}:`, e.message)
    );
    notify(owner.id, training.id, 'first_validation_rejected',
      `Your training request "${training.name}" has been rejected by the 1st validator.`);
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

  const rows = await sequelize.query(
    `SELECT training_id
       FROM training_managers
      WHERE member_id = :managerId
      ORDER BY created_at DESC, training_id DESC`,
    {
      replacements: { managerId },
      type: QueryTypes.SELECT,
    }
  );

  const trainingIds = rows.map(row => Number(row.training_id)).filter(Boolean);
  if (trainingIds.length === 0) return [];

  const trainings = await Training.findAll({
    where: { id: trainingIds },
    include: [
      { model: Quiz,          as: 'quizzes' },
      { model: TrainingMedia, as: 'media'   },
    ],
    order: [['created_at', 'DESC']],
  });

  return hydrateTrainingRelationsList(trainings);
}

async function getAllTrainings() {
  const trainings = await Training.findAll({
    include: [
      { model: Quiz,          as: 'quizzes' },
      { model: TrainingMedia, as: 'media'   },
    ],
    order: [['created_at', 'DESC']],
  });

  return hydrateTrainingRelationsList(trainings);
}

async function getTrainingById(id) {
  const training = await Training.findByPk(id, {
    include: [
      { model: Quiz,          as: 'quizzes' },
      { model: TrainingMedia, as: 'media'   },
    ],
  });
  if (!training) {
    const err = new Error(`Training #${id} introuvable.`);
    err.status = 404;
    throw err;
  }
  return hydrateTrainingRelations(training);
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
    const requesters = await getRequestersForTraining(training.id);

    if (training.first_validation === 'accepted') {
      sendSecondValidatorUpdatedEmail({ training: fresh, requesters }).catch(e =>
        console.error('❌ Second validator updated email not sent:', e.message)
      );
    } else {
      const managers = await getApprovalManagersForTraining(training.id);
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

  const managers = await getApprovalManagersForTraining(training.id, managerId);
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

  const requesters = await getRequestersForTraining(training.id);
  const owner = requesters[0];
  if (owner) {
    sendUpdateRequestEmail({ owner, training, manager: managers[0], comment }).catch(e =>
      console.error(`❌ Update request email not sent to ${owner.email}:`, e.message)
    );
    notify(owner.id, training.id, 'first_validation_update_requested',
      `Changes are required for your training request "${training.name}" (1st validation).`);
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

  const requesters = await getRequestersForTraining(training.id);
  const owner = requesters[0];
  if (owner) {
    sendTrainingResultEmail({ owner, training, manager: { display_name: process.env.SECOND_VALIDATOR_NAME || 'Second Validator', email: process.env.SECOND_VALIDATOR_EMAIL }, decision: 'approved', comment: null, validationStep: '2nd' }).catch(e =>
      console.error(`❌ Result email not sent to ${owner.email}:`, e.message)
    );
  }

  if (trainer.email) {
    const trainingWithAttachments = await getTrainingWithAttachments(training.id);
    sendTrainingAssignedEmail({ trainer, training: trainingWithAttachments || training, requesters }).catch(e =>
      console.error(`❌ Training assignment email not sent to trainer:`, e.message)
    );
  } else {
    console.warn(`⚠️ Trainer #${trainerId} has no email address.`);
  }

  notifyMany(requesters.map(r => r.id), training.id, 'second_validation_approved',
    `Your training request "${training.name}" has been fully approved (2nd validation). A trainer has been assigned.`);
  notify(trainer.id, training.id, 'trainer_assigned',
    `You have been assigned as trainer for the training "${training.name}".`);

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

  const requesters = await getRequestersForTraining(training.id);
  const owner = requesters[0];
  if (owner) {
    sendTrainingResultEmail({ owner, training, manager: { display_name: process.env.SECOND_VALIDATOR_NAME || 'Second Validator', email: process.env.SECOND_VALIDATOR_EMAIL }, decision: 'rejected', comment, validationStep: '2nd' }).catch(e =>
      console.error(`❌ Result email not sent to ${owner.email}:`, e.message)
    );
    notify(owner.id, training.id, 'second_validation_rejected',
      `Your training request "${training.name}" has been rejected by the 2nd validator.`);
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

  const requesters = await getRequestersForTraining(training.id);
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
      `Changes are required for your training request "${training.name}" (2nd validation).`);
  }

  return training;
}

// ── Trainer: mark training as done (awaiting owner validation) ──────────────

async function markTrainingDone(trainingId, docFile, payload = {}) {
  const link = payload.link && String(payload.link).trim() ? String(payload.link).trim() : null;
  const descriptionDone = payload.description_done && String(payload.description_done).trim()
    ? String(payload.description_done).trim()
    : null;
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
    documentation_path:  docFile ? `/uploads/documentation/${docFile.filename}` : null,
    documentation_name:  docFile ? docFile.originalname : null,
    link,
    description_done: descriptionDone,
  });

  const fresh      = await getTrainingById(trainingId);
  const requesters = await getRequestersForTraining(training.id);
  const owner      = requesters[0];
  const trainer    = training.trainer_id ? await CompanyMember.findByPk(training.trainer_id) : null;

  if (owner && trainer) {
    sendOwnerValidationEmail({ owner, training: fresh, trainer, docFile }).catch(e =>
      console.error('❌ Owner validation email not sent:', e.message)
    );
  }

  if (owner) {
    notify(owner.id, trainingId, 'training_awaiting_owner_validation',
      docFile
        ? `The trainer has completed the training "${training.name}" and submitted the documentation. Your validation is required.`
        : `The trainer has completed the training "${training.name}". Your validation is required.`);
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
  const requesters = await getRequestersForTraining(training.id);
  const trainer    = training.trainer_id ? await CompanyMember.findByPk(training.trainer_id) : null;

  if (trainer && requesters.length > 0) {
    sendTrainerDoneEmail({ training: fresh, trainer, requesters }).catch(e =>
      console.error('❌ Trainer-done email not sent:', e.message)
    );
  }

  if (trainer) {
    notify(trainer.id, trainingId, 'owner_accepted',
      `The owner has validated your submission for the training "${fresh.name}". The training is now complete.`);
  }
  notifyMany(requesters.map(r => r.id), trainingId, 'training_completed',
    `The training "${fresh.name}" has been validated by the owner and is now complete.`);

  return fresh;
}

// ── Owner: request revisions from the trainer → back to in progress ──────────

async function ownerRequestRevision(trainingId, comment, imageFiles = []) {
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

  const imagePaths = imageFiles.map(f => `/uploads/revision-images/${f.filename}`);

  await training.update({
    status:                'in progress',
    owner_comment:         comment.trim(),
    final_validation:      'update_requested',
    owner_revision_images: imagePaths.length ? JSON.stringify(imagePaths) : null,
  });

  const trainer = training.trainer_id ? await CompanyMember.findByPk(training.trainer_id) : null;
  if (trainer && trainer.email) {
    sendTrainerRevisionEmail({ trainer, training, comment: comment.trim(), imageFiles }).catch(e =>
      console.error('❌ Trainer revision email not sent:', e.message)
    );
  }

  if (trainer) {
    notify(trainer.id, trainingId, 'owner_revision_requested',
      `The owner has requested revisions for the training "${training.name}". Please review their comments and resubmit.`);
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

