require('dotenv').config();
const path    = require('path');
const express = require('express');
const cors    = require('cors');

const { sequelize } = require('./src/models/index');
const routes        = require('./src/routes/index');
const errorHandler  = require('./src/middlewares/errorHandler');

const app = express();

// ── Middlewares globaux ───────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Fichiers statiques (photos, vidéos, quiz) ─────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ── 404 pour les routes inconnues ─────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route introuvable.' });
});

// ── Gestionnaire d'erreurs centralisé ─────────────────────────────────────────
app.use(errorHandler);

// ── Démarrage ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

sequelize.authenticate()
  .then(() => {
    console.log('✅ Connexion PostgreSQL réussie.');
    return sequelize.sync(); 
  })
  .then(() => {
    console.log('✅ Tables synchronisées : users, trainings, quizzes, training_media.');
    app.listen(PORT, () => {
      console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
      console.log(`   → API disponible sur http://localhost:${PORT}/api`);
    });
  })
  .catch(err => {
    console.error('❌ Erreur de démarrage :', err);
    process.exit(1);
  });