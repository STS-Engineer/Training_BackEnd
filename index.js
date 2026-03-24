require('dotenv').config();
const path    = require('path');
const express = require('express');
const cors    = require('cors');

const { sequelize }        = require('./src/models/index');
const { sequelizeSecond }  = require('./src/models/indexSecond');
const routes               = require('./src/routes/index');
const errorHandler         = require('./src/middlewares/errorHandler');
const { startReminderJob } = require('./src/jobs/reminderJob');
const { startMemberListener } = require('./src/services/memberListener'); // ← ajout

const app = express();

// ── Middlewares globaux ───────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Fichiers statiques ────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route introuvable.' });
});

// ── Gestionnaire d'erreurs ────────────────────────────────────────────────────
app.use(errorHandler);

// ── Démarrage ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

sequelize.authenticate()
  .then(() => {
    console.log('✅ Connexion PostgreSQL AVOCarbonDB_Form réussie.');
    return sequelize.sync();
  })
  .then(() => {
    console.log('✅ Tables synchronisées.');

    // ── Connexion DB2 avocarbon_directory ─────────────────
    return sequelizeSecond.authenticate();
  })
  .then(() => {
    console.log('✅ Connexion PostgreSQL avocarbon_directory réussie.');

    // ── Démarrer le listener trigger (optionnel) ──────────────────────
    // Ne pas bloquer le serveur si le listener échoue
    startMemberListener().catch(err => {
      console.warn('⚠️  Listener non disponible:', err.message);
    });

    return Promise.resolve();
  })
  .then(() => {
    startReminderJob();
    app.listen(PORT, () => {
      console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
      console.log(`   → API disponible sur http://localhost:${PORT}/api`);
    });
  })
  .catch(err => {
    console.error('❌ Erreur de démarrage :', err);
    process.exit(1);
  });