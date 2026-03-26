require('dotenv').config();
const { DataTypes } = require('sequelize');
const { sequelize } = require('../src/models/index');

async function addUserAuthRoleColumn() {
  const queryInterface = sequelize.getQueryInterface();
  const tableName = 'user_auth';
  const columnName = 'role';

  try {
    const table = await queryInterface.describeTable(tableName);

    if (table[columnName]) {
      console.log(`✅ La colonne "${columnName}" existe déjà dans "${tableName}".`);
      process.exit(0);
    }

    await queryInterface.addColumn(tableName, columnName, {
      type: DataTypes.ENUM('user', 'admin'),
      allowNull: false,
      defaultValue: 'user',
    });

    console.log(`✅ Colonne "${columnName}" ajoutée à "${tableName}".`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Impossible d'ajouter "${columnName}" à "${tableName}":`, error.message);
    process.exit(1);
  }
}

addUserAuthRoleColumn();
