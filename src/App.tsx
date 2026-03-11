import { useState } from 'react'

function App() {
  const [isOverrideActive, setIsOverrideActive] = useState(false)

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display selection:bg-primary selection:text-background-dark overflow-hidden h-screen">
      {/* Top Navigation */}
      <header className="flex items-center justify-between border-b border-border-dark px-6 py-3 bg-surface-dark/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-primary rounded flex items-center justify-center text-background-dark">
              <span className="material-symbols-outlined font-bold">visibility</span>
            </div>
            <h2 className="text-xl font-bold tracking-tighter uppercase italic">Red-Eye <span className="text-primary">AI</span></h2>
          </div>
          <nav className="hidden md:flex items-center gap-6 border-l border-border-dark pl-6">
            <a className="text-primary text-sm font-semibold tracking-wide flex items-center gap-2" href="#">
              <span className="size-1.5 rounded-full bg-primary animate-pulse"></span>
              LIVE NAVIGATOR
            </a>
            <a className="text-slate-400 hover:text-white text-sm font-medium transition-colors" href="#">HISTORY</a>
            <a className="text-slate-400 hover:text-white text-sm font-medium transition-colors" href="#">NEURAL LOGS</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <span className="size-2 rounded-full bg-primary"></span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">System Optimal</span>
          </div>
          <button className="p-2 hover:bg-border-dark rounded-lg transition-colors text-slate-400">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div className="size-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center overflow-hidden">
            <img
              className="w-full h-full object-cover"
              alt="User profile avatar"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCfHXXB7qXDIjM8jk0XLNngPxgxdo9DRLDJnkPHX9uBQvfY8jTg49WvKi6d7MBMtfNjwd33sqennrVUFIIqiF7hmqWgcWf13oxUjVKx6CD9ltvRgC2fAppqQgnuv_ExZkSmfAxIihF0AYv4NMr0vLZO-apX1ItwnUBgTHeKYSxYFQqOkqgq7LFl33_JUte2wl1I-ycgo24bhdh8ji7g6KqCrSjroROG37zewfhJSp7FSi1lYD9ZMEMPnMc9jIIRMVcRA3h4luWk-jMQ"
            />
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Left Column: Live Stream (70%) */}
        <div className="w-[70%] relative flex flex-col bg-black border-r border-border-dark group">
          {/* Browser Header Decor */}
          <div className="h-8 bg-surface-dark border-b border-border-dark flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <div className="size-2.5 rounded-full bg-red-500/20"></div>
              <div className="size-2.5 rounded-full bg-yellow-500/20"></div>
              <div className="size-2.5 rounded-full bg-green-500/20"></div>
            </div>
            <div className="flex-1 max-w-md mx-auto h-5 bg-background-dark/50 rounded text-[10px] flex items-center px-3 text-slate-500 font-mono">
              https://secure-checkout.internal.sys/billing-v4
            </div>
          </div>

          {/* Main Viewport */}
          <div className="flex-1 relative overflow-hidden cyber-grid">
            {/* Browser content representation */}
            <div className="absolute inset-0 flex items-center justify-center opacity-40 grayscale contrast-125">
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuB2Z9W9gG18WHMNvUPjLCYZ5jMjAPkBgip2aJx7LP5SZymxmQ1m5F7X1rFHCM0p_jxTHM3qxKlI47uhTZKEcX8lFzAWQ-u1pBC_tiHEEz0EXuv-YHvIuXzqGIu1kic6BavFDCJlRCeMteRPprGd_qU7qEN1Yt3xUzsx81ojQ9hK_-dVU5hWVu-aQBVZ30brtH4RMC3EdwI86KtzNwyE4iJFKJ-3IBW3AW5xNtSJjoMHm_8DXq9cztnlbKeZJCvOmHSNJWGeddVLpuEc")' }}
                aria-label="Active browser window displaying a complex checkout form"
              />
            </div>

            {/* HUD Overlays */}
            <div className="absolute inset-0 pointer-events-none p-6">
              {/* Scanning Reticle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-primary/20 rounded-full flex items-center justify-center">
                <div className="w-full h-[1px] bg-primary/30 absolute animate-pulse"></div>
                <div className="h-full w-[1px] bg-primary/30 absolute animate-pulse"></div>
              </div>

              {/* Corner HUD Units */}
              <div className="absolute top-6 left-6 p-3 bg-background-dark/60 backdrop-blur-md border border-primary/30 rounded-lg">
                <div className="text-[10px] text-primary/60 font-mono mb-1">CURSOR_POS</div>
                <div className="text-sm font-mono text-primary flex gap-4">
                  <span>X: 450.21</span>
                  <span>Y: 120.48</span>
                </div>
              </div>
              <div className="absolute top-6 right-6 p-3 bg-background-dark/60 backdrop-blur-md border border-primary/30 rounded-lg text-right">
                <div className="text-[10px] text-primary/60 font-mono mb-1">LATENCY</div>
                <div className="text-sm font-mono text-primary">12ms <span className="text-xs text-primary/40 tracking-tighter">SYMMETRICAL</span></div>
              </div>

              {/* Terminal Window Overlay */}
              <div className="absolute bottom-6 left-6 right-6 h-32 bg-background-dark/80 backdrop-blur-lg border border-primary/20 rounded-xl overflow-hidden pointer-events-auto">
                <div className="flex items-center justify-between px-4 py-2 border-b border-primary/10 bg-primary/5">
                  <span className="text-[10px] font-bold tracking-widest text-primary">AGENT_LOG_CORE_v2.0</span>
                  <div className="flex gap-2">
                    <span className="size-2 rounded-full bg-primary/40"></span>
                    <span className="size-2 rounded-full bg-primary"></span>
                  </div>
                </div>
                <div className="p-3 font-mono text-xs overflow-y-auto h-full space-y-1">
                  <p className="text-slate-500">[14:20:01] <span className="text-primary/80">DOM_ANALYSIS_COMPLETE</span>: Found 12 interactive elements.</p>
                  <p className="text-slate-500">[14:20:02] <span className="text-primary/80">TASK_IDENTIFIED</span>: Customer billing information required.</p>
                  <p className="text-slate-500">[14:20:04] <span className="text-primary">LOCATING</span> button element with selector #submit-order...</p>
                  <p className="text-slate-500">[14:20:05] <span className="text-primary">CLICKING</span> (x: 450, y: 120) - Simulation precision 99.8%</p>
                  <p className="text-slate-500 animate-pulse">[14:20:06] <span className="text-amber-400">WAITING</span> for server response (ACK_TIMEOUT: 15s)...</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Mission Control (30%) */}
        <div className="w-[30%] bg-surface-dark flex flex-col overflow-y-auto border-l border-border-dark">
          {/* Voice Visualizer Section */}
          <div className="p-8 border-b border-border-dark bg-background-dark/30">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">Voice Hub</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-primary uppercase">Barge-In Ready</span>
                <div className="size-2 rounded-full bg-primary animate-ping"></div>
              </div>
            </div>
            <div className="relative flex items-center justify-center py-10">
              <div className="absolute size-40 border border-primary/10 rounded-full"></div>
              <div className="absolute size-32 border border-primary/20 rounded-full"></div>
              {/* Animated Waves Mockup */}
              <div className="flex items-end gap-1.5 h-16">
                <div className="w-1 bg-primary/20 h-4 rounded-full"></div>
                <div className="w-1 bg-primary/40 h-8 rounded-full"></div>
                <div className="w-1 bg-primary/60 h-12 rounded-full"></div>
                <div className="w-1 bg-primary h-14 rounded-full shadow-[0_0_10px_rgba(204,255,0,0.5)]"></div>
                <div className="w-1 bg-primary/60 h-10 rounded-full"></div>
                <div className="w-1 bg-primary/40 h-6 rounded-full"></div>
                <div className="w-1 bg-primary/20 h-3 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Checklist Section */}
          <div className="p-8 flex-1">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">Requirements</h3>
              <span className="text-sm font-bold text-primary">65%</span>
            </div>
            <div className="space-y-4">
              <div className="w-full bg-border-dark h-1.5 rounded-full overflow-hidden mb-8">
                <div className="bg-primary h-full w-[65%] shadow-[0_0_8px_rgba(204,255,0,0.3)]"></div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-xl bg-background-dark/50 border border-border-dark">
                <div className="mt-0.5 text-primary">
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Identity Verification</h4>
                  <p className="text-xs text-slate-500">Encrypted link established</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-xl bg-background-dark/50 border border-border-dark">
                <div className="mt-0.5 text-primary">
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Form Selection</h4>
                  <p className="text-xs text-slate-500">Auto-filled 12/12 fields</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20 ring-1 ring-primary/20">
                <div className="mt-0.5 text-primary">
                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-primary">Form Completion</h4>
                  <p className="text-xs text-primary/70">Awaiting user confirmation</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-xl bg-background-dark/20 border border-slate-800 opacity-50">
                <div className="mt-0.5 text-slate-700">
                  <span className="material-symbols-outlined text-lg">circle</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-600">Final Authorization</h4>
                  <p className="text-xs text-slate-700">Signature pending</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Control Panel */}
          <div className="p-8 bg-background-dark/50 border-t border-border-dark">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-sm font-bold text-slate-200">Manual Override</h4>
                <p className="text-[10px] text-slate-500 font-mono">TAKEOVER_MODE_IDLE</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isOverrideActive}
                  onChange={(e) => setIsOverrideActive(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="flex justify-center">
              <button className="relative group">
                <div className="absolute -inset-1 bg-primary rounded-full blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative size-16 bg-primary rounded-full flex items-center justify-center text-background-dark shadow-lg transform active:scale-95 transition-transform">
                  <span className="material-symbols-outlined text-3xl font-bold">mic</span>
                </div>
              </button>
            </div>
            <p className="text-center mt-4 text-[10px] text-primary/50 font-mono tracking-widest uppercase">Tap to speak or override</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
