const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Use process.cwd() for data files so they persist outside the executable
const DATA_DIR = process.cwd();
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PRESETS_FILE = path.join(DATA_DIR, 'presets.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// CORS settings
app.use(cors());
app.use(express.json());

// Serve static files (Uploaded images/audio) from the writable directory
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve Frontend (Bundled in the executable)
// __dirname works inside pkg for bundled assets
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Multer Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

// Initialize Presets
if (!fs.existsSync(PRESETS_FILE)) {
  fs.writeFileSync(PRESETS_FILE, JSON.stringify([], null, 2));
}

// Default Settings
const DEFAULT_SETTINGS = {
  nickScale: 1.2,
  amountScale: 1.1,
  textSize: 40,
  commentSize: 40
};

// --- API Routes ---

// 0. Settings
app.get('/api/settings', (req, res) => {
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    return res.json(DEFAULT_SETTINGS);
  }
  fs.readFile(SETTINGS_FILE, 'utf8', (err, data) => {
    if (err) return res.json(DEFAULT_SETTINGS);
    try {
      res.json({ ...DEFAULT_SETTINGS, ...JSON.parse(data) });
    } catch {
      res.json(DEFAULT_SETTINGS);
    }
  });
});

app.post('/api/settings', (req, res) => {
  const settings = req.body;
  fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), (err) => {
    if (err) return res.status(500).json({ error: 'Failed to save settings' });
    io.emit('update_settings', settings);
    res.json({ success: true });
  });
});

// 1. Presets
app.get('/api/presets', (req, res) => {
  fs.readFile(PRESETS_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read presets' });
    try {
      res.json(JSON.parse(data));
    } catch {
      res.json([]);
    }
  });
});

// 2. Save Presets
app.post('/api/presets', (req, res) => {
  const newPresets = req.body || [];
  fs.writeFile(PRESETS_FILE, JSON.stringify(newPresets, null, 2), (err) => {
    if (err) return res.status(500).json({ error: 'Failed to save presets' });
    res.json({ success: true });
  });
});

// 3. File Upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `http://localhost:3001/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.filename });
});

// Native Node.js TTS Generation (No Python dependency)
const generateTTS = async (text) => {
  console.log(`Generating TTS for: ${text}`);
  if (!text || !text.trim()) return null;

  try {
    const encodedText = encodeURIComponent(text);
    const url = `https://cache-a.oddcast.com/tts/genC.php?EID=3&LID=13&VID=2&TXT=${encodedText}&EXT=mp3&FNAME=&ACC=9066743&SceneID=2770702&HTTP_ERR=`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        "Origin": "https://www.oddcast.com",
        "Referer": "https://www.oddcast.com/",
      }
    });

    if (!response.ok) {
      throw new Error(`TTS Request failed: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const filename = `tts-${Date.now()}.mp3`;
    const outputPath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(outputPath, buffer);
    console.log(`TTS Generated: ${filename}`);
    
    return `http://localhost:3001/uploads/${filename}`;

  } catch (err) {
    console.error('TTS Error:', err);
    return null;
  }
};

const buildSpeechText = (template, nickname, count) => {
  const safeTemplate = template || '{닉네임}님 {개수}캐시 후원 감사합니다!';
  const formattedCount = Number(count).toLocaleString();

  return safeTemplate
    .replaceAll('{닉네임}', nickname || '익명')
    .replaceAll('{금액}', formattedCount)
    .replaceAll('{개수}', formattedCount)
    .replaceAll('{종류}', '후원')
    .replace(/\s+/g, ' ')
    .trim();
};

// 4. Trigger Alert
app.post('/api/trigger', async (req, res) => {
  const { amount, message, preset, template, nickname, comment } = req.body || {};

  const safePreset = preset || {};
  const safeTTS = safePreset.ttsConfig || {};

  let finalNickname = nickname || "익명";
  let finalComment = comment || "";
  
  if (!nickname && !comment && message && message.includes('//')) {
    const parts = message.split('//');
    finalNickname = parts[0];
    finalComment = parts[1];
  } else if (!comment && message) {
    finalComment = message;
  }

  const effectiveTemplate = template || safePreset.template || "{닉네임}님 {금액}원 후원 감사합니다!";
  
  let serverAudioUrl = safePreset.audio || null;
  let finalSoundType = safePreset.soundType || (serverAudioUrl ? 'file' : 'none');

  if (finalSoundType === 'tts') {
    const ttsText = buildSpeechText(effectiveTemplate, finalNickname, amount);
    if (ttsText && ttsText.trim()) {
      const generatedUrl = await generateTTS(ttsText);
      if (generatedUrl) {
        serverAudioUrl = generatedUrl;
        finalSoundType = 'file';
      }
    }
  }

  const payload = {
    amount: Number(amount) || 0,
    nickname: finalNickname,
    comment: finalComment,
    message: message || finalComment,
    imageSrc: safePreset.image || null,
    audioSrc: serverAudioUrl,
    soundType: finalSoundType,
    ttsConfig: safeTTS,
    duration: typeof safePreset.duration === 'number' ? safePreset.duration : (parseInt(safePreset.duration) || 0),
    template: effectiveTemplate,
    id: Date.now()
  };

  console.log('[Trigger]', payload);
  io.emit('new_donation', payload);
  res.json({ success: true });
});

// 5. Stop Alert
app.post('/api/stop', (req, res) => {
  io.emit('stop_alert');
  res.json({ success: true });
});

// Catch-all for React Router (must be last)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Open browser automatically on Windows
  require('child_process').exec('start http://localhost:3001/admin');
  require('child_process').exec('start http://localhost:3001/overlay');
});
