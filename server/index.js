const express = require('express');
const cors = require('cors');
const sequelize = require('./database');
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const backupRoutes = require('./routes/backups');
const logsRoutes = require('./routes/logs');
const { startScheduler } = require('./services/scheduler');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const packageJson = require('./package.json');
const VERSION = packageJson.version;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/updates', require('./routes/update'));


app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Sync Database and Start Server
sequelize.sync({ alter: true }).then(async () => {
  try {
    await sequelize.query('PRAGMA journal_mode=WAL;');
    console.log('Database WAL mode enabled');
  } catch (err) {
    console.error('Failed to enable WAL mode:', err);
  }
  console.log('Database synced');
  startScheduler();
  const server = app.listen(port, () => {
    console.log('----------------------------------------');
    console.log(`Backup Manager v${VERSION} STARTED`);
    console.log('----------------------------------------');
  });

  // Increase timeout to 10 minutes for long restore operations
  server.timeout = 600000;
  server.keepAliveTimeout = 610000;
}).catch((err) => {
  console.error('Failed to sync database:', err);
});
