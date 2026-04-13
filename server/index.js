const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Constants & Config
const PORT = process.env.PORT || 4000;
const DATA_DIR = process.cwd();
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PRESETS_FILE = path.join(DATA_DIR, 'presets.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const DEFAULT_SETTINGS = {
  nickScale: 1.2,
  amountScale: 1.1,
  textSize: 40,
  commentSize: 40
};

// Initialize App
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure Directories
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PRESETS_FILE)) fs.writeFileSync(PRESETS_FILE, JSON.stringify([], null, 2));

// Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({ storage });

// API Routes
const apiRoutes = require('./src/routes/api')(io, UPLOADS_DIR, PRESETS_FILE, SETTINGS_FILE, DEFAULT_SETTINGS);
app.use('/api', apiRoutes);

// File Upload Route (Specific to Multer)
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  // We return relative path for better portability
  res.json({ 
    url: `/uploads/${req.file.filename}`, 
    filename: req.file.filename 
  });
});

// SPA Fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
server.listen(PORT, () => {
  console.log(`
  ================================================
  🚀 Server running on http://localhost:${PORT}
  ================================================
  `);
  
  // Auto-open only if not in production
  if (process.env.NODE_ENV !== 'production') {
    const exec = require('child_process').exec;
    exec(`start http://localhost:${PORT}/admin`);
    exec(`start http://localhost:${PORT}/overlay`);
  }
});