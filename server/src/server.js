require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { syncDatabase } = require('./config/models');
const socketIO = require('./sockets');
const { startScheduler } = require('./services/schedulerService');

const app = express();
app.set('etag', false);
const server = http.createServer(app);

const io = socketIO.init(server);
app.set('io', io);

// ─── SECURITY MIDDLEWARE ──────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());

// ─── CORS ─────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map(o => o.trim());
const corsOptions = {
  origin: (origin, cb) => (!origin || allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS'))),
  credentials: true,
};
// Skip global CORS for /webhooks — they use open CORS (origin: '*') defined on the route itself
app.use((req, res, next) => {
  if (req.path.startsWith('/webhooks')) return next();
  cors(corsOptions)(req, res, next);
});

// ─── RATE LIMITING ────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: (req) => req.path.startsWith('/webhooks'),
});

// ─── BODY PARSING ─────────────────────────────────────────────────────────
app.use('/webhooks', express.json({ limit: '5mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── LOGGING ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── STATIC FILES ─────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
app.use('/uploads', express.static(uploadDir));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── WEBHOOK ROUTES (no rate limit, open CORS) ───────────────────────────
app.use('/webhooks', cors({ origin: '*' }), require('./modules/webhooks/routes'));

// ─── API ROUTES ───────────────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api/auth', require('./modules/auth/routes'));
app.use('/api/superadmin', require('./modules/superadmin/routes'));
app.use('/api/organizations', require('./modules/organizations/routes'));
app.use('/api/workspace', require('./modules/workspaces/routes'));
app.use('/api/leads', require('./modules/leads/routes'));
app.use('/api/followups', require('./modules/followups/routes'));
app.use('/api/appointments', require('./modules/appointments/routes'));
app.use('/api/quotations', require('./modules/quotations/routes'));
app.use('/api/invoices', require('./modules/invoices/routes'));
app.use('/api/payments', require('./modules/payments/routes'));
app.use('/api/content', require('./modules/content/routes'));
app.use('/api/reports', require('./modules/reports/routes'));
app.use('/api/notifications', require('./modules/notifications/routes'));
app.use('/api/users', require('./modules/users/routes'));
app.use('/api/employee-labels', require('./modules/employee-labels/routes'));
app.use('/api/communication', require('./modules/communication/routes'));
app.use('/api/meta-integrations', require('./modules/meta-integrations/routes'));
app.use('/api/team-activity', require('./modules/team-activity/routes'));

// ─── PUBLIC ROUTES (no auth) ──────────────────────────────────────────────
app.use('/api/public', require('./modules/public/routes'));

// ─── 404 HANDLER ──────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ─── ERROR HANDLER ────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

// ─── START ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await syncDatabase();
    console.log('✅ Database connected and synced');
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      startScheduler();
    });
  } catch (err) {
    console.error('❌ Server startup failed:', err);
    process.exit(1);
  }
};

start();

module.exports = { app, server };
