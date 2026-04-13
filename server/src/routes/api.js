const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { generateTTS, buildSpeechText } = require('../services/ttsService');

module.exports = (io, uploadsDir, PRESETS_FILE, SETTINGS_FILE, DEFAULT_SETTINGS) => {
  
  // Settings API
  router.get('/settings', (req, res) => {
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

  router.post('/settings', (req, res) => {
    const settings = req.body;
    fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), (err) => {
      if (err) return res.status(500).json({ error: 'Failed to save settings' });
      io.emit('update_settings', settings);
      res.json({ success: true });
    });
  });

  // Presets API
  router.get('/presets', (req, res) => {
    fs.readFile(PRESETS_FILE, 'utf8', (err, data) => {
      if (err) return res.status(500).json({ error: 'Failed to read presets' });
      try {
        res.json(JSON.parse(data));
      } catch {
        res.json([]);
      }
    });
  });

  router.post('/presets', (req, res) => {
    const newPresets = req.body || [];
    fs.writeFile(PRESETS_FILE, JSON.stringify(newPresets, null, 2), (err) => {
      if (err) return res.status(500).json({ error: 'Failed to save presets' });
      res.json({ success: true });
    });
  });

  // Alert Trigger
  router.post('/trigger', async (req, res) => {
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

    // TTS 설정일 경우 서버에서 MP3 생성
    if (finalSoundType === 'tts') {
      const ttsText = buildSpeechText(effectiveTemplate, finalNickname, amount);
      const commentText = finalComment ? ` ${finalComment}` : "";
      const fullText = `${ttsText}${commentText}`; // 후원 문구 + 코멘트 합치기

      const generatedPath = await generateTTS(fullText, uploadsDir);
      if (generatedPath) {
        serverAudioUrl = generatedPath; // 생성된 MP3 경로로 교체
        finalSoundType = 'file'; // 클라이언트에서는 파일 재생으로 처리
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

    io.emit('new_donation', payload);
    res.json({ success: true });
  });

  router.post('/stop', (req, res) => {
    io.emit('stop_alert');
    res.json({ success: true });
  });

  return router;
};