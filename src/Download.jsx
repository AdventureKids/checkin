import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

function detectOS() {
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'windows';
  if (ua.includes('Mac')) return 'mac';
  if (ua.includes('Linux')) return 'linux';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'ios';
  if (ua.includes('Android')) return 'android';
  return 'unknown';
}

export default function Download() {
  const [os, setOs] = useState('unknown');
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    setOs(detectOS());
  }, []);

  const isMobile = os === 'ios' || os === 'android';

  const handleDownload = () => {
    setDownloading(true);
    // Trigger the download
    window.location.href = `${API_BASE}/api/download/print-helper`;
    setTimeout(() => {
      setDownloading(false);
      setDownloaded(true);
    }, 2000);
  };

  const osInfo = {
    mac: { name: 'macOS', icon: '🍎', setupFile: 'Setup-Mac.command', startFile: 'Start-Mac.command' },
    windows: { name: 'Windows', icon: '🪟', setupFile: 'Setup-Windows.bat', startFile: 'Start-Windows.bat' },
    linux: { name: 'Linux', icon: '🐧', setupFile: 'Setup-Mac.command', startFile: 'Start-Mac.command' },
  };

  const currentOS = osInfo[os] || osInfo.mac;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-48 mx-auto mb-4">
            <img src="/adventure-kids-logo.png" alt="Adventure Kids" className="w-full invert opacity-80" 
              onError={(e) => e.target.style.display = 'none'} />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Print Helper</h1>
          <p className="text-indigo-300/70 text-lg">Print check-in labels from your browser</p>
        </div>

        {/* Mobile Warning */}
        {isMobile && (
          <div className="bg-amber-500/20 border border-amber-500/40 rounded-2xl p-6 mb-6 text-center">
            <p className="text-amber-200 text-lg font-medium mb-2">📱 Mobile Device Detected</p>
            <p className="text-amber-200/70 text-sm">
              The Print Helper runs on a <strong>Mac or PC</strong> that's connected to your DYMO LabelWriter.
              You can check kids in from this device, but printing requires a computer with the printer attached.
            </p>
          </div>
        )}

        {/* Download Card */}
        {!isMobile && (
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700 shadow-xl overflow-hidden mb-6">
            {/* OS Detection */}
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-8 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{currentOS.icon}</span>
                  <div>
                    <p className="text-emerald-300 font-medium">Detected: {currentOS.name}</p>
                    <p className="text-emerald-300/60 text-xs">Same download works for Mac, Windows & Linux</p>
                  </div>
                </div>
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>

            {/* Download Button */}
            <div className="p-8 text-center">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-lg font-bold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-wait"
              >
                {downloading ? (
                  <>
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Downloading...
                  </>
                ) : downloaded ? (
                  <>✅ Downloaded!</>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Print Helper
                  </>
                )}
              </button>
              <p className="text-slate-400 text-sm mt-3">ChurchCheck-PrintHelper.zip • ~2 MB</p>
            </div>
          </div>
        )}

        {/* Setup Instructions */}
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700 p-8 mb-6">
          <h2 className="text-white text-xl font-bold mb-6">Setup Instructions</h2>
          
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 font-bold">1</div>
              <div>
                <p className="text-white font-medium">Download & Unzip</p>
                <p className="text-slate-400 text-sm mt-1">
                  Click the download button above, then unzip <code className="bg-slate-700 px-2 py-0.5 rounded text-emerald-300 text-xs">ChurchCheck-PrintHelper.zip</code> to your Desktop or Documents folder.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 font-bold">2</div>
              <div>
                <p className="text-white font-medium">Run Setup (one time)</p>
                <p className="text-slate-400 text-sm mt-1">
                  {os === 'windows' ? (
                    <>Double-click <code className="bg-slate-700 px-2 py-0.5 rounded text-emerald-300 text-xs">Setup-Windows.bat</code> — it will install Node.js if needed and set up the printer.</>
                  ) : (
                    <>Double-click <code className="bg-slate-700 px-2 py-0.5 rounded text-emerald-300 text-xs">Setup-Mac.command</code> — it will install Node.js if needed and detect your DYMO printer. You can also opt to auto-start on login.</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 font-bold">3</div>
              <div>
                <p className="text-white font-medium">Connect Your Printer</p>
                <p className="text-slate-400 text-sm mt-1">
                  Plug your DYMO LabelWriter into this computer via USB. Load 30256 Shipping labels. The setup script will auto-detect it.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 font-bold">4</div>
              <div>
                <p className="text-white font-medium">Start the Print Helper</p>
                <p className="text-slate-400 text-sm mt-1">
                  {os === 'windows' ? (
                    <>Double-click <code className="bg-slate-700 px-2 py-0.5 rounded text-emerald-300 text-xs">Start-Windows.bat</code> — keep the window open while checking in.</>
                  ) : (
                    <>Double-click <code className="bg-slate-700 px-2 py-0.5 rounded text-emerald-300 text-xs">Start-Mac.command</code> — keep the Terminal window open while checking in.</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 font-bold">5</div>
              <div>
                <p className="text-white font-medium">Open Check-In</p>
                <p className="text-slate-400 text-sm mt-1">
                  Open Chrome and visit this website. Log in with your organization credentials. You'll see <span className="text-emerald-400">🖨️ Printer Ready</span> in the top-left corner. Check in a child — a label will print!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700 p-8 mb-6">
          <h2 className="text-white text-xl font-bold mb-4">FAQ</h2>
          
          <div className="space-y-4">
            <div>
              <p className="text-white font-medium text-sm">Do I need this to check kids in?</p>
              <p className="text-slate-400 text-xs mt-1">No! Check-in works from any browser without the Print Helper. You only need it if you want to print physical labels.</p>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Can I use an iPad for check-in?</p>
              <p className="text-slate-400 text-xs mt-1">Yes! Use the iPad for check-in, and run the Print Helper on a nearby Mac/PC connected to the printer. The iPad sends print jobs over WiFi.</p>
            </div>
            <div>
              <p className="text-white font-medium text-sm">What printers are supported?</p>
              <p className="text-slate-400 text-xs mt-1">DYMO LabelWriter 450, 450 Turbo, 550, and 550 Turbo with 30256 Shipping labels (2.31" x 4").</p>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Does it work on Windows?</p>
              <p className="text-slate-400 text-xs mt-1">Yes! Both Mac and Windows are fully supported. The download includes setup scripts for both.</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-center gap-6 text-sm">
          <a href="/" className="text-slate-500 hover:text-white transition-colors">← Back to Check-In</a>
          <a href="/admin" className="text-slate-500 hover:text-white transition-colors">Admin Dashboard →</a>
        </div>
      </div>
    </div>
  );
}

