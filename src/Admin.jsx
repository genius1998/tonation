import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Admin.css';

const API_URL = 'http://localhost:3001/api';

const Admin = () => {
  // 데이터 상태
  const [presets, setPresets] = useState([]);

  // TTS 목소리 목록 상태
  const [voiceList, setVoiceList] = useState([]);

  // 테스트 패널 상태
  const [testAmount, setTestAmount] = useState('100');
  const [testNickname, setTestNickname] = useState('익명');
  const [testMessage, setTestMessage] = useState('테스트 메시지입니다');
  const [platform, setPlatform] = useState('SOOP');
  const [donationType, setDonationType] = useState('별풍선');

  // UI 상태
  const [isCopied, setIsCopied] = useState(false);

  // 전역 스타일 설정 상태
  const [globalSettings, setGlobalSettings] = useState({
    nickScale: 1.2,
    amountScale: 1.1,
    textSize: 40,
    commentSize: 40
  });

  useEffect(() => {
    fetchPresets();
    fetchSettings();

    // 목소리 목록 로드
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const koVoices = allVoices.filter(v => (v.lang || '').toLowerCase().includes('ko'));
      setVoiceList(koVoices.length > 0 ? koVoices : allVoices);
    };

    loadVoices();
    // 일부 브라우저는 이벤트가 addEventListener만 먹는 경우도 있어 안전하게 둘 다 처리
    try {
      window.speechSynthesis.onvoiceschanged = loadVoices;
      window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
    } catch {}

    return () => {
      try {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.removeEventListener?.('voiceschanged', loadVoices);
      } catch {}
    };
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await axios.get(`${API_URL}/presets`);

      // ✅ 데이터 마이그레이션 (amount -> min/max, voiceName -> voiceURI 통일)
      const formatted = res.data.map((p) => {
        const minAmount = p.minAmount ?? p.amount ?? 0;
        const maxAmount = p.maxAmount ?? p.amount ?? 99999999;

        // 기존 데이터 대응:
        // - voiceURI가 있으면 그대로
        // - voiceName만 있으면 유지(표시용)하되 Overlay는 voiceURI 우선이라 가능하면 voiceURI로 저장 추천
        const prevTTS = p.ttsConfig || {};
        const ttsConfig = {
          voiceURI: prevTTS.voiceURI || '', // ✅ 앞으로 기본 키는 voiceURI
          voiceName: prevTTS.voiceName || '', // 하위호환/표시용으로 남겨도 됨
          rate: typeof prevTTS.rate === 'number' ? prevTTS.rate : 1.0,
          pitch: typeof prevTTS.pitch === 'number' ? prevTTS.pitch : 1.0,
        };

        return {
          ...p,
          minAmount,
          maxAmount,
          template: p.template || '{닉네임}님 {금액}원 후원 감사합니다!',
          soundType: p.soundType || (p.audio ? 'file' : 'none'),
          duration: typeof p.duration === 'number' ? p.duration : (parseInt(p.duration) || 0),
          ttsConfig,
        };
      });

      setPresets(formatted.sort((a, b) => parseInt(a.minAmount) - parseInt(b.minAmount)));
    } catch (err) {
      console.error('Failed to fetch presets', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/settings`);
      setGlobalSettings(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const saveSettings = async () => {
    try {
      await axios.post(`${API_URL}/settings`, globalSettings);
      alert('스타일 설정이 저장(반영)되었습니다.');
    } catch (e) {
      console.error(e);
      alert('설정 저장 실패');
    }
  };

  const handleSettingChange = (key, val) => {
    setGlobalSettings(prev => ({ ...prev, [key]: parseFloat(val) }));
  };

  // ttsConfig 업데이트 헬퍼
  const updateTTSConfig = (id, key, value) => {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return { ...p, ttsConfig: { ...(p.ttsConfig || {}), [key]: value } };
        }
        return p;
      })
    );
  };

  // --- 프리셋 관리 핸들러 ---
  const handleFileUpload = async (file) => {
    if (!file) return null;
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_URL}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url;
  };

  const addNewPreset = () => {
    const newPreset = {
      id: Date.now(),
      minAmount: 0,
      maxAmount: 100,
      image: '',
      audio: '',
      soundType: 'none',
      duration: 0,
      template: '{닉네임}님 {종류} {개수}개 감사합니다!',
      // ✅ voiceURI 중심
      ttsConfig: { voiceURI: '', voiceName: '', rate: 1.0, pitch: 1.0 },
      isNew: true,
    };
    setPresets((prev) => [newPreset, ...prev]);
  };

  const updatePreset = (id, field, value) => {
    setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const saveAllPresets = async () => {
    try {
      // ✅ 저장 전 숫자 정규화(특히 duration)
      const normalized = presets.map((p) => ({
        ...p,
        minAmount: parseInt(p.minAmount) || 0,
        maxAmount: parseInt(p.maxAmount) || 0,
        duration: parseInt(p.duration) || 0,
        ttsConfig: {
          voiceURI: p.ttsConfig?.voiceURI || '',
          voiceName: p.ttsConfig?.voiceName || '',
          rate: typeof p.ttsConfig?.rate === 'number' ? p.ttsConfig.rate : parseFloat(p.ttsConfig?.rate) || 1.0,
          pitch: typeof p.ttsConfig?.pitch === 'number' ? p.ttsConfig.pitch : parseFloat(p.ttsConfig?.pitch) || 1.0,
        },
      }));

      await axios.post(`${API_URL}/presets`, normalized);
      alert('설정이 저장되었습니다.');
      setPresets(normalized);
    } catch (e) {
      console.error(e);
      alert('저장 실패');
    }
  };

  const deletePreset = async (id) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    await axios.post(`${API_URL}/presets`, updated);
  };

  // --- 파일 선택 핸들러 (개별 프리셋용) ---
  const handlePresetFileChange = async (id, type, file) => {
    const url = await handleFileUpload(file);
    if (url) {
      updatePreset(id, type, url);
    }
  };

  // --- 테스트 트리거 ---
  const triggerTest = async () => {
    console.log("테스트 트리거 실행")
    const amountNum = parseInt(testAmount) || 0;
    console.log("testAmount:",testAmount)
    console.log("amountNum:",amountNum)

    // 내림차순 정렬 (minAmount 큰 게 우선 매칭)
    const sortedPresets = [...presets].sort(
      (a, b) => parseInt(b.minAmount) - parseInt(a.minAmount)
    );

    let matched = sortedPresets.find((p) => {
      const min = parseInt(p.minAmount) || 0;
      const max = parseInt(p.maxAmount) || 0;
      return amountNum >= min && amountNum <= max;
    });
    // 매칭 없으면 기본 프리셋
    if (!matched) {
      matched = {
        image: '',
        audio: '',
        soundType: 'tts',
        template: '{닉네임}님 {금액}원 후원 감사합니다!',
        // ✅ voiceURI 통일
        ttsConfig: { voiceURI: '', voiceName: '', rate: 1.0, pitch: 1.0 },
        duration: 5,
      };
    }
    console.log("matched:", matched)
    console.log("matched.template:", matched.template)

    try {
      await axios.post(`${API_URL}/trigger`, {
        amount: amountNum,
        nickname: testNickname,
        comment: testMessage, 
        preset: matched,
        template: matched.template,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const stopAlert = async () => {
    try {
      await axios.post(`${API_URL}/stop`);
    } catch (e) {
      console.error(e);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText('http://localhost:5173/overlay');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="admin-wrapper">
      {/* 상단 테스트 패널 */}
      <div className="test-panel-container">
        <div className="url-section">
          <span className="label">URL</span>
          <div className="url-controls">
            <button className={`url-copy-btn ${isCopied ? 'copied' : ''}`} onClick={copyUrl}>
              {isCopied ? '✅ 복사 완료!' : '🔒 클릭하여 URL 복사'}
            </button>
            <button className="icon-btn" title="새로고침">🔄</button>
            <button className="icon-btn danger" title="초기화">↩️</button>
          </div>
        </div>

        <div className="test-inputs">
          <span className="label">테스트</span>
          <div className="input-group">
            <input
              type="number"
              value={testAmount}
              onChange={(e) => setTestAmount(e.target.value)}
              placeholder="금액"
              className="amount-input"
            />
            <input
              type="text"
              value={testNickname}
              onChange={(e) => setTestNickname(e.target.value)}
              placeholder="닉네임"
              className="nickname-input"
              style={{ width: '80px', marginRight: '5px' }}
            />
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="후원 메시지(코멘트)"
              className="msg-input"
            />
          </div>
          <div className="select-group">
            <button className="test-btn" onClick={triggerTest}>▶ 테스트</button>
            <button className="stop-btn" style={{backgroundColor: 'red', color: 'white', marginLeft: '10px'}} onClick={stopAlert}>■ 중단</button>
          </div>
        </div>
      </div>

      {/* 하단 설정 영역 버튼들 */}
      <div className="global-actions">
        <button className="save-btn" onClick={saveAllPresets}>💾 프리셋 저장</button>
        <button className="reset-btn" onClick={fetchPresets}>🗑 프리셋 초기화</button>
        <button className="add-btn" onClick={addNewPreset}>+ 새 프리셋 추가</button>
      </div>

      {/* 스타일 설정 패널 */}
      <div style={{ 
        background: 'white', 
        padding: '15px', 
        margin: '20px auto', 
        maxWidth: '800px', 
        borderRadius: '8px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>🎨 스타일 설정 (실시간 반영)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              닉네임 애니메이션 크기 ({globalSettings.nickScale}배)
            </label>
            <input 
              type="range" min="1.0" max="2.0" step="0.01" 
              value={globalSettings.nickScale}
              onChange={(e) => handleSettingChange('nickScale', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              금액 애니메이션 크기 ({globalSettings.amountScale}배)
            </label>
            <input 
              type="range" min="1.0" max="2.0" step="0.01" 
              value={globalSettings.amountScale}
              onChange={(e) => handleSettingChange('amountScale', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              후원 텍스트 크기 ({globalSettings.textSize}px)
            </label>
            <input 
              type="range" min="20" max="100" step="1" 
              value={globalSettings.textSize}
              onChange={(e) => handleSettingChange('textSize', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              코멘트 텍스트 크기 ({globalSettings.commentSize}px)
            </label>
            <input 
              type="range" min="20" max="100" step="1" 
              value={globalSettings.commentSize}
              onChange={(e) => handleSettingChange('commentSize', e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div style={{ marginTop: '15px', textAlign: 'right' }}>
           <button onClick={saveSettings} style={{
             padding: '8px 20px',
             background: '#673ab7',
             color: 'white',
             border: 'none',
             borderRadius: '4px',
             cursor: 'pointer',
             fontWeight: 'bold'
           }}>스타일 적용 및 저장</button>
        </div>
      </div>

      {/* 프리셋 리스트 */}
      <div className="presets-container">
        {presets.map((preset) => (
          <div key={preset.id} className="preset-card">
            {/* 헤더 */}
            <div className="card-header">
              <div className="range-inputs">
                <span className="icon">☰</span>
                <span>후원 개수</span>
                <input
                  type="number"
                  value={preset.minAmount}
                  onChange={(e) => updatePreset(preset.id, 'minAmount', parseInt(e.target.value) || 0)}
                />
                <span>~</span>
                <input
                  type="number"
                  value={preset.maxAmount}
                  onChange={(e) => updatePreset(preset.id, 'maxAmount', parseInt(e.target.value) || 0)}
                />
                <span>개</span>

                <span style={{ marginLeft: '15px', color: '#888' }}>|</span>

                <span style={{ marginLeft: '10px' }}>시간</span>
                <input
                  type="number"
                  style={{ width: '60px' }}
                  value={preset.duration || 0}
                  onChange={(e) => updatePreset(preset.id, 'duration', parseInt(e.target.value) || 0)}
                  placeholder="자동"
                />
                <span>초</span>
              </div>
              <div className="card-actions">
                <button className="fold-btn">^</button>
                <button className="delete-btn" onClick={() => deletePreset(preset.id)}>-</button>
              </div>
            </div>

            {/* 바디 */}
            <div className="card-body">
              {/* 이미지 */}
              <div className="section image-section">
                <span className="label">후원 이미지</span>
                <div className="image-preview-area">
                  {preset.image ? (
                    <img src={preset.image} alt="preview" />
                  ) : (
                    <div className="placeholder">이미지 없음</div>
                  )}
                </div>
                <div className="file-controls">
                  <label className="file-btn">
                    파일 선택
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(e) => handlePresetFileChange(preset.id, 'image', e.target.files?.[0])}
                    />
                  </label>
                  <button className="link-btn">외부 링크</button>
                </div>
              </div>

              {/* 텍스트 */}
              <div className="section text-section">
                <span className="label">후원 텍스트</span>
                <input
                  type="text"
                  className="template-input"
                  value={preset.template || ''}
                  onChange={(e) => updatePreset(preset.id, 'template', e.target.value)}
                />
                <button className="default-text-btn">기본 텍스트</button>
              </div>

              {/* 오디오 */}
              <div className="section audio-section">
                <span className="label">알림음</span>
                <div className="audio-content">
                  <div className="audio-options">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name={`sound-type-${preset.id}`}
                        checked={preset.soundType === 'none'}
                        onChange={() => updatePreset(preset.id, 'soundType', 'none')}
                      /> 사용 안함
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name={`sound-type-${preset.id}`}
                        checked={preset.soundType === 'file'}
                        onChange={() => updatePreset(preset.id, 'soundType', 'file')}
                      /> 알림음
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name={`sound-type-${preset.id}`}
                        checked={preset.soundType === 'tts'}
                        onChange={() => updatePreset(preset.id, 'soundType', 'tts')}
                      /> 텍스트 음성
                    </label>

                    <label className="checkbox-label">
                      <input type="checkbox" defaultChecked /> 메시지(채팅) 음성 사용
                    </label>
                  </div>

                  {/* 파일 재생 패널 */}
                  {preset.soundType === 'file' && (
                    <div className="audio-player-panel">
                      <div className="player-box" onClick={() => {
                        if (preset.audio) new Audio(preset.audio).play();
                      }}>
                        <div className="play-icon">▶</div>
                        <span className="filename">
                          {preset.audio ? preset.audio.split('/').pop() : '파일 없음'}
                        </span>
                      </div>

                      <div className="audio-btns">
                        <label className="file-btn blue">
                          파일 선택
                          <input
                            type="file"
                            hidden
                            accept="audio/*"
                            onChange={(e) => handlePresetFileChange(preset.id, 'audio', e.target.files?.[0])}
                          />
                        </label>
                        <button className="link-btn">외부 링크</button>
                        <button className="danger-btn" onClick={() => {
                          updatePreset(preset.id, 'audio', '');
                          updatePreset(preset.id, 'soundType', 'none');
                        }}>사용 안함</button>
                      </div>
                    </div>
                  )}

                  {/* TTS 설정 패널 */}
                  {(preset.soundType === 'tts' || preset.soundType === 'file') && (
                    <div className="tts-config-panel">
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px', fontWeight: 'bold' }}>
                        {preset.soundType === 'file' ? '※ 메시지 읽기 음성 설정' : '※ 음성 설정'}
                      </div>

                      <div className="config-row">
                        <label>목소리:</label>
                        <select
                          // ✅ voiceURI로 통일
                          value={preset.ttsConfig?.voiceURI || ''}
                          onChange={(e) => updateTTSConfig(preset.id, 'voiceURI', e.target.value)}
                        >
                          <option value="">기본 (자동 선택)</option>
                          {voiceList.map(v => (
                            <option key={v.voiceURI} value={v.voiceURI}>
                              {v.name} ({v.lang})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="config-row">
                        <label>속도 ({preset.ttsConfig?.rate ?? 1.0}):</label>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={preset.ttsConfig?.rate ?? 1.0}
                          onChange={(e) => updateTTSConfig(preset.id, 'rate', parseFloat(e.target.value))}
                        />
                      </div>

                      <div className="config-row">
                        <label>톤 ({preset.ttsConfig?.pitch ?? 1.0}):</label>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={preset.ttsConfig?.pitch ?? 1.0}
                          onChange={(e) => updateTTSConfig(preset.id, 'pitch', parseFloat(e.target.value))}
                        />
                      </div>

                      <button className="preview-tts-btn" onClick={() => {
                        const text = (preset.template || '').replace(/{.*?}/g, '천 원');
                        const u = new SpeechSynthesisUtterance(text);
                        u.lang = 'ko-KR';
                        u.rate = preset.ttsConfig?.rate ?? 1.0;
                        u.pitch = preset.ttsConfig?.pitch ?? 1.0;

                        // ✅ voiceURI로 찾기
                        if (preset.ttsConfig?.voiceURI) {
                          const found = voiceList.find(v => v.voiceURI === preset.ttsConfig.voiceURI);
                          if (found) u.voice = found;
                        }

                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(u);
                      }}>
                        🔊 미리 듣기
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Admin;
