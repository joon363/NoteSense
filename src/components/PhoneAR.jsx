import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Sparkles, 
  RotateCcw, 
  Check, 
  Wifi, 
  WifiOff, 
  Hand,
  Maximize2,
  Minimize2
} from 'lucide-react';

const SOCKET_URL = window.location.origin;

function PhoneAR() {
  const [status, setStatus] = useState({
    socketConnected: false,
    handDetected: false,
    copied: false
  });

  // State machine values: 'idle' (wait for copy), 'cooldown' (sleep 2s), 'ready_to_paste' (wait for paste), 'lock_after_paste' (lock 5s)
  const flowStateRef = useRef('idle'); 
  const [flowState, setFlowStateState] = useState('idle');

  // Modern high-tech clean HUD messages (No Korean text or robotic countdown instructions)
  const [promptMessage, setPromptMessage] = useState('NoteSense | Standby');
  const [copyProgress, setCopyProgress] = useState(0); 
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Refs for tracking positions and time in animation frame loop
  const hoverStartTimeRef = useRef(null);
  const isCopiedRef = useRef(false);
  const fingerPosRef = useRef({ x: 0, y: 0 });
  const prevFingerPosRef = useRef({ x: 0, y: 0 });
  const lastStreamTimeRef = useRef(0);

  // Refs to fix React stale closures inside MediaPipe frame loop
  const socketRef = useRef(null);
  const handDetectedRef = useRef(false);

  const updateFlowState = (newState) => {
    flowStateRef.current = newState;
    setFlowStateState(newState);
    setStatus(prev => ({ ...prev, copied: newState === 'ready_to_paste' || newState === 'cooldown' }));

    // Set high-tech watermark status text based on state
    if (newState === 'idle') {
      setPromptMessage('NoteSense | Standby');
    } else if (newState === 'cooldown') {
      setPromptMessage('NoteSense | Buffered');
    } else if (newState === 'ready_to_paste') {
      setPromptMessage('NoteSense | Ready to Sync');
    } else if (newState === 'lock_after_paste') {
      setPromptMessage('NoteSense | Sync Complete');
    }
  };

  useEffect(() => {
    // 1. Initialize Socket.io Connection with polling fallback for cert issues
    const newSocket = io(SOCKET_URL, {
      transports: ['polling', 'websocket']
    });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Phone AR connected to Socket server');
      setStatus(prev => ({ ...prev, socketConnected: true }));
      newSocket.emit('register-device', 'phone');
    });

    newSocket.on('disconnect', () => {
      setStatus(prev => ({ ...prev, socketConnected: false }));
    });

    // 2. Setup camera constraints for landscape
    let streamInstance = null;
    let isLoopRunning = true;

    const setupCamera = async () => {
      try {
        const constraints = {
          video: {
            facingMode: 'environment', // Rear camera
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        };
        
        console.log("Requesting landscape camera feed...");
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamInstance = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Initialize MediaPipe Hands
        initializeMediaPipe();

      } catch (err) {
        console.error('Camera access error:', err);
        setPromptMessage(`HUD Status: CAMERA_ACQUIRE_FAILED`);
      }
    };

    const initializeMediaPipe = () => {
      if (!window.Hands) {
        console.warn('MediaPipe Hands script not ready, retrying in 500ms...');
        setTimeout(initializeMediaPipe, 500);
        return;
      }

      console.log("Initializing MediaPipe Hands...");
      const hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5
      });

      hands.onResults(onHandResults);

      // Prediction Frame Loop
      const runPredictionLoop = async () => {
        if (!isLoopRunning) return;
        
        if (videoRef.current && videoRef.current.readyState >= 2 && !videoRef.current.paused) {
          try {
            await hands.send({ image: videoRef.current });
          } catch (e) {
            console.error("Frame prediction error:", e);
          }
        }
        
        requestAnimationFrame(runPredictionLoop);
      };

      runPredictionLoop();
    };

    setupCamera();

    // Fullscreen change listener to sync button label
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      console.log("Cleaning up PhoneAR component...");
      isLoopRunning = false;
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (socketRef.current) socketRef.current.disconnect();
      if (streamInstance) {
        streamInstance.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, []);

  // Hand tracking and drawing main loop
  const onHandResults = (results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Scale canvas to video frame dimensions
    if (canvas.width !== results.image.width || canvas.height !== results.image.height) {
      canvas.width = results.image.width;
      canvas.height = results.image.height;
    }

    // 1. Draw camera feed frame
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    const now = Date.now();
    
    // 2. Stream low-res preview frame to laptop every 150ms
    if (now - lastStreamTimeRef.current > 150) {
      const activeSocket = socketRef.current;
      if (activeSocket && activeSocket.connected) {
        const streamData = canvas.toDataURL('image/jpeg', 0.35);
        activeSocket.emit('camera-stream', streamData);
      }
      lastStreamTimeRef.current = now;
    }

    // 3. Process Hand Tracker
    let isHandPresent = false;
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      isHandPresent = true;
      const landmarks = results.multiHandLandmarks[0];
      
      // INDEX_FINGER_TIP
      const indexTip = landmarks[8];
      const fingerX = indexTip.x * canvas.width;
      const fingerY = indexTip.y * canvas.height;
      fingerPosRef.current = { x: fingerX, y: fingerY };

      // Draw glowing dot on finger tip (Purple if copied, blue if copy-ready)
      ctx.beginPath();
      ctx.arc(fingerX, fingerY, 8, 0, 2 * Math.PI);
      ctx.fillStyle = isCopiedRef.current ? 'rgba(139, 92, 246, 0.9)' : 'rgba(14, 165, 233, 0.9)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Check finger velocity to evaluate if holding still
      const dx = fingerX - prevFingerPosRef.current.x;
      const dy = fingerY - prevFingerPosRef.current.y;
      const velocity = Math.sqrt(dx * dx + dy * dy);
      prevFingerPosRef.current = { x: fingerX, y: fingerY };

      // State machine logic
      const currentState = flowStateRef.current;

      if (currentState === 'idle') {
        // COPY GESTURE: Hold finger still anywhere on screen for 1 second
        if (velocity < 8) {
          if (!hoverStartTimeRef.current) {
            hoverStartTimeRef.current = Date.now();
          }

          const elapsed = Date.now() - hoverStartTimeRef.current;
          const percent = Math.min((elapsed / 1000) * 100, 100);
          setCopyProgress(percent);

          // Render cyan progress circle around finger
          ctx.beginPath();
          ctx.arc(fingerX, fingerY, 18, -Math.PI / 2, (-Math.PI / 2) + (2 * Math.PI * (percent / 100)));
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#0ea5e9';
          ctx.stroke();

          if (percent >= 100) {
            autoCopyAction();
          }
        } else {
          hoverStartTimeRef.current = Date.now();
          setCopyProgress(0);
        }
      } 
      else if (currentState === 'ready_to_paste') {
        // PASTE GESTURE: Hold finger still anywhere on screen (laptop view) for 1 second
        if (velocity < 8) {
          if (!hoverStartTimeRef.current) {
            hoverStartTimeRef.current = Date.now();
          }

          const elapsed = Date.now() - hoverStartTimeRef.current;
          const percent = Math.min((elapsed / 1000) * 100, 100);
          setCopyProgress(percent);

          // Render violet progress circle around finger
          ctx.beginPath();
          ctx.arc(fingerX, fingerY, 18, -Math.PI / 2, (-Math.PI / 2) + (2 * Math.PI * (percent / 100)));
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#8b5cf6';
          ctx.stroke();

          if (percent >= 100) {
            triggerPaste();
          }
        } else {
          hoverStartTimeRef.current = Date.now();
          setCopyProgress(0);
        }
      }
      else if (currentState === 'cooldown' || currentState === 'lock_after_paste') {
        // Triggers disabled during transition states
        hoverStartTimeRef.current = null;
        setCopyProgress(0);
      }
    }

    // Sync hand detection status safely via ref to prevent stale closures
    if (handDetectedRef.current !== isHandPresent) {
      handDetectedRef.current = isHandPresent;
      setStatus(prev => ({ ...prev, handDetected: isHandPresent }));
    }

    // 4. Draw floating graph thumbnail attached to finger tip
    if (isCopiedRef.current && isHandPresent) {
      const fx = fingerPosRef.current.x;
      const fy = fingerPosRef.current.y;
      
      const thumbW = 90;
      const thumbH = 60;
      const tx = fx - thumbW / 2;
      const ty = fy - thumbH - 12;

      ctx.save();
      ctx.shadowColor = 'rgba(139, 92, 246, 0.4)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'var(--accent-purple)';
      ctx.lineWidth = 2;
      ctx.strokeRect(tx, ty, thumbW, thumbH);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tx, ty, thumbW, thumbH);

      const img = new Image();
      img.src = '/rlc_graphic.png';
      ctx.drawImage(img, tx + 1, ty + 1, thumbW - 2, thumbH - 2);
      ctx.restore();
    }
  };

  const autoCopyAction = () => {
    const activeSocket = socketRef.current;
    if (activeSocket && activeSocket.connected) {
      activeSocket.emit('copy-item', {
        image: '/rlc_graphic.png',
        label: 'RLC 회로 응답 그래프'
      });
    }
    
    isCopiedRef.current = true;
    updateFlowState('cooldown');
    setCopyProgress(0);
    hoverStartTimeRef.current = null;

    // Sleep for 2 seconds silently (no counter words)
    setTimeout(() => {
      updateFlowState('ready_to_paste');
    }, 2000);
  };

  const triggerPaste = () => {
    const activeSocket = socketRef.current;
    if (activeSocket && activeSocket.connected) {
      activeSocket.emit('paste-item', {
        image: '/rlc_graphic.png',
        label: 'RLC 과도 상태 그래프'
      });
      activeSocket.emit('clear-copied');
    }

    isCopiedRef.current = false;
    updateFlowState('lock_after_paste');
    setCopyProgress(0);
    hoverStartTimeRef.current = null;

    // Lock for 5 seconds (invisible lock delay after paste) before reverting to standby
    setTimeout(() => {
      updateFlowState('idle');
    }, 5000);
  };

  const resetAll = () => {
    isCopiedRef.current = false;
    hoverStartTimeRef.current = null;
    setCopyProgress(0);
    updateFlowState('idle');
    const activeSocket = socketRef.current;
    if (activeSocket && activeSocket.connected) {
      activeSocket.emit('clear-copied');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((err) => console.error("Error entering fullscreen:", err));
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="phone-ar-container" style={{ width: '100vw', height: '100vh' }}>
      <video 
        ref={videoRef} 
        style={{ display: 'none' }} 
        width="640" 
        height="480" 
        playsInline 
        muted 
        autoPlay
      />

      <canvas 
        ref={canvasRef} 
        className="ar-camera-feed"
      />

      {/* Ultra-minimalist HUD Overlay for landscape screens */}
      <div className="ar-hud" style={{ padding: '12px 16px' }}>
        <header className="ar-header">
          <div className="ar-glass-mode-indicator" style={{ padding: '4px 12px', fontSize: '0.65rem', background: 'rgba(0,0,0,0.5)' }}>
            <span className="glass-pulse-dot" style={{ width: '6px', height: '6px' }}></span>
            <span>NoteSense Glass</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto', alignItems: 'center' }}>
            {/* Full Screen Button for Chrome */}
            <button 
              onClick={toggleFullscreen}
              className="ar-glass-mode-indicator"
              style={{ 
                padding: '4px 12px', 
                fontSize: '0.65rem', 
                background: 'rgba(255,255,255,0.15)', 
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {isFullscreen ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
              <span>{isFullscreen ? '전체화면 해제' : '전체화면 켜기'}</span>
            </button>

            {status.socketConnected ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '2px 8px', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 'bold' }}>
                <Wifi size={10} /> Live
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '2px 8px', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 'bold' }}>
                <WifiOff size={10} /> Off
              </span>
            )}

            {status.handDetected && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(14, 165, 233, 0.2)', color: '#0ea5e9', padding: '2px 8px', borderRadius: '10px', fontSize: '0.6rem', fontWeight: 'bold' }}>
                <Hand size={10} /> Tracking
              </span>
            )}
          </div>
        </header>

        {/* Dynamic Contextual Action Trigger */}
        <div className="ar-interaction-overlay">
          {(flowState === 'ready_to_paste') && (
            <button 
              className="copy-popup-btn" 
              onClick={triggerPaste}
              style={{
                background: 'linear-gradient(135deg, var(--accent-purple), #8b5cf6)',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                boxShadow: 'var(--glow-purple), 0 4px 12px rgba(139,92,246,0.3)',
                pointerEvents: 'auto'
              }}
            >
              <Check size={12} />
              <span>노트북 화면에 바로 붙여넣기</span>
            </button>
          )}
        </div>

        {/* Ultra-minimalist HUD panel */}
        <section 
          className="ar-dashboard"
          style={{ 
            background: 'rgba(0, 0, 0, 0.55)', 
            padding: '8px 16px', 
            borderRadius: '12px', 
            maxWidth: '300px', 
            gap: '6px',
            alignSelf: 'center'
          }}
        >
          <div 
            className="ar-prompt" 
            style={{ 
              fontSize: '0.75rem', 
              padding: '2px 6px',
              borderLeftWidth: '3px',
              background: 'transparent',
              textAlign: 'center',
              fontWeight: '700',
              fontFamily: 'monospace',
              color: '#ffffff',
              borderLeftColor: flowState === 'ready_to_paste' ? '#8b5cf6' : flowState === 'cooldown' ? '#f59e0b' : flowState === 'lock_after_paste' ? '#10b981' : '#0ea5e9'
            }}
          >
            {promptMessage}
          </div>

          {(flowState !== 'idle' && flowState !== 'lock_after_paste') && (
            <button 
              onClick={resetAll}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
                padding: '3px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.6rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                pointerEvents: 'auto'
              }}
            >
              <RotateCcw size={10} />
              <span>동작 초기화</span>
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

export default PhoneAR;
