import React, { useState, useEffect, useRef } from 'react';
import { isDymoServiceRunning, getDymoPrinters, printCheckInLabels, isPrintHelperRunning, printViaHelper } from './dymoPrint';

// Use relative URL in production (same origin), localhost in development
const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

// Get stored auth token for API calls
function getAuthHeaders() {
  const token = localStorage.getItem('kioskToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ============================================
// KIOSK SETUP / LOGIN SCREEN
// ============================================
const KioskSetupScreen = ({ onSetupComplete }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [printHelperStatus, setPrintHelperStatus] = useState(null);
  const [checkingPrinter, setCheckingPrinter] = useState(true);

  // Check print helper on mount
  useEffect(() => {
    const checkPrinter = async () => {
      try {
        const status = await isPrintHelperRunning();
        setPrintHelperStatus(status);
      } catch (e) {
        setPrintHelperStatus({ running: false });
      }
      setCheckingPrinter(false);
    };
    checkPrinter();
    // Re-check every 5 seconds
    const interval = setInterval(checkPrinter, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('kioskToken', data.token);
        localStorage.setItem('kioskOrgName', data.orgName || '');
        localStorage.setItem('kioskOrgId', data.orgId || '1');
        onSetupComplete(data);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Could not connect to server. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="w-48 mx-auto mb-4">
            <img src="/adventure-kids-logo.png" alt="Adventure Kids" className="w-full invert opacity-80" 
              onError={(e) => e.target.style.display = 'none'} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">ChurchCheck</h1>
          <p className="text-indigo-300/70">Kiosk Station Setup</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 shadow-xl mb-6">
          <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
            <span>🔐</span> Sign In to Your Organization
          </h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3 mb-5 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-slate-300 mb-1.5 text-sm">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="admin"
              required
              autoFocus
            />
          </div>

          <div className="mb-6">
            <label className="block text-slate-300 mb-1.5 text-sm">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Connect Kiosk'}
          </button>
        </form>

        {/* Print Helper Status */}
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <span>🖨️</span> Print Station Status
          </h3>
          
          {checkingPrinter ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
              Checking for print helper...
            </div>
          ) : printHelperStatus?.running ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              Print helper connected — {printHelperStatus.printer || 'DYMO LabelWriter'}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 text-amber-400 text-sm mb-3">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                Print helper not detected
              </div>
              <p className="text-slate-400 text-xs mb-3">
                Need label printing? Install the Print Helper once — it runs silently in the background forever, even after restarts. 
                Check-in works without it — labels just won't print.
              </p>
              <a
                href="/download"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
              >
                <span>⬇️</span> One-Time Print Helper Install
              </a>
            </div>
          )}
        </div>

        {/* Admin link */}
        <div className="text-center mt-6">
          <a href="/admin" className="text-slate-500 hover:text-slate-300 transition-colors text-sm">
            Admin Dashboard →
          </a>
        </div>
      </div>
    </div>
  );
};

// ============================================
// AVATAR SYSTEM - Gender-based explorer characters
// ============================================

// Get avatar config based on gender (folder, prefix, and frame count)
const getAvatarConfig = (gender) => {
  const isFemale = gender?.toLowerCase() === 'female' || gender?.toLowerCase() === 'f';
  return {
    folder: isFemale ? 'girl-ranger' : 'boy-ranger',
    prefix: isFemale ? 'girl-test' : 'boy-test',
    frameCount: isFemale ? 150 : 115  // Girl: 000-149, Boy: 000-114
  };
};

// Get static avatar URL based on gender
const getAvatarUrl = (gender) => {
  const { folder, prefix } = getAvatarConfig(gender);
  return `/avatars/${folder}/${prefix}-000.png`;
};

// Animated Avatar component - plays PNG sequence based on gender
// Preloads ALL frames before animating for smooth playback over network
const avatarCache = {}; // Cache preloaded images across renders

const AnimatedAvatar = ({ gender, className = "w-56 h-56", onAnimationComplete }) => {
  const [frame, setFrame] = useState(0);
  const [ready, setReady] = useState(false);
  const frameRef = useRef(0);
  const animationRef = useRef(null);
  const { folder, prefix, frameCount } = getAvatarConfig(gender);
  const cacheKey = `${folder}/${prefix}`;
  
  useEffect(() => {
    let cancelled = false;
    frameRef.current = 0;
    setFrame(0);
    
    // Check if already cached
    if (avatarCache[cacheKey]) {
      setReady(true);
      return;
    }
    
    // Preload ALL frames and wait for them to finish
    const preloadAll = async () => {
      const promises = [];
      for (let i = 0; i < frameCount; i++) {
        promises.push(new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve; // Don't block on failed frames
          img.src = `/avatars/${folder}/${prefix}-${String(i).padStart(3, '0')}.png`;
        }));
      }
      await Promise.all(promises);
      avatarCache[cacheKey] = true;
      if (!cancelled) setReady(true);
    };
    
    preloadAll();
    return () => { cancelled = true; };
  }, [folder, prefix, frameCount, cacheKey]);
  
  // Start animation only after all frames are loaded
  useEffect(() => {
    if (!ready) return;
    
    const fps = 24;
    const frameDelay = 1000 / fps;
    
    const animate = () => {
      frameRef.current += 1;
      if (frameRef.current >= frameCount) {
        if (onAnimationComplete) onAnimationComplete();
        frameRef.current = 0;
      }
      setFrame(frameRef.current);
      animationRef.current = setTimeout(animate, frameDelay);
    };
    
    animationRef.current = setTimeout(animate, frameDelay);
    
    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, [ready, frameCount, onAnimationComplete]);
  
  const frameNumber = String(frame).padStart(3, '0');
  
  return (
    <div className={`${className} relative`}>
      <img 
        src={`/avatars/${folder}/${prefix}-${frameNumber}.png`}
        alt="Adventure Kid"
        className="w-full h-full object-contain"
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

// Confetti component
const Confetti = () => {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360,
    size: 8 + Math.random() * 12
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {confettiPieces.map(piece => (
        <div
          key={piece.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${piece.left}%`,
            top: '-20px',
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            transform: `rotate(${piece.rotation}deg)`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px'
          }}
        />
      ))}
    </div>
  );
};

// Floating particles background
const FloatingParticles = () => {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    size: 4 + Math.random() * 8,
    left: Math.random() * 100,
    duration: 15 + Math.random() * 20,
    delay: Math.random() * 10,
    opacity: 0.1 + Math.random() * 0.2
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full bg-white animate-float-up"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            bottom: '-20px',
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`
          }}
        />
      ))}
    </div>
  );
};

// Welcome Screen
const WelcomeScreen = ({ onFamilyLogin, onKidLogin }) => (
  <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex flex-col items-center justify-center p-8 relative overflow-hidden">
    <FloatingParticles />
    
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/10 rounded-full animate-pulse" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-white/5 rounded-full" />
    
    <div className="relative z-10 text-center">
      <div className="mb-8 animate-bounce-slow">
        <div className="w-80 mx-auto">
          <img src="/adventure-kids-logo.png" alt="Adventure Kids" className="w-full h-full invert" />
        </div>
      </div>

      <h1 className="text-5xl font-black text-white mb-4 tracking-tight">
        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500">
          Check In
        </span>
      </h1>
      
      <p className="text-xl text-indigo-200 mb-8 font-light">
        How would you like to check in?
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={onFamilyLogin}
          className="group relative px-12 py-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl text-xl font-bold text-indigo-900 shadow-2xl shadow-orange-500/40 hover:shadow-orange-500/60 transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <span className="text-3xl mb-1 block">📱</span>
          <span className="relative z-10">Phone Number</span>
        </button>
        
        <button
          onClick={onKidLogin}
          className="group relative px-12 py-6 bg-gradient-to-r from-emerald-400 to-cyan-500 rounded-2xl text-xl font-bold text-indigo-900 shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-500/60 transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <span className="text-3xl mb-1 block">🔐</span>
          <span className="relative z-10">My Secret PIN</span>
        </button>
      </div>
      
      {/* Register Now Link */}
      <div className="mt-8">
        <p className="text-indigo-200 mb-2">New to Adventure Kids?</p>
        <a 
          href="/register"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-semibold transition-all duration-300 hover:scale-105"
        >
          <span className="text-xl">✨</span>
          Register Now
        </a>
      </div>
      
      <p className="mt-8 text-indigo-300/60 text-sm">
        Adventure Kids Check-In
      </p>
    </div>
  </div>
);

// Kid PIN Entry Screen
const KidPinScreen = ({ onSubmit, onBack, loading }) => {
  const [pin, setPin] = useState('');
  const inputRef = React.useRef(null);
  
  const handleKeyPress = (key) => {
    if (key === 'delete') {
      setPin(prev => prev.slice(0, -1));
    } else if (key === 'clear') {
      setPin('');
    } else if (pin.length < 6) {
      setPin(prev => prev + key);
    }
    inputRef.current?.focus();
  };
  
  const handleInputChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(value);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && pin.length === 6 && !loading) {
      onSubmit(pin);
    }
  };
  
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  const isComplete = pin.length === 6;
  
  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 flex flex-col items-center justify-center p-8 relative"
      onClick={() => inputRef.current?.focus()}
    >
      <FloatingParticles />
      
      <input
        ref={inputRef}
        type="tel"
        value={pin}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="absolute opacity-0 pointer-events-none"
        inputMode="numeric"
      />
      
      <button 
        onClick={onBack}
        className="absolute top-8 left-8 text-white/60 hover:text-white flex items-center gap-2 transition-colors"
      >
        <span className="text-2xl">←</span>
        <span>Back</span>
      </button>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6">
          <span className="text-6xl">🔐</span>
        </div>
        <h2 className="text-4xl font-bold text-white text-center mb-2">Enter Your PIN</h2>
        <p className="text-emerald-200 text-center mb-8">Your secret 6-digit code</p>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/20">
          <div className="flex justify-center gap-3">
            {[0,1,2,3,4,5].map(i => (
              <div 
                key={i}
                className={`w-12 h-16 rounded-xl flex items-center justify-center text-3xl font-bold transition-all ${
                  pin[i] 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-white/20 text-white/30'
                }`}
              >
                {pin[i] ? '●' : ''}
              </div>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'clear', 0, 'delete'].map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key.toString())}
              tabIndex={-1}
              className={`
                h-16 rounded-xl text-2xl font-semibold transition-all duration-150 active:scale-95
                ${key === 'clear' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 text-base' : 
                  key === 'delete' ? 'bg-white/10 text-white/60 hover:bg-white/20 text-base' :
                  'bg-white/10 text-white hover:bg-white/20'}
              `}
            >
              {key === 'delete' ? '⌫' : key === 'clear' ? 'Clear' : key}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => isComplete && !loading && onSubmit(pin)}
          disabled={!isComplete || loading}
          tabIndex={-1}
          className={`
            w-full py-5 rounded-2xl text-xl font-bold transition-all duration-300
            ${isComplete && !loading
              ? 'bg-gradient-to-r from-emerald-400 to-cyan-500 text-white shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98]' 
              : 'bg-white/10 text-white/30 cursor-not-allowed'}
          `}
        >
          {loading ? 'Looking up...' : "Let's Go!"}
        </button>
      </div>
    </div>
  );
};

// Kid Personal Check-in Screen (after PIN verified)
const KidCheckinScreen = ({ child, onCheckIn, onBack, activeTemplate }) => {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch rooms based on active template
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const roomsResponse = await fetch(`${API_BASE}/api/rooms`, { headers: getAuthHeaders() });
        const allRooms = await roomsResponse.json();
        
        if (activeTemplate && activeTemplate.room_ids && activeTemplate.room_ids.length > 0) {
          const templateRooms = allRooms.filter(room => 
            activeTemplate.room_ids.includes(room.id)
          );
          setRooms(templateRooms.length > 0 ? templateRooms : allRooms);
        } else {
          setRooms(allRooms);
        }
      } catch (err) {
        console.error('Error fetching rooms:', err);
        setRooms([
          { id: 1, name: 'Room 100 - Nursery', age_range: '0-1' },
          { id: 2, name: 'Room 101 - Toddlers', age_range: '2-3' },
          { id: 3, name: 'Room 102 - Pre-K', age_range: '4-5' },
          { id: 4, name: 'Room 103 - Elementary', age_range: '6-10' },
        ]);
      }
      setLoading(false);
    };
    fetchRooms();
  }, [activeTemplate]);

  const getDefaultRoom = (age, roomList) => {
    if (roomList.length === 0) return null;
    
    for (const room of roomList) {
      if (room.age_range) {
        const [min, max] = room.age_range.split('-').map(Number);
        if (age >= min && age <= max) {
          return room.id;
        }
      }
    }
    return roomList[0]?.id;
  };

  useEffect(() => {
    if (rooms.length > 0 && !selectedRoom) {
      setSelectedRoom(getDefaultRoom(child.age, rooms));
    }
  }, [rooms, child.age, selectedRoom]);

  const handleCheckIn = () => {
    const room = rooms.find(r => r.id === selectedRoom);
    onCheckIn({
      ...child,
      room: room?.name || rooms[0]?.name || 'Room 101'
    });
  };

  // Calculate progress to next reward
  const getProgressPercent = () => {
    if (!child.nextReward) return 100;
    const current = child.nextReward.progress;
    const target = child.nextReward.triggerValue;
    return Math.min(Math.round((current / target) * 100), 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <FloatingParticles />
      
      <button 
        onClick={onBack}
        className="absolute top-8 left-8 text-white/60 hover:text-white flex items-center gap-2 transition-colors z-20"
      >
        <span className="text-2xl">←</span>
        <span>Back</span>
      </button>
      
      {/* Background glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/30 rounded-full blur-3xl" />
      
      <div className="relative z-10 w-full max-w-lg">
        {/* Avatar and Name - Hero Section */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <AnimatedAvatar gender={child.gender} className="w-56 h-56 mx-auto drop-shadow-2xl" />
            {/* Streak badge */}
            {child.streak > 0 && (
              <div className="absolute -bottom-3 -right-3 bg-orange-500 text-white px-3 py-2 rounded-full text-sm font-bold shadow-lg flex flex-col items-center leading-tight">
                <span>🔥 {child.streak}</span>
                <span className="text-xs">Week</span>
                <span className="text-xs">Streak!</span>
              </div>
            )}
          </div>
          
          <h1 className="text-5xl font-black text-white mb-2">
            Hey, {child.name}! 👋
          </h1>
          <p className="text-xl text-indigo-200">Ready for another adventure?</p>
        </div>
        
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
            <p className="text-3xl font-bold text-orange-400">{child.streak || 0}</p>
            <p className="text-indigo-300 text-sm">Week Streak</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
            <p className="text-3xl font-bold text-yellow-400">{child.badges || 0}</p>
            <p className="text-indigo-300 text-sm">Badges</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
            <p className="text-3xl font-bold text-emerald-400">{child.totalCheckins || 0}</p>
            <p className="text-indigo-300 text-sm">Check-ins</p>
          </div>
        </div>
        
        {/* Next Reward Teaser */}
        {child.nextReward && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-sm rounded-xl p-4 mb-6 border border-yellow-400/30">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{child.nextReward.icon}</span>
              <div className="flex-1">
                <p className="text-yellow-200 text-sm">Next Reward</p>
                <p className="text-white font-bold">{child.nextReward.name}</p>
              </div>
              <div className="text-right">
                <p className="text-yellow-200 text-sm">
                  {child.nextReward.progress}/{child.nextReward.triggerValue}
                </p>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-yellow-400 to-orange-500 h-3 rounded-full transition-all"
                style={{ width: `${getProgressPercent()}%` }}
              />
            </div>
            <p className="text-yellow-200/70 text-xs mt-2 text-center">
              Prize: {child.nextReward.prize}
            </p>
          </div>
        )}
        
        {/* Room Selection */}
        <div className="mb-6">
          <p className="text-indigo-200 text-sm mb-3 text-center">Select your room:</p>
          {loading ? (
            <p className="text-white/50 text-center">Loading rooms...</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {rooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room.id)}
                  className={`px-4 py-3 rounded-xl text-left transition-all ${
                    selectedRoom === room.id
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  <p className="font-semibold text-sm">{room.name}</p>
                  {room.age_range && <p className="text-xs opacity-70">Ages {room.age_range}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Check In Button */}
        <button
          onClick={handleCheckIn}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-green-400 to-emerald-500 text-white text-2xl font-bold shadow-xl shadow-green-500/30 hover:shadow-green-500/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Check Me In! 🚀
        </button>
      </div>
    </div>
  );
};

// Phone Entry Screen
const PhoneEntryScreen = ({ onSubmit, onBack, loading }) => {
  const [phone, setPhone] = useState('');
  const inputRef = React.useRef(null);
  
  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  };
  
  const handleKeyPress = (key) => {
    if (key === 'delete') {
      setPhone(prev => {
        const numbers = prev.replace(/\D/g, '');
        return formatPhone(numbers.slice(0, -1));
      });
    } else if (key === 'clear') {
      setPhone('');
    } else if (phone.replace(/\D/g, '').length < 10) {
      setPhone(prev => formatPhone(prev.replace(/\D/g, '') + key));
    }
    // Keep focus on hidden input for keyboard support
    inputRef.current?.focus();
  };
  
  // Handle keyboard input
  const handleInputChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(formatPhone(value));
  };
  
  // Handle keyboard events (backspace, enter)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && isComplete && !loading) {
      onSubmit(phone);
    }
  };
  
  // Focus input on mount
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  const isComplete = phone.replace(/\D/g, '').length === 10;
  
  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-8 relative"
      onClick={() => inputRef.current?.focus()}
    >
      <FloatingParticles />
      
      {/* Hidden input for keyboard support */}
      <input
        ref={inputRef}
        type="tel"
        value={phone.replace(/\D/g, '')}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="absolute opacity-0 pointer-events-none"
        autoComplete="tel"
        inputMode="numeric"
      />
      
      <button 
        onClick={onBack}
        className="absolute top-8 left-8 text-white/60 hover:text-white flex items-center gap-2 transition-colors"
      >
        <span className="text-2xl">←</span>
        <span>Back</span>
      </button>
      
      <div className="relative z-10 w-full max-w-md">
        <h2 className="text-4xl font-bold text-white text-center mb-2">Enter Phone Number</h2>
        <p className="text-indigo-300 text-center mb-8">The number registered with your family</p>
        
        <div 
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/20 cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          <div className="text-4xl font-mono text-white text-center tracking-wider min-h-[48px]">
            {phone || <span className="text-white/30">(___) ___-____</span>}
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'clear', 0, 'delete'].map((key) => (
            <button
              key={key}
              onClick={() => handleKeyPress(key.toString())}
              tabIndex={-1}
              className={`
                h-16 rounded-xl text-2xl font-semibold transition-all duration-150 active:scale-95
                ${key === 'clear' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 text-base' : 
                  key === 'delete' ? 'bg-white/10 text-white/60 hover:bg-white/20 text-base' :
                  'bg-white/10 text-white hover:bg-white/20'}
              `}
            >
              {key === 'delete' ? '⌫' : key === 'clear' ? 'Clear' : key}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => isComplete && !loading && onSubmit(phone)}
          disabled={!isComplete || loading}
          tabIndex={-1}
          className={`
            w-full py-5 rounded-2xl text-xl font-bold transition-all duration-300
            ${isComplete && !loading
              ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-xl shadow-green-500/30 hover:shadow-green-500/50 hover:scale-[1.02] active:scale-[0.98]' 
              : 'bg-white/10 text-white/30 cursor-not-allowed'}
          `}
        >
          {loading ? 'Looking up...' : 'Find My Family'}
        </button>
      </div>
    </div>
  );
};

// Not Found Screen
const NotFoundScreen = ({ phone, onBack, onTryAgain }) => {
  const registerUrl = `${window.location.origin}/register`;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-8 relative">
      <FloatingParticles />
      
      <button 
        onClick={onBack}
        className="absolute top-8 left-8 text-white/60 hover:text-white flex items-center gap-2 transition-colors"
      >
        <span className="text-2xl">←</span>
        <span>Back</span>
      </button>
      
      <div className="relative z-10 text-center max-w-md">
        <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🔍</span>
        </div>
        
        <h2 className="text-3xl font-bold text-white mb-4">Family Not Found</h2>
        <p className="text-indigo-300 mb-8">
          We couldn't find a family registered with <span className="text-white font-semibold">{phone}</span>
        </p>
        
        <div className="bg-white rounded-2xl p-6 mb-6">
          <p className="text-gray-600 mb-4">Scan to register your family:</p>
          <div className="bg-gray-100 rounded-xl p-4 inline-block">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(registerUrl)}`}
              alt="QR Code to register"
              className="w-48 h-48"
            />
          </div>
          <p className="text-gray-500 text-sm mt-4">Or visit: <a href={registerUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-medium hover:text-emerald-700 underline">{registerUrl}</a></p>
        </div>
        
        <button
          onClick={onTryAgain}
          className="text-indigo-300 hover:text-white transition-colors"
        >
          Try a different phone number
        </button>
      </div>
    </div>
  );
};

// Volunteer Check-in Screen
const VolunteerCheckinScreen = ({ volunteer, onCheckIn, onBack, activeTemplate }) => {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch rooms based on active template
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const roomsResponse = await fetch(`${API_BASE}/api/rooms`, { headers: getAuthHeaders() });
        const allRooms = await roomsResponse.json();
        
        if (activeTemplate && activeTemplate.room_ids && activeTemplate.room_ids.length > 0) {
          const templateRooms = allRooms.filter(room => 
            activeTemplate.room_ids.includes(room.id)
          );
          setRooms(templateRooms.length > 0 ? templateRooms : allRooms);
        } else {
          setRooms(allRooms);
        }
      } catch (err) {
        console.error('Error fetching rooms:', err);
        setRooms([]);
      }
      setLoading(false);
    };
    fetchRooms();
  }, [activeTemplate]);

  // Auto-select room based on service area if available
  useEffect(() => {
    if (rooms.length > 0 && !selectedRoom) {
      // Try to match service area to a room
      if (volunteer.volunteerDetails?.serviceArea) {
        const matchingRoom = rooms.find(r => 
          r.name.toLowerCase().includes(volunteer.volunteerDetails.serviceArea.toLowerCase())
        );
        if (matchingRoom) {
          setSelectedRoom(matchingRoom.id);
          return;
        }
      }
      // Default to first room
      setSelectedRoom(rooms[0]?.id);
    }
  }, [rooms, volunteer.volunteerDetails?.serviceArea, selectedRoom]);

  const handleCheckIn = () => {
    const room = rooms.find(r => r.id === selectedRoom);
    onCheckIn({
      ...volunteer,
      room: room?.name || 'Main Area',
      isVolunteer: true
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <FloatingParticles />
      
      <button 
        onClick={onBack}
        className="absolute top-8 left-8 text-white/60 hover:text-white flex items-center gap-2 transition-colors z-20"
      >
        <span className="text-2xl">←</span>
        <span>Back</span>
      </button>
      
      {/* Background glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/30 rounded-full blur-3xl" />
      
      <div className="relative z-10 w-full max-w-lg">
        {/* Volunteer Badge Icon */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <div className="w-40 h-40 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
              <span className="text-7xl">🙋</span>
            </div>
            {/* Volunteer badge */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-indigo-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
              VOLUNTEER
            </div>
          </div>
          
          <h1 className="text-5xl font-black text-white mb-2 mt-6">
            Welcome, {volunteer.firstName}! 
          </h1>
          <p className="text-xl text-indigo-200">Thank you for serving today!</p>
        </div>
        
        {/* Service Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
            <p className="text-3xl font-bold text-emerald-400">{volunteer.totalCheckins || 0}</p>
            <p className="text-indigo-300 text-sm">Shifts Served</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
            <p className="text-lg font-semibold text-indigo-200">{volunteer.volunteerDetails?.serviceArea || 'Not assigned'}</p>
            <p className="text-indigo-300 text-sm">Service Area</p>
          </div>
        </div>
        
        {/* Room Selection */}
        {rooms.length > 0 && (
          <div className="mb-6">
            <p className="text-indigo-200 text-sm mb-3 text-center">Where are you serving today?</p>
            {loading ? (
              <p className="text-white/50 text-center">Loading rooms...</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoom(room.id)}
                    className={`px-4 py-3 rounded-xl text-left transition-all ${
                      selectedRoom === room.id
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    <p className="font-semibold text-sm">{room.name}</p>
                    {room.age_range && <p className="text-xs opacity-70">Ages {room.age_range}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Check In Button */}
        <button
          onClick={handleCheckIn}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-2xl font-bold shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Check In & Print Badge 🏷️
        </button>
        
        <p className="text-center text-indigo-300/60 text-sm mt-4">
          A volunteer badge will be printed for you
        </p>
      </div>
    </div>
  );
};

// Child Select Screen
const ChildSelectScreen = ({ family, onCheckIn, onBack, activeTemplate }) => {
  const [selectedChildren, setSelectedChildren] = useState([]);
  const [childRooms, setChildRooms] = useState({});
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch rooms based on active template
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        // First get all rooms
        const roomsResponse = await fetch(`${API_BASE}/api/rooms`, { headers: getAuthHeaders() });
        const allRooms = await roomsResponse.json();
        
        // If there's an active template with specific rooms, filter to those
        if (activeTemplate && activeTemplate.room_ids && activeTemplate.room_ids.length > 0) {
          const templateRooms = allRooms.filter(room => 
            activeTemplate.room_ids.includes(room.id)
          );
          setRooms(templateRooms.length > 0 ? templateRooms : allRooms);
        } else {
          setRooms(allRooms);
        }
      } catch (err) {
        console.error('Error fetching rooms:', err);
        // Fallback to default rooms
        setRooms([
          { id: 1, name: 'Room 100 - Nursery', age_range: '0-1' },
          { id: 2, name: 'Room 101 - Toddlers', age_range: '2-3' },
          { id: 3, name: 'Room 102 - Pre-K', age_range: '4-5' },
          { id: 4, name: 'Room 103 - Elementary', age_range: '6-10' },
        ]);
      }
      setLoading(false);
    };
    fetchRooms();
  }, [activeTemplate]);

  const getDefaultRoom = (age) => {
    // Find the best matching room based on age
    if (rooms.length === 0) return null;
    
    for (const room of rooms) {
      if (room.age_range) {
        const [min, max] = room.age_range.split('-').map(Number);
        if (age >= min && age <= max) {
          return room.id;
        }
      }
    }
    // Default to first room if no age match
    return rooms[0]?.id;
  };

  const toggleChild = (child) => {
    setSelectedChildren(prev => {
      const isSelected = prev.find(c => c.id === child.id);
      if (isSelected) {
        const newRooms = { ...childRooms };
        delete newRooms[child.id];
        setChildRooms(newRooms);
        return prev.filter(c => c.id !== child.id);
      } else {
        setChildRooms(prev => ({ ...prev, [child.id]: getDefaultRoom(child.age) }));
        return [...prev, child];
      }
    });
  };

  const setRoom = (childId, roomId) => {
    setChildRooms(prev => ({ ...prev, [childId]: roomId }));
  };

  const handleCheckIn = () => {
    if (selectedChildren.length > 0) {
      const childrenWithRooms = selectedChildren.map(child => ({
        ...child,
        room: rooms.find(r => r.id === childRooms[child.id])?.name || rooms[0]?.name || 'Room 101'
      }));
      onCheckIn(childrenWithRooms);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading rooms...</div>
      </div>
    );
  }

  // Separate kids from volunteers
  const kids = family.children.filter(c => !c.notes || !c.notes.includes('Volunteer'));
  const volunteers = family.children.filter(c => c.notes && c.notes.includes('Volunteer'));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center p-8 relative">
      <FloatingParticles />
      
      <button 
        onClick={onBack}
        className="absolute top-8 left-8 text-white/60 hover:text-white flex items-center gap-2 transition-colors"
      >
        <span className="text-2xl">←</span>
        <span>Back</span>
      </button>
      
      <div className="relative z-10 w-full max-w-2xl mt-8">
        <h2 className="text-4xl font-bold text-white text-center mb-2">
          Hi, {family.name}! 👋
        </h2>
        <p className="text-indigo-300 text-center mb-10">Select who's checking in today</p>
        
        {/* Kids Section */}
        {kids.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2">
              <span>👶</span> Kids Check-In
            </h3>
            <div className="grid gap-4">
              {kids.map((child, index) => {
                const isSelected = selectedChildren.find(c => c.id === child.id);
                return (
                  <div
                    key={child.id}
                    className={`rounded-2xl border-2 transition-all duration-300 ${
                      isSelected 
                        ? 'bg-green-500/20 border-green-500 shadow-lg shadow-green-500/20' 
                        : 'bg-white/10 border-white/20'
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <button
                      onClick={() => toggleChild(child)}
                      className="w-full p-6 text-left"
                    >
                      <div className="flex items-center gap-6">
                        <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-green-500 border-green-500' : 'border-white/40'
                        }`}>
                          {isSelected && <span className="text-white text-xl">✓</span>}
                        </div>
                        
                        <img 
                          src={getAvatarUrl(child.gender)} 
                          alt={child.name}
                          className="w-28 h-28 flex-shrink-0"
                        />
                        
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-white mb-1">{child.name}</h3>
                          <p className="text-indigo-300">Age {child.age}</p>
                        </div>
                        
                        <div className="text-right">
                          <div className="flex items-center gap-2 text-orange-400 mb-1">
                            <span className="text-xl">🔥</span>
                            <span className="text-lg font-bold">{child.streak || 0} week streak</span>
                          </div>
                          <p className="text-indigo-400 text-sm">{child.badges || 0} badges</p>
                        </div>
                      </div>
                    </button>
                    
                    {isSelected && (
                      <div className="px-6 pb-6 pt-2 border-t border-green-500/30">
                        <p className="text-green-300 text-sm mb-3">Select Room:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {rooms.map(room => (
                            <button
                              key={room.id}
                              onClick={() => setRoom(child.id, room.id)}
                              className={`px-4 py-3 rounded-lg text-left transition-all ${
                                childRooms[child.id] === room.id
                                  ? 'bg-green-500 text-white'
                                  : 'bg-white/10 text-white/80 hover:bg-white/20'
                              }`}
                            >
                              <p className="font-semibold text-sm">{room.name}</p>
                              {room.age_range && <p className="text-xs opacity-70">Ages {room.age_range}</p>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Volunteers Section */}
        {volunteers.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-indigo-400 mb-4 flex items-center gap-2">
              <span>🙋</span> Volunteer Check-In
            </h3>
            <div className="grid gap-4">
              {volunteers.map((volunteer, index) => {
                const isSelected = selectedChildren.find(c => c.id === volunteer.id);
                return (
                  <div
                    key={volunteer.id}
                    className={`rounded-2xl border-2 transition-all duration-300 ${
                      isSelected 
                        ? 'bg-indigo-500/20 border-indigo-500 shadow-lg shadow-indigo-500/20' 
                        : 'bg-white/10 border-white/20'
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <button
                      onClick={() => toggleChild({ ...volunteer, isVolunteer: true })}
                      className="w-full p-6 text-left"
                    >
                      <div className="flex items-center gap-6">
                        <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-white/40'
                        }`}>
                          {isSelected && <span className="text-white text-xl">✓</span>}
                        </div>
                        
                        {/* Volunteer icon instead of avatar */}
                        <div className="w-28 h-28 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center">
                          <span className="text-5xl">🙋</span>
                        </div>
                        
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-white mb-1">{volunteer.name}</h3>
                          <span className="px-2 py-1 bg-indigo-500/30 text-indigo-300 text-sm rounded-full">Volunteer</span>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-2xl font-bold text-emerald-400">{volunteer.total_checkins || 0}</p>
                          <p className="text-indigo-400 text-sm">shifts served</p>
                        </div>
                      </div>
                    </button>
                    
                    {isSelected && (
                      <div className="px-6 pb-6 pt-2 border-t border-indigo-500/30">
                        <p className="text-indigo-300 text-sm mb-3">Where are you serving today?</p>
                        <div className="grid grid-cols-2 gap-2">
                          {rooms.map(room => (
                            <button
                              key={room.id}
                              onClick={() => setRoom(volunteer.id, room.id)}
                              className={`px-4 py-3 rounded-lg text-left transition-all ${
                                childRooms[volunteer.id] === room.id
                                  ? 'bg-indigo-500 text-white'
                                  : 'bg-white/10 text-white/80 hover:bg-white/20'
                              }`}
                            >
                              <p className="font-semibold text-sm">{room.name}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <button 
          onClick={handleCheckIn}
          disabled={selectedChildren.length === 0}
          className={`w-full mt-8 py-5 rounded-2xl text-xl font-bold transition-all duration-300 ${
            selectedChildren.length > 0
              ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-xl shadow-green-500/30 hover:shadow-green-500/50 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          }`}
        >
          {selectedChildren.length === 0 
            ? 'Select Who\'s Checking In' 
            : `Check In ${selectedChildren.length} ${selectedChildren.length === 1 ? 'Person' : 'People'}`}
        </button>
      </div>
    </div>
  );
};

// Celebration Screen
const CelebrationScreen = ({ children, family, onDone, activeTemplate }) => {
  const [showConfetti, setShowConfetti] = useState(true);
  const [printStatus, setPrintStatus] = useState('printing');
  const [earnedRewards, setEarnedRewards] = useState([]);
  const hasProcessedRef = useRef(false); // Prevent double-processing
  const [pickupCodes] = useState(() => 
    children.map(child => ({
      ...child,
      pickupCode: Math.random().toString(36).substring(2, 6).toUpperCase()
    }))
  );
  
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Prevent double-processing (React strict mode, etc.)
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    
    const processCheckins = async () => {
      try {
        const allEarnedRewards = [];
        
        // Process check-ins and collect earned rewards
        for (const child of pickupCodes) {
          const response = await fetch(`${API_BASE}/api/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({
              childId: child.id,
              familyId: family.id,
              room: child.room,
              pickupCode: child.pickupCode,
              templateId: activeTemplate?.id || null
            })
          });
          
          const data = await response.json();
          
          // Collect earned rewards with child info
          if (data.earnedRewards && data.earnedRewards.length > 0) {
            data.earnedRewards.forEach(reward => {
              allEarnedRewards.push({
                ...reward,
                childName: child.name,
                childAvatar: child.avatar
              });
            });
          }
        }
        
        setEarnedRewards(allEarnedRewards);

        // Print via local print helper (generates graphical PNG labels, prints via lp/PowerShell)
        {
          try {
            const helperStatus = await isPrintHelperRunning();
            console.log('🖨️ Print helper status:', helperStatus);
            
            if (helperStatus.running) {
              // Print via local print helper
              const kidsToPrint = pickupCodes.filter(c => !c.isVolunteer);
              const volunteersToPrint = pickupCodes.filter(c => c.isVolunteer);
              
              // Print child labels (one per child)
              for (const child of kidsToPrint) {
                console.log(`📄 Printing child label for: ${child.name}`);
                await printViaHelper({
                  type: 'child',
                  childName: child.name || child.firstName,
                  pickupCode: child.pickupCode,
                  room: child.room || 'Room 101',
                  parentName: family.parent_name || family.parentName || family.name,
                  parentPhone: family.phone || '',
                  gender: child.gender || '',
                  streak: child.streak || 0,
                  badges: child.badges || 0,
                  rank: child.rank || 1,
                  allergies: child.allergies || '',
                  tier: child.tier || null,
                  isNewBadge: child.isNewBadge || false,
                  badgeName: child.badgeName || null
                });
              }
              
              // Print volunteer badges
              for (const volunteer of volunteersToPrint) {
                await printViaHelper({
                  type: 'volunteer',
                  childName: volunteer.name || volunteer.firstName,
                  room: volunteer.room || 'Children\'s Ministry',
                  serviceArea: volunteer.volunteerDetails?.serviceArea || ''
                });
              }
              
              // Print ONE parent receipt for all kids
              if (kidsToPrint.length > 0) {
                await printViaHelper({
                  type: 'parent',
                  familyName: family.parent_name || family.parentName || family.name,
                  children: kidsToPrint.map(c => ({
                    name: c.name || c.firstName,
                    pickupCode: c.pickupCode,
                    room: c.room || 'Room 101'
                  }))
                });
              }
              
              // Print reward certificates
              for (const reward of allEarnedRewards) {
                await printViaHelper({
                  type: 'reward',
                  childName: reward.childName,
                  rewardName: reward.name,
                  rewardIcon: reward.icon || '🏆'
                });
              }
              
              console.log('✅ Print helper printing complete');
            } else {
              console.log('⚠️ No print service available (Dymo Connect or Print Helper)');
            }
          } catch (printErr) {
            console.log('❌ Print helper error:', printErr.message);
          }
        }

        // Legacy server-side printing fallback (for old setups)
        if (false) {
          // Get label settings from active template
          const labelSettings = activeTemplate?.label_settings || {};
          const kidLabelSettings = labelSettings.kidLabel || {};
          const parentLabelSettings = labelSettings.parentLabel || {};
          const volunteerLabelSettings = labelSettings.volunteerLabel || {};
          
          // Separate kids from volunteers
          const kidsToPrint = pickupCodes.filter(c => !c.isVolunteer);
          const volunteersToPrint = pickupCodes.filter(c => c.isVolunteer);
          
          // Print child labels via server (if enabled)
          if (kidLabelSettings.enabled !== false) {
            for (const child of kidsToPrint) {
              await fetch(`${API_BASE}/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  childName: child.name,
                  avatar: child.avatar,
                  pickupCode: child.pickupCode,
                  room: child.room || 'Room 101',
                  streak: (child.streak || 0) + 1,
                  rank: 1,
                  badges: child.badges || 0,
                  tier: (child.streak || 0) >= 11 ? 'gold' : (child.streak || 0) >= 7 ? 'silver' : (child.streak || 0) >= 3 ? 'bronze' : null,
                  isNewBadge: ((child.streak || 0) + 1) === 4 || ((child.streak || 0) + 1) === 8 || ((child.streak || 0) + 1) === 12,
                  badgeName: ((child.streak || 0) + 1) === 4 ? 'Bronze Champion' : ((child.streak || 0) + 1) === 8 ? 'Silver Star' : ((child.streak || 0) + 1) === 12 ? 'Gold Legend' : null,
                  // Pass label settings
                  ...kidLabelSettings
                })
              });
            }
          }
          
          // Print volunteer badges via server (if enabled in template)
          const shouldPrintVolunteerBadges = activeTemplate?.print_volunteer_badges !== false && volunteerLabelSettings.enabled !== false;
          if (shouldPrintVolunteerBadges) {
            for (const volunteer of volunteersToPrint) {
              await fetch(`${API_BASE}/print-volunteer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  volunteerName: volunteer.name,
                  serviceArea: volunteer.room || '',
                  date: new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                  }),
                  // Pass label settings
                  ...volunteerLabelSettings
                })
              });
            }
          } else {
            console.log('Volunteer badge printing disabled for this template');
          }
          
          // Print parent receipt via server (only if there are kids and enabled)
          if (kidsToPrint.length > 0 && parentLabelSettings.enabled !== false) {
            await fetch(`${API_BASE}/print-parent`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                familyName: family.name,
                children: kidsToPrint.map(c => ({ name: c.name, pickupCode: c.pickupCode, room: c.room || 'Room 101' })),
                // Pass label settings
                ...parentLabelSettings
              })
            });
          }
          
          // Print reward certificates for each earned reward via server
          for (const reward of allEarnedRewards) {
            await fetch(`${API_BASE}/print-reward`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                childName: reward.childName,
                avatar: reward.childAvatar,
                rewardName: reward.name,
                rewardIcon: reward.icon,
                prize: reward.prize
              })
            });
          }
        }
        
        setPrintStatus('success');
      } catch (err) {
        console.error('Check-in error:', err);
        setPrintStatus('error');
      }
    };
    
    processCheckins();
  }, [pickupCodes, family]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {showConfetti && <Confetti />}
      <FloatingParticles />
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow-500/20 rounded-full blur-3xl" />
      
      <div className="relative z-10 text-center max-w-2xl w-full">
        <h1 className="text-5xl font-black text-white mb-4 animate-slide-up">
          {pickupCodes.length === 1 ? `Awesome, ${pickupCodes[0].name}!` : 'Everyone\'s Checked In!'} 🎉
        </h1>
        
        <p className="text-2xl text-indigo-200 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {pickupCodes.length === 1 ? 'You\'re ready to go!' : `${pickupCodes.length} kids checked in and ready!`}
        </p>
        
        <div className="grid gap-4 mb-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {pickupCodes.map((child) => {
            const newStreak = (child.streak || 0) + 1;
            return (
              <div key={child.id} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 flex items-center gap-4">
                <img 
                  src={getAvatarUrl(child.gender)} 
                  alt={child.name}
                  className="w-24 h-24 flex-shrink-0"
                />
                <div className="flex-1 text-left">
                  <h3 className="text-xl font-bold text-white">{child.name}</h3>
                  <div className="flex gap-4 text-sm">
                    <span className="text-orange-400">🔥 {newStreak} weeks</span>
                    <span className="text-emerald-400">{child.badges || 0} badges</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-indigo-300 text-xs">PICKUP CODE</p>
                  <p className="text-2xl font-mono font-bold text-white">{child.pickupCode}</p>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Earned Rewards Display */}
        {earnedRewards.length > 0 && (
          <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.25s' }}>
            <div className="bg-gradient-to-r from-yellow-500/30 to-orange-500/30 backdrop-blur-sm rounded-2xl p-6 border-2 border-yellow-400/50">
              <h2 className="text-2xl font-bold text-yellow-300 mb-4 flex items-center justify-center gap-2">
                <span className="text-3xl">🎁</span> Reward{earnedRewards.length > 1 ? 's' : ''} Earned!
              </h2>
              <div className="space-y-3">
                {earnedRewards.map((reward, index) => (
                  <div key={index} className="bg-white/20 rounded-xl p-4 flex items-center gap-4">
                    <span className="text-4xl">{reward.icon}</span>
                    <div className="flex-1 text-left">
                      <p className="text-white font-bold">{reward.childName} earned:</p>
                      <p className="text-yellow-200 text-lg font-semibold">{reward.name}</p>
                      <p className="text-yellow-100/80 text-sm">Prize: {reward.prize}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-yellow-200/80 text-sm mt-4">
                🎫 Reward ticket printing - show to a volunteer!
              </p>
            </div>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/20 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <p className="text-indigo-200 text-lg">
            {printStatus === 'printing' && '🖨️ Printing labels...'}
            {printStatus === 'success' && earnedRewards.length > 0 
              ? '✅ Labels & reward tickets printed!' 
              : '✅ Labels printed! Grab your tags.'}
            {printStatus === 'error' && '⚠️ Print error - please see a volunteer'}
          </p>
        </div>
        
        <button
          onClick={onDone}
          className="px-16 py-5 rounded-2xl bg-gradient-to-r from-green-400 to-emerald-500 text-white text-xl font-bold shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all hover:scale-[1.02] active:scale-[0.98] animate-slide-up"
          style={{ animationDelay: '0.4s' }}
        >
          All Done! ✓
        </button>
      </div>
    </div>
  );
};

// Volunteer Celebration Screen
const VolunteerCelebrationScreen = ({ volunteer, family, onDone, activeTemplate }) => {
  const [showConfetti, setShowConfetti] = useState(true);
  const [printStatus, setPrintStatus] = useState('printing');
  const hasProcessedRef = useRef(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    
    const processVolunteerCheckin = async () => {
      try {
        // Record the check-in
        await fetch(`${API_BASE}/api/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            childId: volunteer.id,
            familyId: family.id,
            room: volunteer.room || 'Main Area',
            pickupCode: 'VOL',
            templateId: activeTemplate?.id || null
          })
        });

        // Print volunteer badge (if enabled in template)
        const labelSettings = activeTemplate?.label_settings || {};
        const volunteerLabelSettings = labelSettings.volunteerLabel || {};
        const shouldPrintBadge = activeTemplate?.print_volunteer_badges !== false && volunteerLabelSettings.enabled !== false;
        
        if (shouldPrintBadge) {
          await fetch(`${API_BASE}/print-volunteer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              volunteerName: `${volunteer.firstName} ${volunteer.lastName}`,
              serviceArea: volunteer.volunteerDetails?.serviceArea || volunteer.room || '',
              date: new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              }),
              // Pass label settings
              ...volunteerLabelSettings
            })
          });
        } else {
          console.log('Volunteer badge printing disabled for this template');
        }
        
        setPrintStatus('done');
      } catch (err) {
        console.error('Volunteer check-in error:', err);
        setPrintStatus('error');
      }
    };
    
    processVolunteerCheckin();
  }, [volunteer, family, activeTemplate]);

  // Auto-redirect after 8 seconds
  useEffect(() => {
    const timer = setTimeout(onDone, 8000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                animation: `confetti-fall ${2 + Math.random() * 3}s linear forwards`,
                animationDelay: `${Math.random() * 2}s`
              }}
            >
              {['⭐', '🌟', '✨', '💜', '💙'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}
      
      <FloatingParticles />
      
      <div className="relative z-10 text-center max-w-lg">
        {/* Big Thank You */}
        <div className="mb-8">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl mb-6">
            <span className="text-6xl">🙏</span>
          </div>
          
          <h1 className="text-5xl font-black text-white mb-4">
            Thank You, {volunteer.firstName}!
          </h1>
          <p className="text-2xl text-indigo-200">
            You're making a difference! 💜
          </p>
        </div>
        
        {/* Service Info */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/20">
          <p className="text-indigo-200 mb-2">Serving in</p>
          <p className="text-3xl font-bold text-white">
            {volunteer.room || volunteer.volunteerDetails?.serviceArea || 'Main Area'}
          </p>
          <p className="text-indigo-300 mt-4">
            Total shifts served: <span className="text-emerald-400 font-bold">{(volunteer.totalCheckins || 0) + 1}</span>
          </p>
        </div>
        
        {/* Print Status */}
        <div className="mb-8">
          {printStatus === 'printing' && (
            <div className="flex items-center justify-center gap-3 text-indigo-200">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <span>Printing your volunteer badge...</span>
            </div>
          )}
          {printStatus === 'done' && (
            <div className="flex items-center justify-center gap-3 text-emerald-400">
              <span className="text-2xl">✓</span>
              <span>Badge printed! Please pick it up.</span>
            </div>
          )}
          {printStatus === 'error' && (
            <div className="text-amber-400">
              Could not print badge. Please see a coordinator.
            </div>
          )}
        </div>
        
        {/* Done Button */}
        <button
          onClick={onDone}
          className="px-12 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xl font-bold shadow-xl hover:shadow-indigo-500/50 transition-all hover:scale-105"
        >
          Done ✓
        </button>
        
        <p className="text-indigo-300/50 text-sm mt-4">
          Screen will auto-reset in a few seconds
        </p>
      </div>
    </div>
  );
};

// Main App
export default function App() {
  const [isSetup, setIsSetup] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [orgName, setOrgName] = useState('');
  const [printHelperOk, setPrintHelperOk] = useState(false);
  const [screen, setScreen] = useState('welcome');
  const [selectedChildren, setSelectedChildren] = useState([]);
  const [enteredPhone, setEnteredPhone] = useState('');
  const [family, setFamily] = useState(null);
  const [kidData, setKidData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [allTemplates, setAllTemplates] = useState([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('kioskToken');
      if (token) {
        try {
          const response = await fetch(`${API_BASE}/api/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            setIsSetup(true);
            setOrgName(localStorage.getItem('kioskOrgName') || '');
          } else {
            localStorage.removeItem('kioskToken');
            localStorage.removeItem('kioskOrgName');
          }
        } catch (err) {
          // If we can't reach the server, still allow if we have a token
          // (offline mode)
          setIsSetup(true);
          setOrgName(localStorage.getItem('kioskOrgName') || '');
        }
      }
      setCheckingSession(false);
    };
    checkSession();

    // Check print helper periodically
    const checkPrinter = async () => {
      try {
        const status = await isPrintHelperRunning();
        setPrintHelperOk(status.running);
      } catch (e) {
        setPrintHelperOk(false);
      }
    };
    checkPrinter();
    const interval = setInterval(checkPrinter, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSetupComplete = (data) => {
    setIsSetup(true);
    setOrgName(data.orgName || '');
  };

  const handleLogoutKiosk = () => {
    localStorage.removeItem('kioskToken');
    localStorage.removeItem('kioskOrgName');
    localStorage.removeItem('kioskOrgId');
    setIsSetup(false);
  };
  
  // Fetch active template and all templates on mount
  useEffect(() => {
    if (!isSetup) return;
    const fetchTemplates = async () => {
      try {
        // Fetch active template
        const activeResponse = await fetch(`${API_BASE}/api/templates/active`, {
          headers: getAuthHeaders()
        });
        if (activeResponse.ok) {
          const template = await activeResponse.json();
          setActiveTemplate(template);
        }
        
        // Fetch all templates for the selector
        const allResponse = await fetch(`${API_BASE}/api/templates`, {
          headers: getAuthHeaders()
        });
        if (allResponse.ok) {
          const templates = await allResponse.json();
          setAllTemplates(templates);
        }
      } catch (err) {
        console.error('Error fetching templates:', err);
      }
    };
    fetchTemplates();
  }, [isSetup]);
  
  // Handle manual template selection
  const handleSelectTemplate = (template) => {
    if (template) {
      setActiveTemplate({
        ...template,
        room_ids: template.room_ids || [],
        checkout_enabled: Boolean(template.checkout_enabled),
        is_active: true,
        track_streaks: template.track_streaks !== false,
        streak_reset_days: template.streak_reset_days || 7,
        print_volunteer_badges: template.print_volunteer_badges !== false,
        label_settings: template.label_settings || null
      });
    } else {
      setActiveTemplate(null);
    }
    setShowTemplateSelector(false);
  };
  
  const handleFamilyLogin = () => setScreen('phone');
  const handleKidLogin = () => setScreen('kidpin');
  
  const handlePhoneSubmit = async (phone) => {
    setEnteredPhone(phone);
    setLoading(true);
    
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const response = await fetch(`${API_BASE}/api/family/${cleanPhone}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const familyData = await response.json();
        setFamily(familyData);
        setScreen('select');
      } else {
        setScreen('notfound');
      }
    } catch (err) {
      console.error('Error looking up family:', err);
      setScreen('notfound');
    } finally {
      setLoading(false);
    }
  };
  
  const handleKidPinSubmit = async (pin) => {
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/api/child/pin/${pin}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if this is a volunteer
        if (data.isVolunteer) {
          setKidData(data);
          setFamily({ id: data.familyId, name: data.familyName });
          setScreen('volunteercheckin');
        } else {
          setKidData(data);
          setFamily({ id: data.familyId, name: data.familyName });
          setScreen('kidcheckin');
        }
      } else {
        // PIN not found - show error briefly then reset
        alert('PIN not found. Please try again or use parent phone number.');
        setScreen('welcome');
      }
    } catch (err) {
      console.error('Error looking up PIN:', err);
      alert('Error looking up PIN. Please try again.');
      setScreen('welcome');
    } finally {
      setLoading(false);
    }
  };
  
  const handleKidCheckIn = (childWithRoom) => {
    setSelectedChildren([childWithRoom]);
    setScreen('celebration');
  };
  
  const handleVolunteerCheckIn = (volunteerWithRoom) => {
    setSelectedChildren([volunteerWithRoom]);
    setScreen('volunteercelebration');
  };
  
  const handleCheckIn = (children) => {
    setSelectedChildren(children);
    setScreen('celebration');
  };
  
  const handleDone = () => {
    setSelectedChildren([]);
    setEnteredPhone('');
    setFamily(null);
    setKidData(null);
    setScreen('welcome');
  };
  
  // Show loading while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Loading...</div>
      </div>
    );
  }

  // Show setup/login screen if not authenticated
  if (!isSetup) {
    return <KioskSetupScreen onSetupComplete={handleSetupComplete} />;
  }

  return (
    <div className="font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        
        @keyframes float-up {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 0.3; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-100vh); opacity: 0; }
        }
        
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes bounce-in {
          0% { transform: scale(0); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        
        @keyframes slide-up {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }
        
        .animate-float-up {
          animation: float-up linear infinite;
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        
        .animate-bounce-in {
          animation: bounce-in 0.6s ease-out forwards;
        }
        
        .animate-slide-up {
          animation: slide-up 0.5s ease-out forwards;
          opacity: 0;
        }
        
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        
        @keyframes accessory-unlock {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes sparkle {
          0%, 100% { transform: scale(0) rotate(0deg); opacity: 0; }
          50% { transform: scale(1.5) rotate(180deg); opacity: 1; }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        
        .animate-accessory-unlock {
          animation: accessory-unlock 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        }
        
        .animate-sparkle {
          animation: sparkle 1.5s ease-in-out infinite;
        }
      `}</style>
      
      {/* Status Bar - Top Left */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-3">
        {/* Print Helper Indicator */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm border ${
          printHelperOk 
            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' 
            : 'bg-amber-500/20 border-amber-500/30 text-amber-300'
        }`}>
          <div className={`w-2 h-2 rounded-full ${printHelperOk ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          {printHelperOk ? '🖨️ Printer Ready' : '⚠️ No Printer'}
        </div>
        {/* Org Name + Logout */}
        {orgName && (
          <button
            onClick={handleLogoutKiosk}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
            title="Disconnect kiosk"
          >
            {orgName} ✕
          </button>
        )}
      </div>

      {/* Template Selector - Top Right Corner */}
      {allTemplates.length > 0 && (
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={() => setShowTemplateSelector(!showTemplateSelector)}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white/80 hover:bg-white/20 transition-colors text-sm"
          >
            <span className="text-base">📋</span>
            <span className="hidden sm:inline">
              {activeTemplate ? activeTemplate.name : 'No Template'}
            </span>
            <svg className={`w-4 h-4 transition-transform ${showTemplateSelector ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showTemplateSelector && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700">
                <p className="text-white font-medium text-sm">Select Event Template</p>
                <p className="text-slate-400 text-xs mt-1">Choose which rooms to use</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {/* No Template Option */}
                <button
                  onClick={() => handleSelectTemplate(null)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors ${
                    !activeTemplate ? 'bg-emerald-900/30 border-l-2 border-emerald-500' : ''
                  }`}
                >
                  <p className="text-white text-sm font-medium">All Rooms</p>
                  <p className="text-slate-400 text-xs">No template - show all rooms</p>
                </button>
                
                {allTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors ${
                      activeTemplate?.id === template.id ? 'bg-emerald-900/30 border-l-2 border-emerald-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-white text-sm font-medium">{template.name}</p>
                      {template.is_active && (
                        <span className="text-xs text-emerald-400">Auto</span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {template.day_of_week && <span className="capitalize">{template.day_of_week}</span>}
                      {template.start_time && <span> • {template.start_time}</span>}
                      {template.end_time && <span> - {template.end_time}</span>}
                      {!template.day_of_week && !template.start_time && 'Manual activation only'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {screen === 'welcome' && <WelcomeScreen onFamilyLogin={handleFamilyLogin} onKidLogin={handleKidLogin} />}
      {screen === 'phone' && <PhoneEntryScreen onSubmit={handlePhoneSubmit} onBack={() => setScreen('welcome')} loading={loading} />}
      {screen === 'kidpin' && <KidPinScreen onSubmit={handleKidPinSubmit} onBack={() => setScreen('welcome')} loading={loading} />}
      {screen === 'kidcheckin' && kidData && <KidCheckinScreen child={kidData} onCheckIn={handleKidCheckIn} onBack={() => setScreen('welcome')} activeTemplate={activeTemplate} />}
      {screen === 'volunteercheckin' && kidData && <VolunteerCheckinScreen volunteer={kidData} onCheckIn={handleVolunteerCheckIn} onBack={() => setScreen('welcome')} activeTemplate={activeTemplate} />}
      {screen === 'notfound' && <NotFoundScreen phone={enteredPhone} onBack={() => setScreen('welcome')} onTryAgain={() => setScreen('phone')} />}
      {screen === 'select' && family && <ChildSelectScreen family={family} onCheckIn={handleCheckIn} onBack={() => setScreen('phone')} activeTemplate={activeTemplate} />}
      {screen === 'celebration' && selectedChildren.length > 0 && (
        <CelebrationScreen 
          children={selectedChildren}
          family={family}
          onDone={handleDone}
          activeTemplate={activeTemplate}
        />
      )}
      {screen === 'volunteercelebration' && selectedChildren.length > 0 && (
        <VolunteerCelebrationScreen 
          volunteer={selectedChildren[0]}
          family={family}
          onDone={handleDone}
          activeTemplate={activeTemplate}
        />
      )}
    </div>
  );
}