import React, { useState, useEffect, useRef } from 'react';
import { isDymoServiceRunning, getDymoPrinters, printCheckInLabels } from './dymoPrint';

// Use relative URL in production (same origin), localhost in development
const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

// ============================================
// AVATAR SYSTEM - Single explorer character
// ============================================
const AVATAR_STATIC = '/avatars/boy-ranger/boy-test-000.png';
const AVATAR_FRAME_COUNT = 115; // Frames 000-114

// Get avatar URL - returns the static PNG for all avatars
const getAvatarUrl = () => AVATAR_STATIC;

// Animated Avatar component - plays PNG sequence
const AnimatedAvatar = ({ className = "w-56 h-56", onAnimationComplete }) => {
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);
  const animationRef = useRef(null);
  
  useEffect(() => {
    // Preload all frames
    const preloadImages = () => {
      for (let i = 0; i < AVATAR_FRAME_COUNT; i++) {
        const img = new Image();
        img.src = `/avatars/boy-ranger/boy-test-${String(i).padStart(3, '0')}.png`;
      }
    };
    preloadImages();
    
    // Animate at ~24fps (approximately matches a 115 frame animation)
    const fps = 24;
    const frameDelay = 1000 / fps;
    
    const animate = () => {
      frameRef.current += 1;
      if (frameRef.current >= AVATAR_FRAME_COUNT) {
        // Animation complete - stay on last frame or loop
        if (onAnimationComplete) {
          onAnimationComplete();
        }
        // Loop the animation
        frameRef.current = 0;
      }
      setFrame(frameRef.current);
      animationRef.current = setTimeout(animate, frameDelay);
    };
    
    animationRef.current = setTimeout(animate, frameDelay);
    
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [onAnimationComplete]);
  
  const frameNumber = String(frame).padStart(3, '0');
  
  return (
    <img 
      src={`/avatars/boy-ranger/boy-test-${frameNumber}.png`}
      alt="Adventure Kid"
      className={className}
    />
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
          <span className="relative z-10">Parent Phone</span>
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
        const roomsResponse = await fetch(`${API_BASE}/api/rooms`);
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
            <AnimatedAvatar className="w-56 h-56 mx-auto drop-shadow-2xl" />
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
        const roomsResponse = await fetch(`${API_BASE}/api/rooms`);
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
        
        <div className="grid gap-4">
          {family.children.map((child, index) => {
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
                      src={getAvatarUrl()} 
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
            ? 'Select Children to Check In' 
            : `Check In ${selectedChildren.length} ${selectedChildren.length === 1 ? 'Child' : 'Children'}`}
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
            headers: { 'Content-Type': 'application/json' },
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

        // Try Dymo browser printing first, fall back to server printing
        let printedViaDymo = false;
        
        try {
          const dymoStatus = await isDymoServiceRunning();
          
          if (dymoStatus.running) {
            // Get available Dymo printers
            const printers = await getDymoPrinters();
            
            if (printers.length > 0) {
              const printerName = printers[0].name; // Use first available printer
              console.log(`🖨️ Printing via Dymo to: ${printerName}`);
              
              // Print labels for each child via Dymo
              for (const child of pickupCodes) {
                await printCheckInLabels(printerName, {
                  childName: child.name,
                  pickupCode: child.pickupCode,
                  room: child.room || 'Room 101',
                  parentName: family.parent_name || family.parentName,
                  parentPhone: family.phone,
                  allergies: child.allergies,
                  date: new Date().toLocaleDateString(),
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
              }
              
              printedViaDymo = true;
              console.log('✅ Dymo printing complete');
            }
          }
        } catch (dymoErr) {
          console.log('Dymo printing not available, falling back to server:', dymoErr.message);
        }
        
        // Fall back to server-side printing if Dymo not available
        if (!printedViaDymo) {
          // Print child labels via server
          for (const child of pickupCodes) {
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
                badgeName: ((child.streak || 0) + 1) === 4 ? 'Bronze Champion' : ((child.streak || 0) + 1) === 8 ? 'Silver Star' : ((child.streak || 0) + 1) === 12 ? 'Gold Legend' : null
              })
            });
          }
          
          // Print parent receipt via server
          await fetch(`${API_BASE}/print-parent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              familyName: family.name,
              children: pickupCodes.map(c => ({ name: c.name, pickupCode: c.pickupCode, room: c.room || 'Room 101' }))
            })
          });
          
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
                  src={getAvatarUrl()} 
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

// Main App
export default function App() {
  const [screen, setScreen] = useState('welcome');
  const [selectedChildren, setSelectedChildren] = useState([]);
  const [enteredPhone, setEnteredPhone] = useState('');
  const [family, setFamily] = useState(null);
  const [kidData, setKidData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null);
  
  // Fetch active template on mount
  useEffect(() => {
    const fetchActiveTemplate = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/templates/active`);
        if (response.ok) {
          const template = await response.json();
          setActiveTemplate(template);
        }
      } catch (err) {
        console.error('Error fetching active template:', err);
      }
    };
    fetchActiveTemplate();
  }, []);
  
  const handleFamilyLogin = () => setScreen('phone');
  const handleKidLogin = () => setScreen('kidpin');
  
  const handlePhoneSubmit = async (phone) => {
    setEnteredPhone(phone);
    setLoading(true);
    
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const response = await fetch(`${API_BASE}/api/family/${cleanPhone}`);
      
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
      const response = await fetch(`${API_BASE}/api/child/pin/${pin}`);
      
      if (response.ok) {
        const childData = await response.json();
        setKidData(childData);
        setFamily({ id: childData.familyId, name: childData.familyName });
        setScreen('kidcheckin');
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
      
      {screen === 'welcome' && <WelcomeScreen onFamilyLogin={handleFamilyLogin} onKidLogin={handleKidLogin} />}
      {screen === 'phone' && <PhoneEntryScreen onSubmit={handlePhoneSubmit} onBack={() => setScreen('welcome')} loading={loading} />}
      {screen === 'kidpin' && <KidPinScreen onSubmit={handleKidPinSubmit} onBack={() => setScreen('welcome')} loading={loading} />}
      {screen === 'kidcheckin' && kidData && <KidCheckinScreen child={kidData} onCheckIn={handleKidCheckIn} onBack={() => setScreen('welcome')} activeTemplate={activeTemplate} />}
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
    </div>
  );
}