const QUIZ_FILE_DESCRIPTION = 'Le fichier quiz peut etre n importe quel document ou fichier joint.';

function isAllowedQuizMime(_value) {
  return true;
}

module.exports = {
  QUIZ_FILE_DESCRIPTION,
  isAllowedQuizMime,
};
