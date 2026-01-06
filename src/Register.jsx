import React, { useState } from 'react';

// Use relative URL in production (same origin), localhost in development
const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

// ============================================
// AVATAR SYSTEM - Single explorer character
// ============================================
const AVATAR_STATIC = '/avatars/boy-ranger/boy-test-000.png';
const DEFAULT_AVATAR = 'explorer'; // ID used in database

// Get avatar URL - returns the static PNG for all avatars
const getAvatarUrl = () => AVATAR_STATIC;

export default function Register() {
  const [step, setStep] = useState(1);

  const [family, setFamily] = useState({
    phone: '',
    parentName: '',
    email: '',
    address: '',
    children: [{ firstName: '', lastName: '', birthday: '', gender: '', allergies: '', notes: '', avatar: DEFAULT_AVATAR, pin: '' }]
  });
  
  // Generate PIN from birthday (MMDDYY format)
  const generatePinFromBirthday = (birthday) => {
    if (!birthday) return '';
    // Parse the date string directly to avoid timezone issues
    // birthday format is YYYY-MM-DD from the date input
    const parts = birthday.split('-');
    if (parts.length !== 3) return '';
    const year = parts[0].slice(-2); // Last 2 digits of year
    const month = parts[1];
    const day = parts[2];
    return `${month}${day}${year}`;
  };
  
  // Calculate age from birthday
  const calculateAge = (birthday) => {
    if (!birthday) return '';
    const today = new Date();
    const birth = new Date(birthday);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [phoneExists, setPhoneExists] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);

  const addChild = () => {
    setFamily(prev => ({
      ...prev,
      children: [...prev.children, { firstName: '', lastName: '', birthday: '', gender: '', allergies: '', notes: '', avatar: DEFAULT_AVATAR, pin: '' }]
    }));
  };
  
  // Handle birthday change - auto-calculate age and PIN
  const handleBirthdayChange = (index, birthday) => {
    const age = calculateAge(birthday);
    setFamily(prev => ({
      ...prev,
      children: prev.children.map((child, i) => 
        i === index ? { ...child, birthday, age: age.toString() } : child
      )
    }));
  };

  const removeChild = (index) => {
    if (family.children.length > 1) {
      setFamily(prev => ({
        ...prev,
        children: prev.children.filter((_, i) => i !== index)
      }));
    }
  };

  // Check if phone number already exists in the system
  const checkPhoneExists = async () => {
    if (!family.phone || family.phone.length < 10) {
      return false;
    }
    
    setCheckingPhone(true);
    setPhoneExists(false);
    
    try {
      const response = await fetch(`${API_BASE}/api/family/lookup?phone=${encodeURIComponent(family.phone)}`);
      const data = await response.json();
      
      if (response.ok && data.family) {
        setPhoneExists(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Phone check error:', err);
      return false;
    } finally {
      setCheckingPhone(false);
    }
  };

  // Handle continuing from step 1
  const handleStep1Continue = async () => {
    if (!family.phone || !family.parentName || !family.email) {
      setError('Please fill in all fields');
      return;
    }
    
    const exists = await checkPhoneExists();
    if (!exists) {
      setPhoneExists(false);
      setStep(2);
    }
  };

  const updateChild = (index, field, value) => {
    setFamily(prev => ({
      ...prev,
      children: prev.children.map((child, i) => {
        if (i !== index) return child;
        
        return { ...child, [field]: value };
      })
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Build the family name from parent name
      const nameParts = family.parentName.trim().split(' ');
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
      const familyName = `The ${lastName} Family`;

      const response = await fetch(`${API_BASE}/api/family`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: familyName,
          phone: family.phone,
          email: family.email,
          address: family.address,
          parentName: family.parentName,
          children: family.children.map(c => ({
            firstName: c.firstName,
            lastName: c.lastName,
            age: parseInt(c.age) || 0,
            birthday: c.birthday,
            gender: c.gender,
            pin: c.pin,
            allergies: c.allergies,
            notes: c.notes,
            avatar: c.avatar
          }))
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('Could not connect to server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-emerald-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✓</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">You're All Set!</h1>
          <p className="text-gray-600 mb-6">
            Your family has been registered. Head back to the kiosk and enter your phone number to check in.
          </p>
          <div className="bg-gray-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">Your phone number</p>
            <p className="text-2xl font-bold text-gray-900">{family.phone}</p>
          </div>
          <p className="text-gray-500 text-sm">You can close this page now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-emerald-900 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Adventure Kids</h1>
          <p className="text-emerald-200">Family Registration</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
            step >= 1 ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white/50'
          }`}>1</div>
          <div className={`w-8 h-1 rounded ${step >= 2 ? 'bg-emerald-500' : 'bg-white/20'}`} />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
            step >= 2 ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white/50'
          }`}>2</div>
          <div className={`w-8 h-1 rounded ${step >= 3 ? 'bg-emerald-500' : 'bg-white/20'}`} />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
            step >= 3 ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white/50'
          }`}>3</div>
          <div className={`w-8 h-1 rounded ${step >= 4 ? 'bg-emerald-500' : 'bg-white/20'}`} />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
            step >= 4 ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white/50'
          }`}>4</div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Parent Info */}
          {step === 1 && (
            <div className="bg-white rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Parent/Guardian Info</h2>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* Phone Already Exists Message */}
              {phoneExists && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 mb-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">👋</span>
                    <div>
                      <p className="font-semibold text-amber-800 mb-1">Welcome back!</p>
                      <p className="text-amber-700 text-sm mb-3">
                        This phone number is already registered. You can check in your kids at the kiosk!
                      </p>
                      <a
                        href="/"
                        className="inline-block px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors text-sm"
                      >
                        Go to Check-In →
                      </a>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={family.phone}
                    onChange={(e) => {
                      setFamily(prev => ({ ...prev, phone: e.target.value }));
                      setPhoneExists(false); // Reset when phone changes
                      setError('');
                    }}
                    placeholder="(555) 123-4567"
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg ${
                      phoneExists ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                    }`}
                    required
                    autoComplete="tel"
                  />
                  <p className="text-gray-500 text-sm mt-1">This will be used for check-in</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Parent/Guardian Name</label>
                  <input
                    type="text"
                    value={family.parentName}
                    onChange={(e) => setFamily(prev => ({ ...prev, parentName: e.target.value }))}
                    placeholder="Full Name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg"
                    required
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={family.email}
                    onChange={(e) => setFamily(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg"
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mailing Address <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={family.address || ''}
                    onChange={(e) => setFamily(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="123 Main Street&#10;City, State ZIP"
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg resize-none"
                    autoComplete="street-address"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleStep1Continue}
                disabled={checkingPhone}
                className="w-full mt-6 py-4 bg-emerald-500 text-white rounded-xl font-bold text-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {checkingPhone ? 'Checking...' : 'Continue'}
              </button>
            </div>
          )}

          {/* Step 2: Children Info */}
          {step === 2 && (
            <div className="bg-white rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Children</h2>
              
              <div className="space-y-6">
                {family.children.map((child, index) => (
                  <div key={index} className="bg-gray-50 rounded-xl p-4 relative">
                    {family.children.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeChild(index)}
                        className="absolute top-2 right-2 w-8 h-8 bg-red-100 text-red-500 rounded-full flex items-center justify-center hover:bg-red-200"
                      >
                        ×
                      </button>
                    )}
                    
                    <p className="text-sm font-medium text-emerald-600 mb-3">Child {index + 1}</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">First Name</label>
                        <input
                          type="text"
                          value={child.firstName}
                          onChange={(e) => updateChild(index, 'firstName', e.target.value)}
                          placeholder="First name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Last Name</label>
                        <input
                          type="text"
                          value={child.lastName}
                          onChange={(e) => updateChild(index, 'lastName', e.target.value)}
                          placeholder="Last name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Birthday</label>
                        <input
                          type="date"
                          value={child.birthday}
                          onChange={(e) => handleBirthdayChange(index, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Gender</label>
                        <select
                          value={child.gender}
                          onChange={(e) => updateChild(index, 'gender', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        >
                          <option value="">Select</option>
                          <option value="male">Boy</option>
                          <option value="female">Girl</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Allergies</label>
                        <input
                          type="text"
                          value={child.allergies}
                          onChange={(e) => updateChild(index, 'allergies', e.target.value)}
                          placeholder="None"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-sm text-gray-600 mb-1">Special Notes</label>
                        <input
                          type="text"
                          value={child.notes}
                          onChange={(e) => updateChild(index, 'notes', e.target.value)}
                          placeholder="Any special needs or notes"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      
                      {/* Kid PIN Section */}
                      <div className="col-span-2 mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <label className="block text-sm font-medium text-emerald-700 mb-1">
                          🔐 Kid's Personal PIN
                        </label>
                        <p className="text-xs text-emerald-600 mb-2">
                          Your child can use this 6-digit PIN to check in themselves! We recommend using their birthday (MMDDYY).
                        </p>
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            value={child.pin}
                            onChange={(e) => updateChild(index, 'pin', e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="MMDDYY"
                            maxLength={6}
                            className="flex-1 px-3 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-lg tracking-widest"
                          />
                          {child.birthday && (
                            <button
                              type="button"
                              onClick={() => updateChild(index, 'pin', generatePinFromBirthday(child.birthday))}
                              className="text-xs text-emerald-600 hover:text-emerald-700 underline"
                            >
                              Use birthday (MMDDYY)
                            </button>
                          )}
                        </div>
                        {child.pin && child.pin.length === 6 && (
                          <p className="text-xs text-emerald-600 mt-1">
                            ✓ PIN set: <span className="font-mono font-bold">{child.pin}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addChild}
                className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl hover:border-emerald-500 hover:text-emerald-500 transition-colors"
              >
                + Add Another Child
              </button>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Avatar Preview (single avatar for now) */}
          {step === 3 && (
            <div className="bg-white rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Meet Your Adventure Guide!</h2>
              
              <div className="flex flex-col items-center mb-8">
                <img 
                  src={getAvatarUrl()} 
                  alt="Adventure Kid Avatar"
                  className="w-40 h-40 mb-4"
                />
                <p className="text-gray-600 text-center max-w-sm">
                  This friendly explorer will be your kids' check-in buddy! 
                  More character options coming soon! 🌟
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {family.children.map((child, childIndex) => (
                  <div key={childIndex} className="flex items-center gap-4 bg-gray-50 rounded-xl p-4">
                    <img 
                      src={getAvatarUrl()} 
                      alt={`${child.firstName}'s avatar`}
                      className="w-16 h-16 rounded-lg"
                    />
                    <div>
                      <h3 className="font-bold text-gray-900">{child.firstName} {child.lastName}</h3>
                      <p className="text-gray-500 text-sm">🏕️ Adventure Explorer</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="bg-white rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Review & Submit</h2>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Parent/Guardian</p>
                  <p className="font-semibold text-gray-900">{family.parentName}</p>
                  <p className="text-gray-600">{family.phone}</p>
                  <p className="text-gray-600">{family.email}</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-3">Children ({family.children.length})</p>
                  <div className="space-y-3">
                    {family.children.map((child, index) => (
                      <div key={index} className="flex items-center gap-3 bg-white rounded-lg p-3">
                        <img 
                          src={getAvatarUrl()} 
                          alt={child.firstName}
                          className="w-12 h-12 rounded-xl border-2 border-emerald-300"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {child.firstName} {child.lastName}
                          </p>
                          <p className="text-sm text-gray-500">
                            Age {child.age || '?'} • {child.gender === 'male' ? 'Boy' : child.gender === 'female' ? 'Girl' : ''}
                          </p>
                        </div>
                        {child.pin && child.pin.length === 6 && (
                          <div className="text-right">
                            <p className="text-xs text-gray-500">PIN</p>
                            <p className="font-mono font-bold text-emerald-600">{child.pin}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={submitting}
                  className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Complete Registration'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}