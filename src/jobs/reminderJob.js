
const cron = require('node-cron');
const { Op } = require('sequelize');
const { Training, CompanyMember } = require('../models/index');
const {
  sendFirstValidationReminder,
  sendSecondValidationReminder,
} = require('../emailService/reminderEmailService');
const { sendOwnerValidationReminderEmail } = require('../emailService/ownerValidationEmailService');
const { notify } = require('../services/notificationService');

const REMINDER_INTERVAL_DAYS = 3;
const REMINDER_CRON = process.env.REMINDER_CRON || '0 8 */3 * *';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function sendFirstValidationReminders() {
  const cutoff = daysAgo(REMINDER_INTERVAL_DAYS);

  const trainings = await Training.findAll({
    where: {
      status:           'pending',
      first_validation: null,
      [Op.or]: [
        { last_reminder_sent_at: null,       created_at:           { [Op.lte]: cutoff } },
        { last_reminder_sent_at: { [Op.lte]: cutoff } },
      ],
    },
    include: [
      {
        model: CompanyMember,
        as:    'approvalManagers',
        attributes: ['id', 'display_name', 'email', 'first_name'],
        through: { attributes: [] },
      },
      {
        model: CompanyMember,
        as:    'requesters',
        attributes: ['id', 'display_name', 'email', 'first_name'],
        through: { attributes: [] },
      },
    ],
  });

  if (trainings.length === 0) {
    console.log('ℹ️  No 1st-validation reminders to send.');
    return;
  }

  for (const training of trainings) {
    const now = new Date();

    for (const manager of training.approvalManagers) {
      try {
        await sendFirstValidationReminder({ manager, training, requesters: training.requesters });
      } catch (e) {
        console.error(`❌ 1st validation reminder email failed for manager ${manager.email}:`, e.message);
      }

      try {
        await notify(manager.id, training.id, 'reminder_first_validation',
          `Reminder: The training "${training.name}" is awaiting your 1st validation.`);
      } catch (e) {
        console.error(`❌ 1st validation reminder notification failed for manager ${manager.email}:`, e.message);
      }
    }

    await training.update({ last_reminder_sent_at: now });
  }

  console.log(`✅ 1st validation reminders sent for ${trainings.length} training(s).`);
}

async function sendSecondValidationReminders() {
  const cutoff = daysAgo(REMINDER_INTERVAL_DAYS);

  const trainings = await Training.findAll({
    where: {
      status:            'pending',
      first_validation:  'accepted',
      second_validation: null,
      [Op.or]: [
        { last_reminder_sent_at: null,       first_approved_at: { [Op.lte]: cutoff } },
        { last_reminder_sent_at: { [Op.lte]: cutoff } },
      ],
    },
    include: [
      {
        model: CompanyMember,
        as:    'requesters',
        attributes: ['id', 'display_name', 'email', 'first_name'],
        through: { attributes: [] },
      },
    ],
  });

  if (trainings.length === 0) {
    console.log('ℹ️  No 2nd-validation reminders to send.');
    return;
  }

  for (const training of trainings) {
    const secondValidatorEmail = process.env.SECOND_VALIDATOR_EMAIL;

    try {
      await sendSecondValidationReminder({ training, requesters: training.requesters });
    } catch (e) {
      console.error(`❌ 2nd validation reminder email failed for training #${training.id}:`, e.message);
    }

    if (secondValidatorEmail) {
      try {
        const validator = await CompanyMember.findOne({ where: { email: secondValidatorEmail } });
        if (validator) {
          await notify(validator.id, training.id, 'reminder_second_validation',
            `Reminder: The training "${training.name}" is awaiting your 2nd validation.`);
        }
      } catch (e) {
        console.error(`❌ 2nd validation reminder notification failed for training #${training.id}:`, e.message);
      }
    }

    await training.update({ last_reminder_sent_at: new Date() });
  }

  console.log(`✅ 2nd validation reminders sent for ${trainings.length} training(s).`);
}

async function sendOwnerValidationReminders() {
  const cutoff = daysAgo(REMINDER_INTERVAL_DAYS);


  const trainings = await Training.findAll({
    where: {
      status: 'awaiting_owner_validation',
      [Op.or]: [
        { last_reminder_sent_at: null, trainer_done_at: { [Op.lte]: cutoff } },
        { last_reminder_sent_at: { [Op.lte]: cutoff } },
      ],
    },
    include: [
      {
        model: CompanyMember,
        as:    'requesters',
        attributes: ['id', 'display_name', 'email', 'first_name', 'last_name'],
        through: { attributes: [] },
      },
    ],
  });

  if (trainings.length === 0) {
    console.log('ℹ️  No owner-validation reminders to send.');
    return;
  }

  for (const training of trainings) {
    const owner = training.requesters[0];
    if (!owner) continue;

    try {
      await sendOwnerValidationReminderEmail({ owner, training });
    } catch (e) {
      console.error(`❌ Owner validation reminder email failed for training #${training.id}:`, e.message);
    }

    try {
      await notify(owner.id, training.id, 'reminder_owner_validation',
        `Reminder: The training "${training.name}" has been awaiting your owner validation for several days.`);
    } catch (e) {
      console.error(`❌ Owner validation reminder notification failed for training #${training.id}:`, e.message);
    }

    await training.update({ last_reminder_sent_at: new Date() });
  }

  console.log(`✅ Owner validation reminders sent for ${trainings.length} training(s).`);
}

async function runReminderJob() {
  console.log('⏰ Running reminder job…');
  try {
    await sendFirstValidationReminders();
    await sendSecondValidationReminders();
    await sendOwnerValidationReminders();
  } catch (err) {
    console.error('❌ Reminder job error:', err.message);
  }
}


function startReminderJob() {
  cron.schedule(REMINDER_CRON, runReminderJob, { timezone: 'Europe/Paris' });
  console.log(`✅ Reminder job scheduled (${REMINDER_CRON}, Europe/Paris).`);
}

module.exports = { startReminderJob, runReminderJob };
