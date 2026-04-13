const fs = require('fs');
const path = require('path');

const generateTTS = async (text, uploadsDir) => {
  console.log(`[TTS Service] Generating for: ${text}`);
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
    const outputPath = path.join(uploadsDir, filename);

    fs.writeFileSync(outputPath, buffer);
    console.log(`[TTS Service] Generated: ${filename}`);
    
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('[TTS Service] Error:', err);
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

module.exports = {
  generateTTS,
  buildSpeechText
};