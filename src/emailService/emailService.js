const { sendTrainingApprovalEmail, sendTrainingUpdatedEmail, generateActionToken, verifyActionToken } = require('./approvalEmailService');
const { sendTrainingResultEmail }   = require('./resultEmailService');
const { sendUpdateRequestEmail }    = require('./updateRequestEmailService');

module.exports = {
  sendTrainingApprovalEmail,
  sendTrainingUpdatedEmail,
  sendTrainingResultEmail,
  sendUpdateRequestEmail,
  generateActionToken,
  verifyActionToken,
};

