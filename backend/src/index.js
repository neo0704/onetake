const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

const connectDB = require('./config/db');
const { initSocket } = require('./socket');

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'https://m2p3c1js-5173.asse.devtunnels.ms',
    process.env.CLIENT_URL
  ].filter(Boolean),
  credentials: true
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files — serve the uploads folder publicly
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


// Routes
app.use('/api/auth',               require('./routes/auth'));
app.use('/api/events',             require('./routes/events'));
app.use('/api/quotations',         require('./routes/quotations'));
app.use('/api/payments',           require('./routes/payments'));
app.use('/api/freelancers',        require('./routes/freelancers'));
app.use('/api/equipment',          require('./routes/equipment'));
app.use('/api/notifications',      require('./routes/notifications'));
app.use('/api/meetings',           require('./routes/meetings'));
app.use('/api/reports',            require('./routes/reports'));
app.use('/api/users',              require('./routes/users'));
app.use('/api/checklist',          require('./routes/checklist'));
app.use('/api/equipment-requests', require('./routes/equipmentRequests'));
app.use('/api/payroll',            require('./routes/payroll'));
app.use('/api/damage-reports',     require('./routes/damageReports'));
app.use('/api/payment-qr',         require('./routes/paymentqr'));
app.use('/api/upload',             require('./routes/uploadRoute'));   // ← image uploads
app.use('/api/homepage',           require('./routes/homepage'));
app.use('/api/settings',           require('./routes/settings'));
app.use('/api/notification-preferences', require('./routes/notificationPreferences'));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OneTake API Running', timestamp: new Date() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 OneTake Server running on port ${PORT}`);
});

module.exports = { app, server };