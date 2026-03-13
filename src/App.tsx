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
  const [currentUrl, setCurrentUrl] = useState('https://secure-checkout.internal.sys/billing-v4')

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
        stopVoiceHub()
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
            // Prevent double-triggering if modal is already open OR already handled
            if (!handledActionsRef.current.has(data.message)) {
              setShowConfirmation(prev => {
                if (!prev && (data.message.includes('billing') || data.message.includes('CVV'))) {
                  setPendingAction(data.message);
                  return true;
                }
                return prev;
              });
            }
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

      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx

      const source = audioCtx.createMediaStreamSource(stream)
      const analyzer = audioCtx.createAnalyser()
      analyzer.fftSize = 256
      source.connect(analyzer)

      const bufferLength = analyzer.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const updateLevel = () => {
        if (!audioCtxRef.current) return
        analyzer.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / bufferLength
        setVoiceLevel(average)

        // Send audio data to backend (simulated chunks)
        if (wsRef.current?.readyState === WebSocket.OPEN && average > 5) {
          wsRef.current.send(JSON.stringify({
            type: 'AUDIO',
            data: Array.from(dataArray.slice(0, 50)), // Sampled
            timestamp: Date.now()
          }))
        }

        requestAnimationFrame(updateLevel)
      }

      updateLevel()
      addLog('VOICE_HUB', 'Multimodal audio stream initialized.')
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

        // Compress and send frame
        const jpegData = canvasRef.current.toDataURL('image/jpeg', 0.5)
        wsRef.current.send(JSON.stringify({
          type: 'FRAME',
          data: jpegData,
          timestamp: Date.now()
        }))
        // Silent diagnostic point - usually removed after debugging
        console.log('Frame sent to backend')
      }
    } else if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('Cannot capture frame: WebSocket NOT OPEN')
    }
  }

  const handleConfirmAction = () => {
    addLog('USER_AUTH', 'Action manually confirmed by user.')
    if (pendingAction) {
      handledActionsRef.current.add(pendingAction)
    }
    setShowConfirmation(false)
    setPendingAction(null)
    // Send approval back to backend
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
              <div className="size-12 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-3xl font-bold animate-pulse">gpp_maybe</span>
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-white uppercase italic">Authorization Required</h3>
                <p className="text-[10px] text-primary/60 font-mono tracking-widest">ACTION_SENSITIVITY_HIGH</p>
              </div>
            </div>
            <div className="p-4 bg-background-dark/50 rounded-xl border border-primary/10 mb-8">
              <p className="text-sm text-slate-400 font-mono mb-2">PROPOSED_ACTION:</p>
              <p className="text-primary font-bold">{pendingAction || 'Executing critical transaction sequence...'}</p>
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
        {/* Left Column: Live Stream (70%) */}
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
                  style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuB2Z9W9gG18WHMNvUPjLCYZ5jMjAPkBgip2aJx7LP5SZymxmQ1m5F7X1rFHCM0p_jxTHM3qxKlI47uhTZKEcX8lFzAWQ-u1pBC_tiHEEz0EXuv-YHvIuXzqGIu1kic6BavFDCJlRCeMteRPprGd_qU7qEN1Yt3xUzsx81ojQ9hK_-dVU5hWVu-aQBVZ30brtH4RMC3EdwI86KtzNwyE4iJFKJ-3IBW3AW5xNtSJjoMHm_8DXq9cztnlbKeZJCvOmHSNJWGeddVLpuEc")' }}
                  aria-label="Browser Viewport"
                />
              )}
            </div>

            <div className="absolute inset-0 pointer-events-none p-6">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-primary/20 rounded-full flex items-center justify-center">
                <div className={`w-full h-[1px] bg-primary/30 absolute ${isCapturing ? 'animate-pulse' : ''}`}></div>
                <div className={`h-full w-[1px] bg-primary/30 absolute ${isCapturing ? 'animate-pulse' : ''}`}></div>
              </div>

              <div className="absolute top-6 left-6 p-3 bg-background-dark/60 backdrop-blur-md border border-primary/30 rounded-lg shadow-[0_0_15px_rgba(204,255,0,0.15)]">
                <div className="text-[10px] text-primary/60 font-mono mb-1">CURSOR_POS</div>
                <div className="text-sm font-mono text-primary flex gap-4">
                  <span>X: {cursorPos.x.toFixed(2)}</span>
                  <span>Y: {cursorPos.y.toFixed(2)}</span>
                </div>
              </div>
              <div className="absolute top-6 right-6 p-3 bg-background-dark/60 backdrop-blur-md border border-primary/30 rounded-lg text-right shadow-[0_0_15px_rgba(204,255,0,0.15)]">
                <div className="text-[10px] text-primary/60 font-mono mb-1">LATENCY</div>
                <div className="text-sm font-mono text-primary">12ms <span className="text-xs text-primary/40 tracking-tighter">SYMMETRICAL</span></div>
              </div>

              {/* Terminal Window Overlay */}
              <div className="absolute bottom-6 left-6 right-6 h-40 bg-background-dark/80 backdrop-blur-lg border border-primary/20 rounded-xl overflow-hidden pointer-events-auto shadow-2xl">
                <div className="flex items-center justify-between px-4 py-2 border-b border-primary/10 bg-primary/5">
                  <span className="text-[10px] font-bold tracking-[0.2em] text-primary">RED-EYE CORE TERMINAL [v2.0.4]</span>
                  <div className="flex gap-2">
                    <span className={`size-2 rounded-full ${isCapturing ? 'bg-primary animate-pulse' : 'bg-primary/20'}`}></span>
                    <span className="size-2 rounded-full bg-primary/40"></span>
                  </div>
                </div>
                <div className="p-4 font-mono text-[11px] overflow-y-auto h-[calc(100%-34px)] space-y-1 scrollbar-hide">
                  {logs.map((log, i) => (
                    <p key={i} className="text-slate-400">
                      <span className="text-slate-600">[{log.timestamp}]</span> <span className="text-primary/70">{log.type}</span>: {log.message}
                    </p>
                  ))}
                  {isCapturing && (
                    <p className="text-primary animate-pulse italic">
                      [DATA_STREAM] Capture active. Sequential frames synchronized...
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Mission Control (30%) */}
        <div className="w-[30%] bg-surface-dark flex flex-col overflow-y-auto border-l border-border-dark scrollbar-hide">
          <div className="p-8 border-b border-border-dark bg-background-dark/30">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">Neural Voice Hub</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-primary uppercase">Barge-In Ready</span>
                <div className="size-2 rounded-full bg-primary animate-ping"></div>
              </div>
            </div>
            <div className="relative flex items-center justify-center py-10">
              <div className="absolute size-40 border border-primary/5 rounded-full"></div>
              <div className="absolute size-52 border border-primary/5 rounded-full animate-[spin_10s_linear_infinite]"></div>

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
                {voiceLevel > 0 ? 'Mute Interaction' : 'Activate Voice Hub'}
              </button>
            </div>
          </div>

          <div className="p-8 flex-1">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">Verification Progress</h3>
              <span className="text-sm font-bold text-primary">65%</span>
            </div>
            <div className="space-y-4">
              <div className="w-full bg-border-dark h-1.5 rounded-full overflow-hidden mb-8">
                <div className="bg-primary h-full w-[65%] shadow-[0_0_10px_rgba(204,255,0,0.4)]"></div>
              </div>

              <div className="group flex items-start gap-4 p-4 rounded-xl bg-background-dark/50 border border-border-dark hover:border-primary/30 transition-all">
                <div className="mt-0.5 text-primary">
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Environmental Scan</h4>
                  <p className="text-xs text-slate-500 font-mono uppercase tracking-tighter">Secure Link: [LIVE]</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-background-dark/50 border border-border-dark">
                <div className="mt-0.5 text-primary">
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Neural Data Mapping</h4>
                  <p className="text-xs text-slate-500">Coordinate Grid: [NORMALIZED]</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20 ring-1 ring-primary/10">
                <div className="mt-0.5 text-primary">
                  <span className={`material-symbols-outlined text-lg ${isCapturing ? 'animate-spin' : ''}`}>progress_activity</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-primary">Agent Vision Loop</h4>
                  <p className="text-xs text-primary/70">{isCapturing ? 'Streaming Frame Buffer...' : 'Vision Interface Offline'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 bg-background-dark/50 border-t border-border-dark">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Manual Override</h4>
                <p className="text-[9px] text-primary/40 font-mono">ENCRYPTED_SIGNAL_IDLE</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isOverrideActive}
                  onChange={(e) => setIsOverrideActive(e.target.checked)}
                />
                <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:start-[3px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:bg-primary shadow-inner"></div>
              </label>
            </div>

            <div className="flex justify-center">
              <button
                onClick={isCapturing ? stopVisionLoop : startVisionLoop}
                className="relative group focus:outline-none"
              >
                <div className={`absolute -inset-2 rounded-full blur transition duration-500 opacity-20 ${isCapturing ? 'bg-red-500 opacity-40' : 'bg-primary group-hover:opacity-60'}`}></div>
                <div className={`relative size-20 rounded-full flex items-center justify-center text-background-dark shadow-2xl transform active:scale-95 transition-all duration-300 ${isCapturing ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:scale-105'}`}>
                  <span className="material-symbols-outlined text-4xl font-bold">
                    {isCapturing ? 'stop' : 'camera_indoor'}
                  </span>
                </div>
              </button>
            </div>
            <p className="text-center mt-6 text-[10px] text-primary/40 font-mono tracking-[0.2em] uppercase">
              {isCapturing ? 'DISCONNECT_EYE' : 'INITIALIZE_EYE'}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
