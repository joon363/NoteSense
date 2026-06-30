import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  FileText, 
  Layers, 
  Settings, 
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';

const SOCKET_URL = window.location.origin;

function Editor() {
  const [socket, setSocket] = useState(null);
  const [session, setSession] = useState({
    laptopConnected: true,
    phoneConnected: false,
    copiedItem: null
  });
  
  const [editorTitle, setEditorTitle] = useState('RLC 직렬 회로 과도 응답 분석');
  const [editorContent, setEditorContent] = useState(
`# RLC 직렬 회로의 과도 응답 (NoteSense)
본 실험노트에서는 저항(R), 인덕터(L), 커패시터(C)가 직렬로 연결된 RLC 회로의 과도 상태 및 과도 응답 특성을 수학적으로 모델링하고 분석한다.

## 1. 2차 회로 지배 방정식
RLC 직렬 회로에 KVL(Kirchhoff's Voltage Law)을 적용하면 다음과 같은 2차 선형 미분 방정식을 얻을 수 있다.

L * (d²i(t)/dt²) + R * (di(t)/dt) + (1/C) * i(t) = v_s(t)

* 감쇠 계수 (Attenuation Factor, α): α = R / 2L
* 고유 주파수 (Resonant Frequency, ω0): ω0 = 1 / sqrt(LC)

## 2. 응답 특성 분류
감쇠 계수 α와 고유 주파수 ω0의 크기 비교에 따라 감쇠 특성은 세 가지로 분류된다:

1. 과감쇠 (Overdamped, α > ω0): 진동 없이 지수함수 형태로 감쇠
2. 임계감쇠 (Critically Damped, α = ω0): 진동 없이 가장 빠르게 0으로 복귀
3. 미달감쇠 (Underdamped, α < ω0): 감쇠하며 진동 (수렴 전 교류 성분 관측)

[스마트폰 카메라로 판서를 촬영한 뒤, 손가락을 1초간 대어 그래프를 복사하세요. 2초의 대기 시간이 지난 후 노트북 화면의 아무 곳에나 대고 다시 1초간 손가락을 대고 있으면 그래프 이미지가 마우스 드래그가 가능한 스티커 형태로 본문에 삽입됩니다.]
`
  );

  // Floating stickers on the screen
  const [pastedImages, setPastedImages] = useState([]);
  
  // Dragging states
  const [draggedId, setDraggedId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const editorRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    // Force polling transport to avoid WebSockets blocking on self-signed certs
    const newSocket = io(SOCKET_URL, {
      transports: ['polling', 'websocket']
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Laptop connected to Socket server');
      newSocket.emit('register-device', 'laptop');
    });

    newSocket.on('session-status', (status) => {
      setSession(prev => ({
        ...prev,
        laptopConnected: status.laptopConnected,
        phoneConnected: status.phoneConnected
      }));
    });

    newSocket.on('item-copied', (item) => {
      setSession(prev => ({ ...prev, copiedItem: item }));
    });

    // Trigger paste event
    newSocket.on('paste-item-trigger', (pasteData) => {
      console.log('Pasted item event triggered on Editor:', pasteData);
      
      const newSticker = {
        id: Date.now(),
        image: pasteData.image,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        label: pasteData.label || 'RLC 회로도 그래프',
        // Default position next to the right margin of the document
        x: 520 + Math.random() * 80,
        y: 150 + Math.random() * 120
      };

      // Add to floating stickers list
      setPastedImages(prev => [...prev, newSticker]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Keyboard shortcut shortcut fallback (Pressing 'P' key simulates a copy-paste for the video demo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore keypress if focus is inside input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        console.log("Simulating RLC graph paste via 'P' shortcut");
        const mockSticker = {
          id: Date.now(),
          image: '/rlc_graphic.png',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          label: 'RLC 과도 응답 그래프',
          x: 520 + Math.random() * 80,
          y: 200 + Math.random() * 120
        };
        setPastedImages(prev => [...prev, mockSticker]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Draggable handlers
  const handleMouseDown = (e, item) => {
    setDraggedId(item.id);
    setDragOffset({
      x: e.clientX - item.x,
      y: e.clientY - item.y
    });
    e.stopPropagation();
  };

  const handleMouseMove = (e) => {
    if (draggedId === null) return;
    
    setPastedImages(prev => prev.map(item => {
      if (item.id === draggedId) {
        return {
          ...item,
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        };
      }
      return item;
    }));
  };

  const handleMouseUp = () => {
    setDraggedId(null);
  };

  const pairingUrl = `https://${window.location.hostname}:5173/#phone`;

  return (
    <div 
      className="editor-layout"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ minHeight: '100vh', position: 'relative' }}
    >
      {/* 1. Sleek Compact Left Sidebar */}
      <aside className="editor-sidebar-left">
        <div className="brand-section">
          <div className="brand-logo" style={{ background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)' }}>
            <Sparkles size={16} color="#ffffff" />
          </div>
          <span className="brand-name">NoteSense</span>
        </div>

        <ul className="sidebar-menu">
          <a className="menu-item active">
            <FileText size={16} />
            <span>나의 노트</span>
          </a>
          <a className="menu-item">
            <Layers size={16} />
            <span>강의 자료실</span>
          </a>
          <a className="menu-item">
            <Settings size={16} />
            <span>설정</span>
          </a>
        </ul>

        {/* Pairing URL Guide instead of big QR code */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              <LinkIcon size={12} /> 모바일 연결 주소
            </span>
            <div style={{ fontSize: '0.65rem', wordBreak: 'break-all', fontFamily: 'monospace', color: '#0ea5e9', fontWeight: 'bold' }}>
              {pairingUrl}
            </div>
          </div>

          <div className={`status-pill ${session.phoneConnected ? 'connected' : 'disconnected'}`} style={{ border: 'none', background: session.phoneConnected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0,0,0,0.03)' }}>
            <span className="status-indicator"></span>
            <span style={{ fontSize: '0.7rem' }}>AR 연결: {session.phoneConnected ? '연결됨' : '연결 대기'}</span>
          </div>
        </div>
      </aside>

      {/* 2. Middle Editor Area */}
      <main className="editor-center-container">
        {/* Render stickers relative to document wrapper to prevent layout shifting */}
        <div className="editor-document-wrapper" style={{ maxWidth: '780px', width: '100%', margin: '0 auto', position: 'relative' }}>
          <input 
            type="text" 
            className="editor-title-input" 
            value={editorTitle}
            onChange={(e) => setEditorTitle(e.target.value)}
            placeholder="제목 없음"
            style={{ borderBottomColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}
          />
          
          <textarea
            ref={editorRef}
            className="editor-content-area"
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            placeholder="여기에 내용을 입력하세요..."
            style={{ color: 'var(--text-primary)', marginTop: '20px', minHeight: '600px' }}
          />

          {/* Draggable Absolute Floating Stickers */}
          {pastedImages.map((item) => (
            <div 
              key={item.id} 
              className="floating-sticker"
              style={{ 
                left: `${item.x}px`, 
                top: `${item.y}px`
              }}
              onMouseDown={(e) => handleMouseDown(e, item)}
            >
              <div className="sticker-header">
                <span style={{ fontWeight: '600', fontSize: '0.65rem' }}>{item.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{item.timestamp}</span>
                  <button 
                    className="sticker-close-btn"
                    onClick={(e) => {
                      e.stopPropagation(); // Stop drag trigger
                      setPastedImages(prev => prev.filter(p => p.id !== item.id));
                    }}
                    title="삭제"
                  >
                    &times;
                  </button>
                </div>
              </div>
              <img src={item.image} alt={item.label} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default Editor;
