const { CompanyMember } = require('../models/index');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

async function getAllUsers() {
  return CompanyMember.findAll({
    attributes: { exclude: ['password'] },
    order: [['last_name', 'ASC'], ['first_name', 'ASC']],
  });
}

async function signIn(email, password) {
  const member = await CompanyMember.findOne({ where: { email } });
  console.log(`Tentative de connexion pour ${email} : ${member ? 'Utilisateur trouvé' : 'Utilisateur non trouvé'}`);
  if (!member) {
    const err = new Error('Email ou mot de passe incorrect.');
    err.status = 401;
    throw err;
  }

  if (!member.password) {
    const err = new Error('Ce compte ne dispose pas d\'un mot de passe local.');
    err.status = 403;
    throw err;
  }

  const valid = await bcrypt.compare(password, member.password);
  if (!valid) {
    const err = new Error('Email ou mot de passe incorrect.');
    err.status = 401;
    throw err;
  }

  const token = jwt.sign(
    { id: member.id, email: member.email, account_type: member.account_type },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  );

  return {
    token,
    member: {
      id:           member.id,
      display_name: member.display_name,
      first_name:   member.first_name,
      last_name:    member.last_name,
      email:        member.email,
      job_title:    member.job_title,
      department:   member.department,
      account_type: member.account_type,
    },
  };
}

async function getUserById(id) {
  const member = await CompanyMember.findByPk(id, {
    attributes: { exclude: ['password'] },
  });
  if (!member) {
    const err = new Error(`Membre #${id} introuvable.`);
    err.status = 404;
    throw err;
  }
  return member;
}

module.exports = {
  getAllUsers,
  getUserById,
  signIn,
};
