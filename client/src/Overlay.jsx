import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './ToonationStyle.css';

const SERVER_URL = `${window.location.protocol}//${window.location.hostname}:4000`;
const socket = io(SERVER_URL);

/* =========================
   공통 유틸
========================= */

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
  });

/* =========================
   TTS Voice 로딩/선택
========================= */

const ensureVoicesLoaded = (timeoutMs = 1500) => {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    if (voices.length > 0) return resolve(voices);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(synth.getVoices());
    };

    const timer = setTimeout(finish, timeoutMs);

    const onChanged = () => {
      clearTimeout(timer);
      finish();
      synth.removeEventListener('voiceschanged', onChanged);
    };

    synth.addEventListener('voiceschanged', onChanged);

    // 혹시 이벤트 안 오면 한 번 더
    setTimeout(() => {
      if (!done && synth.getVoices().length > 0) {
        clearTimeout(timer);
        finish();
      }
    }, 200);
  });
};

const pickKoreanVoice = (voices, configVoiceURI) => {
  const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const isKo = (v) => (v.lang || "").toLowerCase().includes("ko");

  // 1. 유저가 Admin에서 지정한 목소리 (URI 일치)
  if (configVoiceURI) {
    const exact = voices.find(v => v.voiceURI === configVoiceURI);
    if (exact) return exact;
  }

  // 2. 유저 지정이 없거나 못 찾음 -> [무조건 Google 한국어 최우선]
  
  // A. "Google" + ("한국" 또는 "Korean") + lang=ko (가장 정확)
  const googleBest = voices.find(v => {
    const n = norm(v.name);
    return isKo(v) && n.includes("google") && (n.includes("한국") || n.includes("korean"));
  });
  if (googleBest) return googleBest;

  // B. "Google" + lang=ko (이름에 한국어가 없어도 Google이고 한국어면 OK)
  const googleKo = voices.find(v => isKo(v) && norm(v.name).includes("google"));
  if (googleKo) return googleKo;

  // --- 여기까진 Google만 찾음 ---

  // 3. Google이 없다면 -> Microsoft
  const msKo = voices.find(v => isKo(v) && norm(v.name).includes("microsoft"));
  if (msKo) return msKo;

  // 4. 아무 한국어
  const anyKo = voices.find(v => isKo(v));
  if (anyKo) return anyKo;

  return voices[0] || null;
};

const buildSpeechText = (template, nickname, count) => {
  const safeTemplate = template || '{닉네임}님 {개수}캐시 후원 감사합니다!';
  const formattedCount = Number(count).toLocaleString();

  return safeTemplate
    .replaceAll('{닉네임}', nickname || '익명')
    .replaceAll('{금액}', formattedCount)
    .replaceAll('{개수}', formattedCount)
    .replaceAll('{종류}', '후원')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/* =========================
   Overlay Component
========================= */

const waitForAudioReady = (audio, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'));
    if (audio.readyState >= 2) return resolve();

    const cleanup = () => {
      audio.removeEventListener('loadeddata', onReady);
      audio.removeEventListener('canplay', onReady);
      audio.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(audio.error || new Error('Failed to load audio'));
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException('aborted', 'AbortError'));
    };

    audio.addEventListener('loadeddata', onReady, { once: true });
    audio.addEventListener('canplay', onReady, { once: true });
    audio.addEventListener('error', onError, { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });
  });

const Overlay = () => {
  const [queue, setQueue] = useState([]);
  const [currentAlert, setCurrentAlert] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [styleSettings, setStyleSettings] = useState({
    nickScale: 1.2,
    amountScale: 1.1,
    textSize: 40,
    commentSize: 40
  });

  const audioRef = useRef(null);
  const processingRef = useRef(false);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audio.playsInline = true;
    audio.autoplay = false;
    audio.muted = false;
    audio.defaultMuted = false;
    audioRef.current = audio;

    return () => {
      try {
        audio.pause();
        audio.src = '';
        audio.load();
      } catch {}
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
  }, []);

  /* ---------- socket & settings ---------- */
  useEffect(() => {
    // 설정 로드
    fetch(`${SERVER_URL}/api/settings`)
      .then(res => res.json())
      .then(data => setStyleSettings(data))
      .catch(err => console.error(err));

    socket.on('new_donation', (data) => {
      console.log('[Overlay] new_donation', data);
      setQueue(prev => [...prev, data]);
    });

    socket.on('update_settings', (newSettings) => {
      console.log('[Overlay] update_settings', newSettings);
      setStyleSettings(newSettings);
    });

    socket.on('stop_alert', () => {
      console.log('[Overlay] stop_alert received');
      stopAllMedia();
      setIsVisible(false);
      setCurrentAlert(null);
      setQueue([]); // 큐도 비움
      processingRef.current = false;
    });

    return () => {
      socket.off('new_donation');
      socket.off('update_settings');
      socket.off('stop_alert');
    };
  }, []);

  useEffect(() => {
    if (queue.length > 0 && !processingRef.current) {
      processNextAlert();
    }
  }, [queue]);

  /* ---------- 강제 중단 ---------- */
  const stopAllMedia = () => {
    try {
      const a = audioRef.current;
      a.pause();
      a.currentTime = 0;
      a.src = '';
      a.load();
    } catch {}
    try {
      window.speechSynthesis.cancel();
    } catch {}
  };

  /* ---------- Audio ---------- */
  const playAudioWithAbort = (src, signal) =>
    new Promise(async (resolve) => {
      const a = audioRef.current;
      if (!a) return resolve();
      let objectUrl = null;

      const cleanup = () => {
        a.onended = null;
        a.onerror = null;
        signal?.removeEventListener('abort', onAbort);
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
        }
        resolve();
      };

      const onAbort = () => {
        try {
          a.pause();
          a.currentTime = 0;
          a.src = '';
          a.load();
        } catch {}
        cleanup();
      };

      if (signal?.aborted) return cleanup();

      signal?.addEventListener('abort', onAbort, { once: true });

      try {
        a.pause();
        a.currentTime = 0;
        a.src = '';
        a.load();

        // Browser/OBS source playback is more reliable when the file is fully
        // fetched into a blob URL first instead of streaming the remote URL directly.
        const response = await fetch(src, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Audio fetch failed: ${response.status}`);
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        a.src = objectUrl;
        a.volume = 1.0;
        a.muted = false;
        a.defaultMuted = false;
        a.onended = cleanup;
        a.onerror = (event) => {
          console.error('[Overlay] audio element error', event, a.error);
          cleanup();
        };
        a.load();

        await waitForAudioReady(a, signal);
        await a.play();
      } catch (error) {
        console.error('[Overlay] audio playback failed', { src, error });
        cleanup();
      }
    });

  /* ---------- TTS ---------- */
  const playTTS = async (text, ttsConfig = {}, signal) => {
    const synth = window.speechSynthesis;
    try { synth.cancel(); } catch {}

    const cleanText = (text || '').replace(/,/g, '').trim();
    if (!cleanText) return;

    const voices = await ensureVoicesLoaded(1500);
    const voice = pickKoreanVoice(voices, ttsConfig?.voiceURI);

    return new Promise((resolve) => {
      if (signal?.aborted) return resolve();

      const u = new SpeechSynthesisUtterance(cleanText);
      u.lang = 'ko-KR';
      u.rate = typeof ttsConfig.rate === 'number' ? ttsConfig.rate : 1.0;
      u.pitch = typeof ttsConfig.pitch === 'number' ? ttsConfig.pitch : 1.0;
      u.volume = 1.0;
      if (voice) u.voice = voice;

      console.log('[TTS]', voice?.name, voice?.lang);

      const cleanup = () => {
        u.onend = null;
        u.onerror = null;
        signal?.removeEventListener('abort', onAbort);
        resolve();
      };

      const onAbort = () => {
        try { synth.cancel(); } catch {}
        cleanup();
      };

      signal?.addEventListener('abort', onAbort, { once: true });
      u.onend = cleanup;
      u.onerror = cleanup;

      try {
        synth.speak(u);
        const safety = setTimeout(cleanup, 30000);
        u.onend = () => { clearTimeout(safety); cleanup(); };
        u.onerror = () => { clearTimeout(safety); cleanup(); };
      } catch {
        cleanup();
      }
    });
  };

  /* ---------- 메인 ---------- */
  const processNextAlert = async () => {
    processingRef.current = true;

    const alertData = queue[0];
    setQueue(prev => prev.slice(1));
    setCurrentAlert(alertData);
    setIsVisible(true);

    // 닉네임/코멘트 처리
    let nickname = alertData.nickname;
    let comment = alertData.comment;
    
    // 레거시 메시지 파싱
    if (!nickname && !comment && alertData.message) {
      if (alertData.message.includes('//')) {
        const parts = alertData.message.split('//');
        nickname = parts[0];
        comment = parts[1];
      } else {
        nickname = '익명';
        comment = alertData.message;
      }
    }
    
    nickname = nickname || '익명';
    comment = comment || '';

    const count = alertData.amount;

    // 1. TTS용 텍스트: 코멘트만 읽기

    // 2. 표시용 HTML (HTML 태그 포함)
    const formattedNickname = `<span class="nickname-style">${nickname}</span>`;
    const formattedCount = `<span class="amount-style">${Number(count).toLocaleString()}</span>`;
    let displayTemplate = (alertData.template || '{닉네임}님 {금액}원 후원 감사합니다!')
      .replace('{닉네임}', formattedNickname)
      .replace('{금액}', formattedCount)
      .replace('{개수}', formattedCount)
      .replace('{종류}', '후원');

    const soundType = alertData.soundType || (alertData.audioSrc ? 'file' : 'none');
    const ttsConfig = alertData.ttsConfig || {};
    const durationSec = Number(alertData.duration) || 0;

    const controller = new AbortController();
    const { signal } = controller;

    // 오디오 재생 시퀀스
    const playSequence = async () => {
      if (signal.aborted) return;

      // 1. 메인 오디오 (파일 또는 TTS)
      if (soundType === 'file' && alertData.audioSrc) {
        // 서버 주소를 붙여서 가져오도록 수정
        const audioUrl = alertData.audioSrc.startsWith('http') 
          ? alertData.audioSrc 
          : `${SERVER_URL}${alertData.audioSrc}`;
        await playAudioWithAbort(audioUrl, signal);
      } else if (soundType === 'tts') {
        // 클라이언트 TTS
        const speechText = buildSpeechText(alertData.template, nickname, count);
        if (speechText) {
            await playTTS(speechText, ttsConfig, signal);
        }
      } else {
        await sleep(3000, signal);
      }
    };

    if (durationSec > 0) {
      // 오디오 재생 (비동기로 시작, 에러 무시)
      playSequence().catch(() => {});
      
      // 설정된 시간만큼 무조건 대기
      await sleep(durationSec * 1000);
      
      console.log('[Overlay] duration expired');
      controller.abort();
      stopAllMedia();
    } else {
      const start = Date.now();
      await playSequence();
      const elapsed = Date.now() - start;
      // 최소 3초 보장
      if (elapsed < 3000) {
        await sleep(3000 - elapsed, signal);
      }
      await sleep(1000, signal);
    }

    setIsVisible(false);
    await sleep(500);
    setCurrentAlert(null);
    processingRef.current = false;
  };

  if (!currentAlert) return null;

  // 렌더링용 데이터 준비
  let nickname = currentAlert.nickname;
  let comment = currentAlert.comment;
  if (!nickname && !comment && currentAlert.message) {
      if (currentAlert.message.includes('//')) {
          const parts = currentAlert.message.split('//');
          nickname = parts[0];
          comment = parts[1];
      } else {
          nickname = '익명';
          comment = currentAlert.message;
      }
  }
  nickname = nickname || '익명';
  
  const count = currentAlert.amount;
  
  // 표시용 템플릿 처리 (리렌더링 시에도 동일하게 적용)
  const formattedNickname = `<span class="nickname-style">${nickname}</span>`;
  const formattedCount = `<span class="amount-style">${Number(count).toLocaleString()}</span>`;
  let displayTemplate = (currentAlert.template || '{닉네임}님 {금액}원 후원 감사합니다!')
    .replace('{닉네임}', formattedNickname)
    .replace('{금액}', formattedCount)
    .replace('{개수}', formattedCount)
    .replace('{종류}', '후원');

  return (
    <div 
      className={`stage ${isVisible ? 'visible' : 'hidden'}`}
      style={{
        '--nick-scale': styleSettings.nickScale,
        '--amount-scale': styleSettings.amountScale,
        '--line1-size': `${styleSettings.textSize}px`,
        '--line2-size': `${styleSettings.textSize}px`,
        '--comment-size': `${styleSettings.commentSize}px`
      }}
    >
      <div className="wrap">
        <div className="card-img">
          <img 
            src={currentAlert.imageSrc ? (currentAlert.imageSrc.startsWith('http') ? currentAlert.imageSrc : `${SERVER_URL}${currentAlert.imageSrc}`) : "/thumbnail.jpg"} 
            alt="donation media" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div className="row">
          <div className="thumb">
            <div className="anonymous-text">익명</div>
          </div>

          <div 
            className="text-area"
            dangerouslySetInnerHTML={{ __html: displayTemplate }}
          />
        </div>

        <div className="sub">{comment}</div>
      </div>
    </div>
  );
};

export default Overlay;
