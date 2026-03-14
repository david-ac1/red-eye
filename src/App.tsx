import { useState, useRef, useEffect, useCallback } from 'react'

interface LogEntry {
  timestamp: string;
  type: string;
  message: string;
}

function App() {
  const [isOverrideActive, setIsOverrideActive] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([
    { timestamp: '14:20:01', type: 'DOM_ANALYSIS_COMPLETE', message: 'Found 12 interactive elements.' },
    { timestamp: '14:20:02', type: 'TASK_IDENTIFIED', message: 'Customer billing information required.' }
  ])
  const [cursorPos] = useState({ x: 450.21, y: 120.48 })
  const [voiceLevel, setVoiceLevel] = useState(0)
  const [currentUrl, setCurrentUrl] = useState('https://social.navigator.internal/feed/verify')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const captureInterval = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const handledActionsRef = useRef<Set<string>>(new Set())

  const addLog = useCallback((type: string, message: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false })
    setLogs(prev => [...prev.slice(-10), { timestamp: time, type, message }])
  }, [])

  const playAudioChunk = (base64Data: string) => {
    try {
      if (!audioCtxRef.current) return;

      const binaryString = window.atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcmData = new Int16Array(bytes.buffer);
      const audioBuffer = audioCtxRef.current.createBuffer(1, pcmData.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768.0;
      }

      const source = audioCtxRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtxRef.current.destination);
      source.start();
    } catch (e) {
      console.error('Audio playback failed', e);
    }
  }

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: number;

    const connect = () => {
      ws = new WebSocket('ws://127.0.0.1:3001')
      wsRef.current = ws

      ws.onopen = () => {
        addLog('CORE_v2.0', 'Connection established with backend.')
      }

      ws.onclose = () => {
        addLog('CORE_v2.0', 'Connection lost. Attempting reconnect...')
        reconnectTimeout = window.setTimeout(connect, 3000)
      }

      ws.onerror = (err) => {
        addLog('ERROR', `WebSocket connection failed: ${err.type}`)
        console.error('WS Error:', err)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'ACTION') {
            addLog('AGENT_ACTION', data.message)
            if (!handledActionsRef.current.has(data.message)) {
              setPendingAction(data.message);
              setShowConfirmation(true);
            }
          } else if (data.type === 'LOG') {
            addLog('SENTINEL_LOG', data.message);
          } else if (data.type === 'AUDIO_OUT') {
            playAudioChunk(data.data);
          } else if (data.type === 'URL_UPDATE') {
            setCurrentUrl(data.url);
          }
        } catch (e) {
          console.error('Failed to parse WS message', e)
        }
      }
    }

    connect()
    return () => {
      ws?.close()
      clearTimeout(reconnectTimeout)
    }
  }, [addLog])

  const startVisionLoop = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1 },
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsCapturing(true)
        addLog('VISION_LOOP', 'Visual stream acquired at 1 FPS.')

        captureInterval.current = window.setInterval(() => {
          captureFrame()
        }, 1000)
      }
    } catch (err) {
      addLog('ERROR', 'Failed to acquire screen stream.')
      console.error(err)
    }
  }

  const stopVisionLoop = () => {
    if (captureInterval.current) {
      clearInterval(captureInterval.current)
      captureInterval.current = null
    }
    const stream = videoRef.current?.srcObject as MediaStream
    stream?.getTracks().forEach(track => track.stop())
    setIsCapturing(false)
    addLog('VISION_LOOP', 'Visual stream terminated.')
  }

  const startVoiceHub = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream

      const audioCtx = new AudioContext({ sampleRate: 24000 })
      audioCtxRef.current = audioCtx

      const source = audioCtx.createMediaStreamSource(stream)
      const processor = audioCtx.createScriptProcessor(4096, 1, 1)
      const analyzer = audioCtx.createAnalyser()

      source.connect(analyzer)
      source.connect(processor)
      processor.connect(audioCtx.destination)

      const bufferLength = analyzer.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF
        }

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)))
          wsRef.current.send(JSON.stringify({
            type: 'AUDIO',
            data: base64Audio,
            timestamp: Date.now()
          }))
        }

        // Update visualization level
        analyzer.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / bufferLength
        setVoiceLevel(average)
      }

      addLog('VOICE_HUB', 'Multimodal audio stream initialized at 24kHz.')
    } catch (err) {
      addLog('ERROR', 'Microphone access denied.')
      console.error(err)
    }
  }

  const stopVoiceHub = () => {
    audioStreamRef.current?.getTracks().forEach(track => track.stop())
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    audioStreamRef.current = null
    setVoiceLevel(0)
    addLog('VOICE_HUB', 'Audio stream terminated.')
  }

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      const context = canvasRef.current.getContext('2d')
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth
        canvasRef.current.height = videoRef.current.videoHeight
        context.drawImage(videoRef.current, 0, 0)

        const jpegData = canvasRef.current.toDataURL('image/jpeg', 0.5)
        wsRef.current.send(JSON.stringify({
          type: 'FRAME',
          data: jpegData,
          timestamp: Date.now()
        }))
        console.log('Frame sent to backend')
      }
    }
  }

  const handleConfirmAction = () => {
    addLog('USER_AUTH', 'Action manually confirmed by user.')
    if (pendingAction) {
      handledActionsRef.current.add(pendingAction)
    }
    setShowConfirmation(false)
    setPendingAction(null)
    wsRef.current?.send(JSON.stringify({ type: 'CONFIRMATION', status: 'APPROVED' }))
  }

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display selection:bg-primary selection:text-background-dark overflow-hidden h-screen relative">
      <video ref={videoRef} autoPlay className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background-dark/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-md p-8 border border-primary/40 bg-surface-dark rounded-2xl shadow-[0_0_50px_rgba(204,255,0,0.15)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="size-12 bg-red-500/20 rounded-lg flex items-center justify-center text-red-500">
                <span className="material-symbols-outlined text-3xl font-bold animate-pulse">lock_person</span>
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-white uppercase italic">Authenticity Warning</h3>
                <p className="text-[10px] text-red-500/60 font-mono tracking-widest">SYNTHETIC_MEDIA_DETECTED</p>
              </div>
            </div>
            <div className="p-4 bg-background-dark/50 rounded-xl border border-red-500/10 mb-8">
              <p className="text-sm text-slate-400 font-mono mb-2">THREAT_IDENTIFIED:</p>
              <p className="text-red-500 font-bold">{pendingAction || 'Analyzing generative artifacts...'}</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  if (pendingAction) handledActionsRef.current.add(pendingAction);
                  setShowConfirmation(false);
                  setPendingAction(null);
                }}
                className="flex-1 px-6 py-3 rounded-xl border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 transition-all uppercase tracking-widest text-xs"
              >
                Decline
              </button>
              <button
                onClick={handleConfirmAction}
                className="flex-1 px-6 py-3 rounded-xl bg-primary text-background-dark font-bold hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(204,255,0,0.3)]"
              >
                Confirm Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <header className="flex items-center justify-between border-b border-border-dark px-6 py-3 bg-surface-dark/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-primary rounded flex items-center justify-center text-background-dark shadow-[0_0_15px_rgba(204,255,0,0.5)]">
              <span className="material-symbols-outlined font-bold">visibility</span>
            </div>
            <h2 className="text-xl font-bold tracking-tighter uppercase italic">Red-Eye <span className="text-primary">AI</span></h2>
          </div>
          <nav className="hidden md:flex items-center gap-6 border-l border-border-dark pl-6">
            <a className="text-primary text-sm font-semibold tracking-wide flex items-center gap-2" href="#">
              <span className={`size-1.5 rounded-full bg-primary ${isCapturing ? 'animate-pulse' : ''}`}></span>
              LIVE NAVIGATOR
            </a>
            <a className="text-slate-400 hover:text-white text-sm font-medium transition-colors" href="#">HISTORY</a>
            <a className="text-slate-400 hover:text-white text-sm font-medium transition-colors" href="#">NEURAL LOGS</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <span className={`size-2 rounded-full ${isCapturing ? 'bg-primary animate-ping' : 'bg-slate-600'}`}></span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
              {isCapturing ? 'System Streaming' : 'System Idle'}
            </span>
          </div>
          <button className="p-2 hover:bg-border-dark rounded-lg transition-colors text-slate-400">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div className="size-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center overflow-hidden">
            <img
              className="w-full h-full object-cover"
              alt="User"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCfHXXB7qXDIjM8jk0XLNngPxgxdo9DRLDJnkPHX9uBQvfY8jTg49WvKi6d7MBMtfNjwd33sqennrVUFIIqiF7hmqWgcWf13oxUjVKx6CD9ltvRgC2fAppqQgnuv_ExZkSmfAxIihF0AYv4NMr0vLZO-apX1ItwnUBgTHeKYSxYFQqOkqgq7LFl33_JUte2wl1I-ycgo24bhdh8ji7g6KqCrSjroROG37zewfhJSp7FSi1lYD9ZMEMPnMc9jIIRMVcRA3h4luWk-jMQ"
            />
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="w-[70%] relative flex flex-col bg-black border-r border-border-dark group">
          <div className="h-8 bg-surface-dark border-b border-border-dark flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <div className="size-2.5 rounded-full bg-red-500/20"></div>
              <div className="size-2.5 rounded-full bg-yellow-500/20"></div>
              <div className="size-2.5 rounded-full bg-green-500/20"></div>
            </div>
            <div className="flex-1 max-w-md mx-auto h-5 bg-background-dark/50 rounded text-[10px] flex items-center px-3 text-slate-500 font-mono overflow-hidden whitespace-nowrap">
              {currentUrl}
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden cyber-grid">
            <div className="absolute inset-0 flex items-center justify-center opacity-40 grayscale contrast-125 overflow-hidden">
              {isCapturing ? (
                <video
                  autoPlay
                  muted
                  playsInline
                  ref={(el) => {
                    if (el && videoRef.current?.srcObject) {
                      el.srcObject = videoRef.current.srcObject;
                    }
                  }}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: 'url("https://social.navigator.internal/api/v1/mock-screen")' }}
                />
              )}
            </div>

            <div className="absolute inset-0 pointer-events-none p-6">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-primary/20 rounded-full flex items-center justify-center">
                <div className={`w-full h-[1px] bg-primary/30 absolute ${isCapturing ? 'animate-pulse' : ''}`}></div>
                <div className={`h-full w-[1px] bg-primary/30 absolute ${isCapturing ? 'animate-pulse' : ''}`}></div>
              </div>

              <div className="absolute bottom-6 left-6 right-6 h-40 bg-background-dark/80 backdrop-blur-lg border border-primary/20 rounded-xl overflow-hidden pointer-events-auto shadow-2xl">
                <div className="flex items-center justify-between px-4 py-2 border-b border-primary/10 bg-primary/5">
                  <span className="text-[10px] font-bold tracking-[0.2em] text-primary">SENTINEL_v2.0 TERMINAL</span>
                </div>
                <div className="p-4 font-mono text-[11px] overflow-y-auto h-[calc(100%-80px)] space-y-1 scrollbar-hide">
                  {logs.map((log, i) => (
                    <p key={i} className={log.message.includes('SENTINEL:') ? 'text-primary' : 'text-slate-400'}>
                      <span className="text-slate-600">[{log.timestamp}]</span> <span className="text-primary/70">{log.type}</span>: {log.message}
                    </p>
                  ))}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-surface-dark/90 border-t border-primary/10 flex gap-3">
                  <span className="text-primary font-bold mt-1.5 animate-pulse">❯</span>
                  <input
                    type="text"
                    placeholder="Ask Sentinel a follow-up question..."
                    className="flex-1 bg-transparent border-none outline-none text-primary font-mono text-[11px] placeholder:text-primary/30"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.currentTarget as HTMLInputElement).value;
                        if (val) {
                          addLog('USER_QUERY', val);
                          wsRef.current?.send(JSON.stringify({ type: 'TEXT', data: val }));
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-[30%] bg-surface-dark flex flex-col overflow-y-auto border-l border-border-dark scrollbar-hide">
          <div className="p-8 border-b border-border-dark bg-background-dark/30">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">Neural Voice Hub</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-primary uppercase">Bidi-Link: ACTIVE</span>
                <div className="size-2 rounded-full bg-primary animate-ping"></div>
              </div>
            </div>
            <div className="relative flex items-center justify-center py-10">
              <div className="flex items-end gap-1.5 h-16 relative z-10">
                {[4, 8, 12, 14, 10, 6, 3, 5, 11, 15, 9, 5].map((h, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full bg-primary transition-all duration-75 ${voiceLevel > 0 ? 'opacity-100 shadow-[0_0_8px_rgba(204,255,0,0.5)]' : 'opacity-20'}`}
                    style={{ height: `${Math.max(10, (h / 15) * voiceLevel)}%` }}
                  ></div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-col items-center">
              <button
                onClick={voiceLevel > 0 ? stopVoiceHub : startVoiceHub}
                className={`px-4 py-2 rounded-lg border text-[10px] font-bold tracking-widest uppercase transition-all ${voiceLevel > 0 ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(204,255,0,0.2)]' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}
              >
                {voiceLevel > 0 ? 'Terminate Hub' : 'Initialize Voice Hub'}
              </button>
            </div>
          </div>

          <div className="p-8 flex-1">
            <h3 className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase mb-6">Integrity Index</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="mt-0.5 text-primary">
                  <span className={`material-symbols-outlined text-lg ${isCapturing ? 'animate-spin' : ''}`}>security</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-primary">Multimodal Sentinel</h4>
                  <p className="text-xs text-primary/70">{isCapturing ? 'Actively auditing vision/audio buffers...' : 'Sentinel Standby'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 bg-background-dark/50 border-t border-border-dark">
            <div className="flex justify-center">
              <button
                onClick={isCapturing ? stopVisionLoop : startVisionLoop}
                className={`relative size-20 rounded-full flex items-center justify-center text-background-dark transition-all duration-300 ${isCapturing ? 'bg-red-500' : 'bg-primary shadow-[0_0_30px_rgba(204,255,0,0.3)]'}`}
              >
                <span className="material-symbols-outlined text-4xl font-bold">
                  {isCapturing ? 'stop' : 'camera_indoor'}
                </span>
              </button>
            </div>
            <p className="text-center mt-6 text-[10px] text-primary/40 font-mono tracking-[0.2em] uppercase">
              {isCapturing ? 'TERMINATE_AUDIT' : 'INITIALIZE_SENTINEL'}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
