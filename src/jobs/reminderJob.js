/**
 * reminderJob.js
 * Cron job: every day at 08:00, sends reminder emails to validators
 * who have not yet acted on a pending training request for 3+ days.
 *
 * 1st validation: status='pending', first_validation IS NULL
 *   → reference date: last_reminder_sent_at (or created_at if never reminded)
 *
 * 2nd validation: status='pending', first_validation='accepted', second_validation IS NULL
 *   → reference date: last_reminder_sent_at (or first_approved_at if never reminded for phase 2)
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const { Training, CompanyMember } = require('../models/index');
const {
  sendFirstValidationReminder,
  sendSecondValidationReminder,
} = require('../emailService/reminderEmailService');
const { sendOwnerValidationReminderEmail } = require('../emailService/ownerValidationEmailService');
const { notify, notifyMany } = require('../services/notificationService');

const REMINDER_INTERVAL_DAYS = 3;

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function sendFirstValidationReminders() {
  const cutoff = daysAgo(REMINDER_INTERVAL_DAYS);

  // Trainings awaiting 1st validation, where either:
  // - Never reminded AND created 3+ days ago, OR
  // - Last reminded 3+ days ago
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
        notify(manager.id, training.id, 'reminder_first_validation',
          `Reminder: The training "${training.name}" is awaiting your 1st validation.`);
      } catch (e) {
        console.error(`❌ 1st validation reminder failed for manager ${manager.email}:`, e.message);
      }
    }

    // Update timestamp after sending to all managers
    await training.update({ last_reminder_sent_at: now });
  }

  console.log(`✅ 1st validation reminders sent for ${trainings.length} training(s).`);
}

async function sendSecondValidationReminders() {
  const cutoff = daysAgo(REMINDER_INTERVAL_DAYS);

  // Trainings awaiting 2nd validation, where either:
  // - last_reminder_sent_at is null AND first_approved_at is 3+ days ago (newly entered 2nd validation phase and never reminded)
  // - OR last_reminder_sent_at is 3+ days ago
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
    try {
      await sendSecondValidationReminder({ training, requesters: training.requesters });
      // Notify 2nd validator if they exist as a CompanyMember
      const secondValidatorEmail = process.env.SECOND_VALIDATOR_EMAIL;
      if (secondValidatorEmail) {
        const validator = await CompanyMember.findOne({ where: { email: secondValidatorEmail } });
        if (validator) {
          notify(validator.id, training.id, 'reminder_second_validation',
            `Reminder: The training "${training.name}" is awaiting your 2nd validation.`);
        }
      }
      await training.update({ last_reminder_sent_at: new Date() });
    } catch (e) {
      console.error(`❌ 2nd validation reminder failed for training #${training.id}:`, e.message);
    }
  }

  console.log(`✅ 2nd validation reminders sent for ${trainings.length} training(s).`);
}

async function sendOwnerValidationReminders() {
  const cutoff = daysAgo(REMINDER_INTERVAL_DAYS);

  // Trainings awaiting owner validation where:
  // - Never reminded AND trainer_done_at is 3+ days ago, OR
  // - Last reminded 3+ days ago
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
      notify(owner.id, training.id, 'reminder_owner_validation',
        `Reminder: The training "${training.name}" has been awaiting your owner validation for several days.`);
      await training.update({ last_reminder_sent_at: new Date() });
    } catch (e) {
      console.error(`❌ Owner validation reminder failed for training #${training.id}:`, e.message);
    }
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

/**
 * Schedule: every day at 08:00 server time.
 * To change interval, edit the cron expression:
 *   '0 8 * * *'  → daily at 08:00
 */
function startReminderJob() {
  cron.schedule('0 8 * * *', runReminderJob, { timezone: 'Europe/Paris' });
  console.log('✅ Reminder job scheduled (daily at 08:00 Europe/Paris).');
}

module.exports = { startReminderJob, runReminderJob };
