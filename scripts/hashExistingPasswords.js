require('dotenv').config();
const bcrypt        = require('bcryptjs');
const { sequelize, CompanyMember } = require('../src/models/index');

(async () => {
  try {
    await sequelize.authenticate();

    const members = await CompanyMember.findAll();
    let updated = 0;
    let skipped = 0;

    for (const member of members) {
      if (member.password && (member.password.startsWith('$2b$') || member.password.startsWith('$2a$'))) {
        console.log(`⏭️  Déjà hashé  : ${member.display_name}`);
        skipped++;
        continue;
      }

      const base = (member.first_name || member.display_name || 'User').trim();
      const plainPassword = `${base}@2026`;
      const hashed = await bcrypt.hash(plainPassword, 10);

      await member.update({ password: hashed });
      console.log(`✅ Hashé : ${member.display_name} → ${plainPassword}`);
      updated++;
    }

    console.log(`\n📊 Résultat : ${updated} mis à jour, ${skipped} déjà hashé(s).`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur :', err.message);
    process.exit(1);
  }
})();
