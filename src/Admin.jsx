import React, { useState, useEffect } from 'react';

// Use relative URL in production (same origin), localhost in development
const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3001';

// ============================================
// AVATAR SYSTEM - Single explorer character
// ============================================
const AVATAR_STATIC = '/avatars/boy-ranger/boy-test-000.png';
const DEFAULT_AVATAR = 'explorer';

// Get avatar URL - returns the static PNG for all avatars
const getAvatarUrl = () => AVATAR_STATIC;

// Calculate age from birthday
const calculateAge = (birthday) => {
  if (!birthday) return null;
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// ============================================
// LOGIN SCREEN
// ============================================

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
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
        localStorage.setItem('adminToken', data.token);
        onLogin(data.token);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Adventure Kids</h1>
          <p className="text-slate-400">Admin Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign In</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3 mb-6 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-slate-300 mb-2 text-sm">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="admin"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-slate-300 mb-2 text-sm">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <a href="/" className="block text-center mt-6 text-slate-400 hover:text-white transition-colors text-sm">
            ← Back to Kiosk
          </a>
        </form>
      </div>
    </div>
  );
}

// ============================================
// SIDEBAR
// ============================================

function Sidebar({ activeTab, setActiveTab, logo, onLogout }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'families', label: 'Families', icon: '👨‍👩‍👧‍👦' },
    { id: 'volunteers', label: 'Volunteers', icon: '🙋' },
    { id: 'rewards', label: 'Rewards', icon: '🎁' },
    { id: 'attendance', label: 'Attendance', icon: '📅' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="w-64 bg-slate-900 min-h-screen p-6 flex flex-col">
      <div className="mb-8">
        {logo ? (
          <img src={logo} alt="Logo" className="h-16 mx-auto" />
        ) : (
          <h1 className="text-xl font-bold text-white text-center">Adventure Kids</h1>
        )}
        <p className="text-slate-400 text-sm text-center mt-2">Admin Dashboard</p>
      </div>
      
      <nav className="flex-1">
        {tabs.map((tab) => (
            <button
              key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-500 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
        ))}
      </nav>
      
      <div className="space-y-2">
      <a
        href="/"
        className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white transition-colors"
      >
        <span>🖥️</span>
        <span>Back to Kiosk</span>
      </a>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 transition-colors"
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

// ============================================
// DASHBOARD TAB
// ============================================

function DashboardTab({ token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
    const [roomFilter, setRoomFilter] = useState('all');
    
    const rooms = [
      { id: 'all', name: 'All Rooms' },
      { id: 'room100', name: 'Room 100' },
      { id: 'room101', name: 'Room 101' },
      { id: 'room102', name: 'Room 102' },
      { id: 'room103', name: 'Room 103' },
    ];
  
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Failed to load dashboard data</div>
      </div>
    );
  }

  // Filter attendance by room (simplified - would need backend support for real filtering)
  const getFilteredAttendance = () => {
    if (!stats.attendance) return [];
    if (roomFilter === 'all') return stats.attendance;
    
      const roomMultipliers = {
        'room100': 0.15,
        'room101': 0.25,
        'room102': 0.30,
        'room103': 0.30
      };
    return stats.attendance.map(a => ({
      ...a,
      count: Math.round(a.count * (roomMultipliers[roomFilter] || 0.25))
    }));
    };
    
    const filteredAttendance = getFilteredAttendance();
  
    return (
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>
        
      {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-400 text-sm mb-2">Total Families</p>
          <p className="text-3xl font-bold text-white">{stats.totalFamilies}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-400 text-sm mb-2">Total Kids</p>
          <p className="text-3xl font-bold text-white">{stats.totalKids}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p className="text-slate-400 text-sm mb-2">Total Check-ins</p>
          <p className="text-3xl font-bold text-emerald-400">{stats.totalCheckins}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <p className="text-slate-400 text-sm mb-2">Avg per Sunday</p>
          <p className="text-3xl font-bold text-white">
            {stats.attendance?.length > 0 
              ? Math.round(stats.attendance.reduce((s, a) => s + a.count, 0) / stats.attendance.length)
              : 0}
          </p>
          </div>
        </div>
  
      {/* Attendance Chart */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Attendance</h3>
            <div className="flex gap-2">
            {rooms.map((room) => (
                  <button
                    key={room.id}
                onClick={() => setRoomFilter(room.id)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  roomFilter === room.id
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                  >
                    {room.name}
                  </button>
            ))}
            </div>
          </div>
          <div className="flex items-end gap-4" style={{ height: '200px' }}>
          {filteredAttendance.length > 0 ? (
            filteredAttendance.slice(0, 8).map((week, i) => {
              const maxCount = roomFilter === 'all' ? 60 : 20;
              const heightPx = Math.round((week.count / maxCount) * 150);
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div 
                    className="w-full bg-emerald-500 rounded-t-lg transition-all hover:bg-emerald-400"
                    style={{ height: `${Math.max(heightPx, 4)}px` }}
                  />
                  <p className="text-slate-400 text-xs mt-2">{week.date?.slice(5) || '-'}</p>
                  <p className="text-white text-sm font-semibold">{week.count}</p>
                </div>
              );
            })
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              No attendance data yet
            </div>
          )}
          </div>
        </div>
  
      {/* Top Streaks */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">🔥 Top Streaks</h3>
          <div className="space-y-3">
          {stats.topStreaks?.length > 0 ? (
            stats.topStreaks.map((kid, i) => (
                <div key={kid.id} className="flex items-center gap-4 bg-slate-700/50 rounded-lg p-3">
                  <span className="text-2xl font-bold text-slate-500 w-8">#{i + 1}</span>
                <img 
                  src={getAvatarUrl()} 
                  alt={kid.name}
                  className="w-10 h-10 rounded-full bg-slate-600"
                />
                  <div className="flex-1">
                    <p className="text-white font-semibold">{kid.name}</p>
                    <p className="text-slate-400 text-sm">{kid.familyName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-orange-400 font-bold">{kid.streak} weeks</p>
                    <p className="text-slate-400 text-sm">{kid.badges} badges</p>
                  </div>
                </div>
            ))
          ) : (
            <div className="text-slate-400 text-center py-4">No streaks yet - check in some kids!</div>
          )}
          </div>
        </div>
      </div>
    );
  }

// ============================================
// FAMILIES TAB
// ============================================

function FamiliesTab({ token }) {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit modes
  const [editingFamily, setEditingFamily] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [addingChild, setAddingChild] = useState(false);
  const [showAddFamilyModal, setShowAddFamilyModal] = useState(false);
  
  // Form states
  const [familyForm, setFamilyForm] = useState({ name: '', phone: '', email: '', parentName: '' });
  const [childForm, setChildForm] = useState({
    first_name: '', last_name: '', birthday: '', gender: '', pin: '', avatar: 'felix', allergies: '', notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Pending rewards state (admin-assigned rewards for next check-in)
  const [pendingRewards, setPendingRewards] = useState([]);
  const [showAddRewardModal, setShowAddRewardModal] = useState(false);
  const [newReward, setNewReward] = useState({
    reward_type: 'custom',
    custom_name: '',
    custom_description: '',
    custom_icon: '🎁'
  });

  // Generate PIN from birthday (MMDDYY format)
  const generatePinFromBirthday = (birthday) => {
    if (!birthday) return '';
    const date = new Date(birthday);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}${day}${year}`;
  };

  useEffect(() => {
    fetchFamilies();
  }, []);

  // Fetch pending rewards when editing a child
  const fetchPendingRewards = async (childId) => {
    try {
      const response = await fetch(`${API_BASE}/api/child/${childId}/pending-rewards`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPendingRewards(data);
      }
    } catch (err) {
      console.error('Error fetching pending rewards:', err);
    }
  };

  const handleAddPendingReward = async (childId) => {
    if (!childId) {
      console.error('No childId provided to handleAddPendingReward');
      return;
    }
    
    if (!newReward.custom_name) {
      alert('Please enter a reward name');
      return;
    }
    
    try {
      const rewardData = {
        reward_type: 'custom',
        custom_name: newReward.custom_name,
        custom_description: newReward.custom_description,
        custom_icon: newReward.custom_icon,
        assigned_by: 'Admin'
      };
      
      console.log('Adding pending reward:', { childId, rewardData });
      
      const response = await fetch(`${API_BASE}/api/child/${childId}/pending-rewards`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(rewardData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('Reward added successfully:', data);
        await fetchPendingRewards(childId);
        setShowAddRewardModal(false);
        setNewReward({
          reward_type: 'custom',
          custom_name: '',
          custom_description: '',
          custom_icon: '🎁'
        });
      } else {
        console.error('Failed to add reward:', data);
        alert(`Failed to add reward: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error adding pending reward:', err);
      alert(`Error adding reward: ${err.message}`);
    }
  };

  const handleRemovePendingReward = async (childId, rewardId) => {
    try {
      await fetch(`${API_BASE}/api/child/${childId}/pending-rewards/${rewardId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchPendingRewards(childId);
    } catch (err) {
      console.error('Error removing pending reward:', err);
    }
  };

  const fetchFamilies = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/families`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setFamilies(data);
    } catch (err) {
      console.error('Error fetching families:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFamily = async (familyId) => {
    if (!confirm('Are you sure you want to delete this family? This cannot be undone.')) {
      return;
    }

    try {
      await fetch(`${API_BASE}/api/family/${familyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setFamilies(families.filter(f => f.id !== familyId));
      setSelectedFamily(null);
    } catch (err) {
      console.error('Error deleting family:', err);
      alert('Failed to delete family');
    }
  };

  const formatPhone = (phone) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 10) {
      return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    return phone;
  };

  // Family editing
  const handleEditFamily = () => {
    setFamilyForm({
      name: selectedFamily.name || '',
      phone: selectedFamily.phone || '',
      email: selectedFamily.email || '',
      parentName: selectedFamily.parent_name || ''
    });
    setEditingFamily(true);
    setError('');
  };

  const handleSaveFamily = async () => {
    if (!familyForm.name.trim() || !familyForm.phone.trim()) {
      setError('Family name and phone are required');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/family/${selectedFamily.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(familyForm)
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update family');
      }
      
      await fetchFamilies();
      const updatedFamily = families.find(f => f.id === selectedFamily.id);
      setSelectedFamily({ ...selectedFamily, ...familyForm });
      setEditingFamily(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNewFamily = async () => {
    if (!familyForm.name.trim() || !familyForm.phone.trim()) {
      setError('Family name and phone are required');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/family`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: familyForm.name,
          phone: familyForm.phone,
          email: familyForm.email,
          parentName: familyForm.parentName,
          children: []
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create family');
      }
      
      await fetchFamilies();
      setShowAddFamilyModal(false);
      setFamilyForm({ name: '', phone: '', email: '', parentName: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Child editing
  const handleEditChild = (child) => {
    setChildForm({
      first_name: child.first_name || child.name?.split(' ')[0] || '',
      last_name: child.last_name || child.name?.split(' ').slice(1).join(' ') || '',
      birthday: child.birthday || '',
      gender: child.gender || '',
      pin: child.pin || '',
      avatar: child.avatar || 'felix',
      allergies: child.allergies || '',
      notes: child.notes || ''
    });
    setEditingChild(child.id);
    setEditingChildAvatar(null);
    setError('');
    fetchPendingRewards(child.id);
  };

  const handleSaveChild = async () => {
    if (!childForm.first_name.trim()) {
      setError('First name is required');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/child/${editingChild}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(childForm)
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update child');
      }
      
      await fetchFamilies();
      // Update selected family with new data
      const updatedFamilies = await fetch(`${API_BASE}/api/families`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json());
      const updatedFamily = updatedFamilies.find(f => f.id === selectedFamily.id);
      if (updatedFamily) setSelectedFamily(updatedFamily);
      
      setEditingChild(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddChild = () => {
    setChildForm({
      first_name: '', last_name: '', birthday: '', gender: '', pin: '', avatar: 'felix', allergies: '', notes: ''
    });
    setAddingChild(true);
    setError('');
  };

  const handleSaveNewChild = async () => {
    if (!childForm.first_name.trim()) {
      setError('First name is required');
      return;
    }
    
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/family/${selectedFamily.id}/child`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(childForm)
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add child');
      }
      
      await fetchFamilies();
      // Update selected family with new data
      const updatedFamilies = await fetch(`${API_BASE}/api/families`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json());
      const updatedFamily = updatedFamilies.find(f => f.id === selectedFamily.id);
      if (updatedFamily) setSelectedFamily(updatedFamily);
      
      setAddingChild(false);
      setChildForm({ first_name: '', last_name: '', birthday: '', gender: '', pin: '', avatar: 'felix', allergies: '', notes: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChild = async (childId, childName) => {
    if (!confirm(`Are you sure you want to delete ${childName}? This will also delete their check-in history.`)) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/child/${childId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete child');
      }
      
      await fetchFamilies();
      // Update selected family
      const updatedFamilies = await fetch(`${API_BASE}/api/families`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json());
      const updatedFamily = updatedFamilies.find(f => f.id === selectedFamily.id);
      if (updatedFamily) {
        setSelectedFamily(updatedFamily);
      } else {
        // Family was deleted (no more children)
        setSelectedFamily(null);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading families...</div>
      </div>
    );
  }

  // Filter families based on search term
  const filteredFamilies = families.filter(family => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const childNames = family.children?.map(c => c.name?.toLowerCase() || '').join(' ') || '';
    return (
      family.name?.toLowerCase().includes(search) ||
      family.phone?.includes(search) ||
      family.email?.toLowerCase().includes(search) ||
      family.parent_name?.toLowerCase().includes(search) ||
      childNames.includes(search)
    );
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Families</h2>
          <p className="text-slate-400 text-sm">{families.length} families registered</p>
        </div>
        <div className="flex gap-2">
          <a 
            href="/register" 
            target="_blank"
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            Registration Link
          </a>
          <button 
            onClick={() => {
              setFamilyForm({ name: '', phone: '', email: '', parentName: '' });
              setShowAddFamilyModal(true);
              setError('');
            }}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
          + Add Family
        </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="Search families by name, phone, email, or child name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 pl-10 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {filteredFamilies.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-12 border border-slate-700 text-center">
          {searchTerm ? (
            <>
              <p className="text-slate-400 mb-4">No families match "{searchTerm}"</p>
              <button
                onClick={() => setSearchTerm('')}
                className="text-emerald-400 hover:text-emerald-300"
              >
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="text-slate-400 mb-4">No families registered yet</p>
              <a 
                href="/register" 
                target="_blank"
                className="text-emerald-400 hover:text-emerald-300"
              >
                Register your first family →
              </a>
            </>
          )}
        </div>
      ) : (
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {searchTerm && (
          <div className="px-6 py-3 bg-slate-700/50 border-b border-slate-700 text-sm text-slate-400">
            Showing {filteredFamilies.length} of {families.length} families
          </div>
        )}
        <table className="w-full">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left text-slate-300 px-6 py-4 font-semibold">Family Name</th>
              <th className="text-left text-slate-300 px-6 py-4 font-semibold">Phone</th>
              <th className="text-left text-slate-300 px-6 py-4 font-semibold">Children</th>
              <th className="text-left text-slate-300 px-6 py-4 font-semibold">Total Check-ins</th>
              <th className="text-right text-slate-300 px-6 py-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
              {filteredFamilies.map((family) => {
                const familyCheckins = family.children?.reduce((s, c) => s + (c.totalCheckins || 0), 0) || 0;
              return (
                <tr key={family.id} className="border-t border-slate-700 hover:bg-slate-700/50">
                  <td className="px-6 py-4 text-white font-medium">{family.name}</td>
                    <td className="px-6 py-4 text-slate-300">{formatPhone(family.phone)}</td>
                  <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {family.children?.map((child) => (
                          <img 
                            key={child.id}
                            src={getAvatarUrl()} 
                            alt={child.name}
                            title={child.name}
                            className="w-8 h-8 rounded-full bg-slate-600"
                          />
                        ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300">{familyCheckins}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                        onClick={() => setSelectedFamily(family)}
                      className="text-emerald-400 hover:text-emerald-300 mr-4"
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* Family Detail Modal */}
      {selectedFamily && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-3xl w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
            {/* Family Header */}
            <div className="flex justify-between items-start mb-6">
              {editingFamily ? (
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    value={familyForm.name}
                    onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })}
                    placeholder="Family Name"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-xl font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="tel"
                      value={familyForm.phone}
                      onChange={(e) => setFamilyForm({ ...familyForm, phone: e.target.value })}
                      placeholder="Phone Number"
                      className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="email"
                      value={familyForm.email}
                      onChange={(e) => setFamilyForm({ ...familyForm, email: e.target.value })}
                      placeholder="Email (optional)"
                      className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <input
                    type="text"
                    value={familyForm.parentName}
                    onChange={(e) => setFamilyForm({ ...familyForm, parentName: e.target.value })}
                    placeholder="Parent Name (optional)"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                  {error && <p className="text-red-400 text-sm">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveFamily}
                      disabled={saving}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingFamily(false)}
                      className="px-4 py-2 text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedFamily.name}</h3>
                  <p className="text-slate-400">{formatPhone(selectedFamily.phone)}</p>
                  {selectedFamily.email && (
                    <p className="text-slate-400 text-sm">{selectedFamily.email}</p>
                  )}
                  {selectedFamily.parent_name && (
                    <p className="text-slate-400 text-sm">Parent: {selectedFamily.parent_name}</p>
                  )}
                  <button
                    onClick={handleEditFamily}
                    className="mt-2 text-emerald-400 hover:text-emerald-300 text-sm"
                  >
                    ✏️ Edit Family Info
                  </button>
              </div>
              )}
              <button 
                onClick={() => {
                  setSelectedFamily(null);
                  setEditingFamily(false);
                  setEditingChild(null);
                  setAddingChild(false);
                }}
                className="text-slate-400 hover:text-white text-2xl ml-4"
              >
                ×
              </button>
            </div>
            
            {/* Children Section */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-white">Children</h4>
              <button
                onClick={handleAddChild}
                className="px-3 py-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm"
              >
                + Add Child
              </button>
            </div>
            
            {/* Add Child Form */}
            {addingChild && (
              <div className="bg-slate-700 rounded-xl p-4 mb-4 border-2 border-emerald-500">
                <h5 className="text-white font-semibold mb-3">Add New Child</h5>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    value={childForm.first_name}
                    onChange={(e) => setChildForm({ ...childForm, first_name: e.target.value })}
                    placeholder="First Name *"
                    className="bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    value={childForm.last_name}
                    onChange={(e) => setChildForm({ ...childForm, last_name: e.target.value })}
                    placeholder="Last Name"
                    className="bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Birthday</label>
                    <input
                      type="date"
                      value={childForm.birthday}
                      onChange={(e) => setChildForm({ ...childForm, birthday: e.target.value })}
                      className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Gender</label>
                    <select
                      value={childForm.gender}
                      onChange={(e) => setChildForm({ ...childForm, gender: e.target.value })}
                      className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={childForm.pin}
                        onChange={(e) => setChildForm({ ...childForm, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        placeholder="PIN (MMDDYY)"
                        maxLength={6}
                        className="flex-1 bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                      />
                      {childForm.birthday && (
                        <button
                          type="button"
                          onClick={() => setChildForm({ ...childForm, pin: generatePinFromBirthday(childForm.birthday) })}
                          className="text-xs text-emerald-400 hover:text-emerald-300 whitespace-nowrap"
                        >
                          Use birthday (MMDDYY)
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={childForm.allergies}
                    onChange={(e) => setChildForm({ ...childForm, allergies: e.target.value })}
                    placeholder="Allergies"
                    className="bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <textarea
                  value={childForm.notes}
                  onChange={(e) => setChildForm({ ...childForm, notes: e.target.value })}
                  placeholder="Notes"
                  rows={2}
                  className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 mb-3"
                />
                {/* Avatar preview */}
                <div className="mb-3">
                  <p className="text-slate-300 text-sm mb-2">Avatar:</p>
                  <img src={getAvatarUrl()} alt="Avatar" className="w-12 h-12 rounded-lg" />
                </div>
                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNewChild}
                    disabled={saving}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {saving ? 'Adding...' : 'Add Child'}
                  </button>
                  <button
                    onClick={() => { setAddingChild(false); setError(''); }}
                    className="px-4 py-2 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {/* Children List */}
            <div className="space-y-4">
              {selectedFamily.children?.map((child) => (
                <div key={child.id} className="bg-slate-700 rounded-xl p-4">
                  {editingChild === child.id ? (
                    /* Edit Child Form */
                    <div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <input
                          type="text"
                          value={childForm.first_name}
                          onChange={(e) => setChildForm({ ...childForm, first_name: e.target.value })}
                          placeholder="First Name *"
                          className="bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                        />
                        <input
                          type="text"
                          value={childForm.last_name}
                          onChange={(e) => setChildForm({ ...childForm, last_name: e.target.value })}
                          placeholder="Last Name"
                          className="bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-slate-400 text-xs mb-1">Birthday</label>
                          <input
                            type="date"
                            value={childForm.birthday}
                            onChange={(e) => setChildForm({ ...childForm, birthday: e.target.value })}
                            className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-xs mb-1">Gender</label>
                          <select
                            value={childForm.gender}
                            onChange={(e) => setChildForm({ ...childForm, gender: e.target.value })}
                            className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">Select...</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={childForm.pin}
                              onChange={(e) => setChildForm({ ...childForm, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                              placeholder="PIN (MMDDYY)"
                              maxLength={6}
                              className="flex-1 bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                            />
                            {childForm.birthday && (
                              <button
                                type="button"
                                onClick={() => setChildForm({ ...childForm, pin: generatePinFromBirthday(childForm.birthday) })}
                                className="text-xs text-emerald-400 hover:text-emerald-300 whitespace-nowrap"
                              >
                                Use birthday
                              </button>
                            )}
                          </div>
                        </div>
                        <input
                          type="text"
                          value={childForm.allergies}
                          onChange={(e) => setChildForm({ ...childForm, allergies: e.target.value })}
                          placeholder="Allergies"
                          className="bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <textarea
                        value={childForm.notes}
                        onChange={(e) => setChildForm({ ...childForm, notes: e.target.value })}
                        placeholder="Notes"
                        rows={2}
                        className="w-full bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 mb-3"
                      />
                      {/* Avatar preview */}
                      <div className="mb-3">
                        <p className="text-slate-300 text-sm mb-2">Avatar:</p>
                        <img src={getAvatarUrl()} alt="Avatar" className="w-12 h-12 rounded-lg" />
                      </div>
                      
                      {/* Pending Rewards Section */}
                      <div className="mb-3 p-3 bg-slate-600/50 rounded-lg border border-slate-500">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-slate-300 text-sm font-medium">🎁 Rewards for Next Check-in</p>
                          <button
                            type="button"
                            onClick={() => setShowAddRewardModal(true)}
                            className="text-xs bg-emerald-500 text-white px-2 py-1 rounded hover:bg-emerald-600"
                          >
                            + Add Reward
                          </button>
                        </div>
                        
                        {pendingRewards.length === 0 ? (
                          <p className="text-slate-400 text-xs">No pending rewards. Add one to surprise them on their next check-in!</p>
                        ) : (
                          <div className="space-y-2">
                            {pendingRewards.map((reward) => (
                              <div key={reward.id} className="flex items-center justify-between bg-slate-700 rounded px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{reward.custom_icon || '🎁'}</span>
                                  <div>
                                    <p className="text-white text-sm">{reward.custom_name || 'Reward'}</p>
                                    <p className="text-slate-400 text-xs">{reward.custom_description || 'Special reward'}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePendingReward(editingChild, reward.id)}
                                  className="text-red-400 hover:text-red-300 text-sm"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Add Reward Modal */}
                        {showAddRewardModal && (
                          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddRewardModal(false)}>
                            <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700" onClick={e => e.stopPropagation()}>
                              <h3 className="text-lg font-bold text-white mb-4">🎁 Add Reward for Next Check-in</h3>
                              
                              <div className="mb-4">
                                <label className="block text-slate-300 text-sm mb-2">Reward Name *</label>
                                <input
                                  type="text"
                                  value={newReward.custom_name}
                                  onChange={(e) => setNewReward({ ...newReward, custom_name: e.target.value })}
                                  placeholder="e.g., Special Prize, Extra Points"
                                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                />
                              </div>
                              
                              <div className="mb-4">
                                <label className="block text-slate-300 text-sm mb-2">Description / Prize</label>
                                <input
                                  type="text"
                                  value={newReward.custom_description}
                                  onChange={(e) => setNewReward({ ...newReward, custom_description: e.target.value })}
                                  placeholder="e.g., Pick from treasure box"
                                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                                />
                              </div>
                              
                              <div className="mb-4">
                                <label className="block text-slate-300 text-sm mb-2">Icon</label>
                                <div className="flex gap-2 flex-wrap">
                                  {['🎁', '⭐', '🏆', '🎉', '🌟', '💫', '🎈', '🍭', '🍪', '🎮'].map((icon) => (
                                    <button
                                      key={icon}
                                      type="button"
                                      onClick={() => setNewReward({ ...newReward, custom_icon: icon })}
                                      className={`text-2xl p-2 rounded-lg ${
                                        newReward.custom_icon === icon 
                                          ? 'bg-emerald-500/30 ring-2 ring-emerald-400' 
                                          : 'bg-slate-700 hover:bg-slate-600'
                                      }`}
                                    >
                                      {icon}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  onClick={() => setShowAddRewardModal(false)}
                                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddPendingReward(editingChild)}
                                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
                                >
                                  Add Reward
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveChild}
                          disabled={saving}
                          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => { setEditingChild(null); setError(''); }}
                          className="px-4 py-2 text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Child */
                    <>
                      <div className="flex items-center gap-4">
                        <img 
                          src={getAvatarUrl()} 
                          alt={child.name}
                          className="w-14 h-14 rounded-full bg-slate-600"
                        />
                    <div className="flex-1">
                      <p className="text-white font-semibold text-lg">{child.name}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-400 text-sm">
                            {(child.birthday || child.age) && (
                              <span>Age {calculateAge(child.birthday) ?? child.age}</span>
                            )}
                            {child.gender && <span className="capitalize">{child.gender}</span>}
                            {child.pin && <span>PIN: {child.pin}</span>}
                    </div>
                          {child.allergies && (
                            <p className="text-amber-400 text-sm mt-1">⚠️ Allergies: {child.allergies}</p>
                          )}
                          {child.notes && (
                            <p className="text-slate-400 text-sm mt-1">📝 {child.notes}</p>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                            <p className="text-xl font-bold text-orange-400">{child.streak || 0}</p>
                            <p className="text-slate-400 text-xs">Streak</p>
                      </div>
                      <div>
                            <p className="text-xl font-bold text-yellow-400">{child.badges || 0}</p>
                            <p className="text-slate-400 text-xs">Badges</p>
                      </div>
                      <div>
                            <p className="text-xl font-bold text-emerald-400">{child.totalCheckins || 0}</p>
                            <p className="text-slate-400 text-xs">Check-ins</p>
                      </div>
                    </div>
                  </div>
                      
                      {/* Quick Actions */}
                      <div className="flex gap-3 mt-3 pt-3 border-t border-slate-600">
                        <button
                          onClick={() => handleEditChild(child)}
                          className="text-emerald-400 hover:text-emerald-300 text-sm"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteChild(child.id, child.name)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          🗑️ Delete
                        </button>
            </div>
            
                    </>
                  )}
                </div>
              ))}
              
              {(!selectedFamily.children || selectedFamily.children.length === 0) && !addingChild && (
                <p className="text-slate-400 text-center py-4">No children in this family yet.</p>
              )}
            </div>
            
            <div className="mt-6 flex justify-end gap-4 pt-4 border-t border-slate-700">
              <button 
                onClick={() => handleDeleteFamily(selectedFamily.id)}
                className="px-4 py-2 text-red-400 hover:text-red-300"
              >
                Delete Family
              </button>
              <button 
                onClick={() => {
                  setSelectedFamily(null);
                  setEditingFamily(false);
                  setEditingChild(null);
                  setAddingChild(false);
                }}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Family Modal */}
      {showAddFamilyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold text-white">Add New Family</h3>
              <button 
                onClick={() => { setShowAddFamilyModal(false); setError(''); }}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-2">Family Name *</label>
                <input
                  type="text"
                  value={familyForm.name}
                  onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })}
                  placeholder="e.g., The Smith Family"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={familyForm.phone}
                  onChange={(e) => setFamilyForm({ ...familyForm, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">Email (optional)</label>
                <input
                  type="email"
                  value={familyForm.email}
                  onChange={(e) => setFamilyForm({ ...familyForm, email: e.target.value })}
                  placeholder="family@email.com"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">Parent Name (optional)</label>
                <input
                  type="text"
                  value={familyForm.parentName}
                  onChange={(e) => setFamilyForm({ ...familyForm, parentName: e.target.value })}
                  placeholder="John & Jane Smith"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              
              {error && <p className="text-red-400 text-sm">{error}</p>}
              
              <p className="text-slate-400 text-sm">
                After creating the family, you can add children from the family detail view.
              </p>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddFamilyModal(false); setError(''); }}
                className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNewFamily}
                disabled={saving || !familyForm.name.trim() || !familyForm.phone.trim()}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Creating...' : 'Create Family'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// ATTENDANCE TAB
// ============================================

function AttendanceTab({ token }) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setAttendance(data.attendance || []);
    } catch (err) {
      console.error('Error fetching attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading attendance...</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Attendance History</h2>
      
      {attendance.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-12 border border-slate-700 text-center">
          <p className="text-slate-400">No check-ins recorded yet</p>
        </div>
      ) : (
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700">
            <tr>
              <th className="text-left text-slate-300 px-6 py-4 font-semibold">Date</th>
                <th className="text-left text-slate-300 px-6 py-4 font-semibold">Day</th>
              <th className="text-left text-slate-300 px-6 py-4 font-semibold">Check-ins</th>
            </tr>
          </thead>
          <tbody>
              {attendance.map((record, i) => {
                const date = new Date(record.date);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
              return (
                <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/50">
                  <td className="px-6 py-4 text-white font-medium">{record.date}</td>
                    <td className="px-6 py-4 text-slate-300">{dayName}</td>
                  <td className="px-6 py-4 text-emerald-400 font-semibold">{record.count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

// ============================================
// VOLUNTEERS TAB
// ============================================

function VolunteersTab({ token }) {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [editingVolunteer, setEditingVolunteer] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [volunteerForm, setVolunteerForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    pin: '',
    avatar: DEFAULT_AVATAR
  });

  useEffect(() => {
    fetchVolunteers();
  }, []);

  const fetchVolunteers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/volunteers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setVolunteers(data);
    } catch (err) {
      console.error('Error fetching volunteers:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (phone) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 10) {
      return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    return phone;
  };

  const handleEditVolunteer = () => {
    setVolunteerForm({
      first_name: selectedVolunteer.first_name || '',
      last_name: selectedVolunteer.last_name || '',
      phone: selectedVolunteer.phone || '',
      email: selectedVolunteer.email || '',
      pin: selectedVolunteer.pin || '',
      avatar: DEFAULT_AVATAR
    });
    setEditingVolunteer(true);
    setError('');
  };

  const handleSaveVolunteer = async () => {
    if (!volunteerForm.first_name.trim() || !volunteerForm.last_name.trim()) {
      setError('First and last name are required');
      return;
    }
    if (!volunteerForm.phone.trim()) {
      setError('Phone number is required');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      // Update the family info
      const familyResponse = await fetch(`${API_BASE}/api/family/${selectedVolunteer.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: `${volunteerForm.first_name} ${volunteerForm.last_name} (Volunteer)`,
          phone: volunteerForm.phone.replace(/\D/g, ''),
          email: volunteerForm.email,
          parentName: `${volunteerForm.first_name} ${volunteerForm.last_name}`
        })
      });
      
      if (!familyResponse.ok) {
        throw new Error('Failed to update volunteer');
      }
      
      // Update the child record (volunteer's check-in profile)
      if (selectedVolunteer.child_id) {
        await fetch(`${API_BASE}/api/child/${selectedVolunteer.child_id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({
            first_name: volunteerForm.first_name,
            last_name: volunteerForm.last_name,
            pin: volunteerForm.pin,
            avatar: volunteerForm.avatar
          })
        });
      }
      
      await fetchVolunteers();
      setSelectedVolunteer({
        ...selectedVolunteer,
        ...volunteerForm,
        volunteer_name: `${volunteerForm.first_name} ${volunteerForm.last_name}`
      });
      setEditingVolunteer(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddVolunteer = async () => {
    if (!volunteerForm.first_name.trim() || !volunteerForm.last_name.trim()) {
      setError('First and last name are required');
      return;
    }
    if (!volunteerForm.phone.trim()) {
      setError('Phone number is required');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      // Create family entry
      const familyResponse = await fetch(`${API_BASE}/api/family`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: `${volunteerForm.first_name} ${volunteerForm.last_name} (Volunteer)`,
          phone: volunteerForm.phone.replace(/\D/g, ''),
          email: volunteerForm.email,
          parentName: `${volunteerForm.first_name} ${volunteerForm.last_name}`
        })
      });
      
      if (!familyResponse.ok) {
        const err = await familyResponse.json();
        throw new Error(err.error || 'Failed to create volunteer');
      }
      
      const family = await familyResponse.json();
      
      // Create child entry (volunteer's check-in profile)
      await fetch(`${API_BASE}/api/family/${family.id}/child`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          first_name: volunteerForm.first_name,
          last_name: volunteerForm.last_name,
          pin: volunteerForm.pin || Math.floor(100000 + Math.random() * 900000).toString(),
          avatar: volunteerForm.avatar,
          notes: 'Volunteer'
        })
      });
      
      await fetchVolunteers();
      setShowAddModal(false);
      setVolunteerForm({
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        pin: '',
        avatar: DEFAULT_AVATAR
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVolunteer = async (volunteerId) => {
    if (!confirm('Are you sure you want to delete this volunteer? This cannot be undone.')) {
      return;
    }
    
    try {
      await fetch(`${API_BASE}/api/family/${volunteerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setVolunteers(volunteers.filter(v => v.id !== volunteerId));
      setSelectedVolunteer(null);
    } catch (err) {
      console.error('Error deleting volunteer:', err);
      alert('Failed to delete volunteer');
    }
  };

  const filteredVolunteers = volunteers.filter(v => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      v.volunteer_name?.toLowerCase().includes(search) ||
      v.phone?.includes(search) ||
      v.email?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading volunteers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Volunteers</h1>
          <p className="text-slate-400">{volunteers.length} volunteers registered</p>
        </div>
        <button
          onClick={() => {
            setVolunteerForm({
              first_name: '',
              last_name: '',
              phone: '',
              email: '',
              pin: '',
              avatar: DEFAULT_AVATAR
            });
            setError('');
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-2"
        >
          <span>➕</span>
          <span>Add Volunteer</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search volunteers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 pl-10 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Volunteer List */}
        <div className="lg:col-span-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="font-semibold text-white">All Volunteers</h2>
          </div>
          <div className="divide-y divide-slate-700 max-h-[600px] overflow-y-auto">
            {filteredVolunteers.map((volunteer) => (
              <button
                key={volunteer.id}
                onClick={() => {
                  setSelectedVolunteer(volunteer);
                  setEditingVolunteer(false);
                }}
                className={`w-full p-4 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-3 ${
                  selectedVolunteer?.id === volunteer.id ? 'bg-slate-700/50' : ''
                }`}
              >
                <img
                  src={getAvatarUrl()}
                  alt=""
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium truncate">{volunteer.volunteer_name}</p>
                    {volunteer.is_also_parent && (
                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">Parent</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">{formatPhone(volunteer.phone)}</p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 text-sm">🔥 {volunteer.streak || 0}</p>
                </div>
              </button>
            ))}
            {filteredVolunteers.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                {searchTerm ? 'No volunteers match your search' : 'No volunteers yet'}
              </div>
            )}
          </div>
        </div>

        {/* Volunteer Detail */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700">
          {selectedVolunteer ? (
            <div className="p-6">
              {!editingVolunteer ? (
                <>
                  {/* View Mode */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <img
                        src={getAvatarUrl()}
                        alt=""
                        className="w-20 h-20 rounded-xl"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-bold text-white">{selectedVolunteer.volunteer_name}</h2>
                          {selectedVolunteer.is_also_parent && (
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">Also a Parent</span>
                          )}
                        </div>
                        <p className="text-slate-400">{formatPhone(selectedVolunteer.phone)}</p>
                        {selectedVolunteer.email && (
                          <p className="text-slate-400 text-sm">{selectedVolunteer.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleEditVolunteer}
                        className="px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteVolunteer(selectedVolunteer.id)}
                        className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-emerald-400">{selectedVolunteer.totalCheckins || 0}</p>
                      <p className="text-slate-400 text-sm">Total Check-ins</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-orange-400">🔥 {selectedVolunteer.streak || 0}</p>
                      <p className="text-slate-400 text-sm">Current Streak</p>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-yellow-400">🏆 {selectedVolunteer.badges || 0}</p>
                      <p className="text-slate-400 text-sm">Badges Earned</p>
                    </div>
                  </div>

                  {/* PIN */}
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <p className="text-slate-400 text-sm mb-1">Check-in PIN</p>
                    <p className="text-2xl font-mono text-white tracking-wider">{selectedVolunteer.pin || 'Not set'}</p>
                  </div>
                </>
              ) : (
                <>
                  {/* Edit Mode */}
                  <h2 className="text-xl font-bold text-white mb-4">Edit Volunteer</h2>
                  
                  {error && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3 mb-4 text-red-300 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">First Name</label>
                      <input
                        type="text"
                        value={volunteerForm.first_name}
                        onChange={(e) => setVolunteerForm({ ...volunteerForm, first_name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Last Name</label>
                      <input
                        type="text"
                        value={volunteerForm.last_name}
                        onChange={(e) => setVolunteerForm({ ...volunteerForm, last_name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Phone</label>
                      <input
                        type="tel"
                        value={volunteerForm.phone}
                        onChange={(e) => setVolunteerForm({ ...volunteerForm, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-sm mb-1">Email</label>
                      <input
                        type="email"
                        value={volunteerForm.email}
                        onChange={(e) => setVolunteerForm({ ...volunteerForm, email: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-slate-400 text-sm mb-1">PIN (6 digits)</label>
                    <input
                      type="text"
                      value={volunteerForm.pin}
                      onChange={(e) => setVolunteerForm({ ...volunteerForm, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder="6-digit PIN"
                      maxLength={6}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono"
                    />
                  </div>

                  {/* Avatar Selection */}
                  <div className="mb-4">
                    <label className="block text-slate-400 text-sm mb-2">Avatar</label>
                    <div className="flex items-center gap-4">
                      <img
                        src={getAvatarUrl()}
                        alt=""
                        className="w-16 h-16 rounded-xl"
                      />
                      <p className="text-slate-400 text-sm">Explorer avatar (more options coming soon!)</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveVolunteer}
                      disabled={saving}
                      className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setEditingVolunteer(false)}
                      className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-12 text-center">
              <div>
                <p className="text-4xl mb-4">🙋</p>
                <p className="text-slate-400">Select a volunteer to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Volunteer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Add New Volunteer</h2>
            
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3 mb-4 text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-slate-400 text-sm mb-1">First Name *</label>
                <input
                  type="text"
                  value={volunteerForm.first_name}
                  onChange={(e) => setVolunteerForm({ ...volunteerForm, first_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Last Name *</label>
                <input
                  type="text"
                  value={volunteerForm.last_name}
                  onChange={(e) => setVolunteerForm({ ...volunteerForm, last_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-slate-400 text-sm mb-1">Phone *</label>
              <input
                type="tel"
                value={volunteerForm.phone}
                onChange={(e) => setVolunteerForm({ ...volunteerForm, phone: e.target.value })}
                placeholder="(714) 555-1234"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
            </div>

            <div className="mb-4">
              <label className="block text-slate-400 text-sm mb-1">Email</label>
              <input
                type="email"
                value={volunteerForm.email}
                onChange={(e) => setVolunteerForm({ ...volunteerForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              />
            </div>

            <div className="mb-4">
              <label className="block text-slate-400 text-sm mb-1">PIN (optional - will auto-generate)</label>
              <input
                type="text"
                value={volunteerForm.pin}
                onChange={(e) => setVolunteerForm({ ...volunteerForm, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                placeholder="6-digit PIN"
                maxLength={6}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono"
              />
            </div>

            {/* Avatar Preview */}
            <div className="mb-4">
              <label className="block text-slate-400 text-sm mb-2">Avatar</label>
              <div className="flex items-center gap-4">
                <img
                  src={getAvatarUrl()}
                  alt=""
                  className="w-16 h-16 rounded-xl"
                />
                <p className="text-slate-400 text-sm">Explorer avatar (more options coming soon!)</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddVolunteer}
                disabled={saving}
                className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Volunteer'}
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setError('');
                }}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// REWARDS TAB
// ============================================

function RewardsTab({ token }) {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [editingReward, setEditingReward] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newReward, setNewReward] = useState({
    name: '',
    description: '',
    trigger_type: 'checkin_count',
    trigger_value: 10,
    prize: '',
    icon: '🎁'
  });

  useEffect(() => {
    fetchRewards();
    fetchStats();
  }, []);

  const fetchRewards = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/rewards`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setRewards(data);
    } catch (err) {
      console.error('Error fetching rewards:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/rewards/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching reward stats:', err);
    }
  };

  const toggleReward = async (rewardId) => {
    try {
      const response = await fetch(`${API_BASE}/api/rewards/${rewardId}/toggle`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setRewards(rewards.map(r => 
          r.id === rewardId ? { ...r, enabled: data.enabled ? 1 : 0 } : r
        ));
      }
    } catch (err) {
      console.error('Error toggling reward:', err);
    }
  };

  const updateReward = async (reward) => {
    try {
      await fetch(`${API_BASE}/api/rewards/${reward.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(reward)
      });
      setRewards(rewards.map(r => r.id === reward.id ? reward : r));
      setEditingReward(null);
    } catch (err) {
      console.error('Error updating reward:', err);
    }
  };

  const createReward = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/rewards`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(newReward)
      });
      const data = await response.json();
      if (data.success) {
        fetchRewards();
        setShowCreateModal(false);
        setNewReward({
          name: '',
          description: '',
          trigger_type: 'checkin_count',
          trigger_value: 10,
          prize: '',
          icon: '🎁'
        });
      }
    } catch (err) {
      console.error('Error creating reward:', err);
    }
  };

  const deleteReward = async (rewardId) => {
    if (!confirm('Are you sure you want to delete this reward?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/rewards/${rewardId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setRewards(rewards.filter(r => r.id !== rewardId));
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error('Error deleting reward:', err);
    }
  };

  const iconOptions = ['🎁', '🌟', '📚', '🎮', '👕', '🏆', '👑', '🔥', '⚡', '💎', '🎯', '🎪', '🎨', '🎵'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading rewards...</div>
      </div>
    );
  }

  // Group rewards by type
  const checkinRewards = rewards.filter(r => r.trigger_type === 'checkin_count');
  const streakRewards = rewards.filter(r => r.trigger_type === 'streak');
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">🎁 Reward Programs</h2>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
        >
          + Create Custom Reward
        </button>
      </div>

      <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <p className="text-slate-400 text-sm mb-1">Total Rewards Earned</p>
                <p className="text-2xl font-bold text-white">{stats.totalEarned}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <p className="text-slate-400 text-sm mb-1">Prizes to Claim</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.unclaimed}</p>
              </div>
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <p className="text-slate-400 text-sm mb-1">Active Programs</p>
                <p className="text-2xl font-bold text-emerald-400">{rewards.filter(r => r.enabled).length}</p>
              </div>
            </div>
          )}

      {/* Attendance Milestones */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>📈</span> Attendance Milestones
        </h3>
        <p className="text-slate-400 text-sm mb-4">Rewards earned when kids reach check-in milestones</p>
        
        <div className="space-y-3">
          {checkinRewards.map((reward) => (
            <div 
              key={reward.id} 
              className={`flex items-center gap-4 rounded-lg p-4 transition-all ${
                reward.enabled ? 'bg-slate-700' : 'bg-slate-700/40'
              }`}
            >
              <button
                onClick={() => toggleReward(reward.id)}
                className={`w-12 h-6 rounded-full transition-all relative ${
                  reward.enabled ? 'bg-emerald-500' : 'bg-slate-600'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  reward.enabled ? 'left-7' : 'left-1'
                }`} />
              </button>
              
              <span className="text-3xl">{reward.icon}</span>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={`font-semibold ${reward.enabled ? 'text-white' : 'text-slate-500'}`}>
                    {reward.name}
                  </p>
                  {reward.is_preset === 1 && (
                    <span className="text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded">Preset</span>
                  )}
                </div>
                <p className={`text-sm ${reward.enabled ? 'text-slate-400' : 'text-slate-600'}`}>
                  {reward.trigger_value} check-ins → {reward.prize}
                </p>
              </div>
              
              <button
                onClick={() => setEditingReward(reward)}
                className="text-slate-400 hover:text-white px-3 py-1"
              >
                Edit
              </button>
              
              {!reward.is_preset && (
                <button
                  onClick={() => deleteReward(reward.id)}
                  className="text-red-400 hover:text-red-300 px-3 py-1"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Streak Rewards */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>🔥</span> Streak Rewards
        </h3>
        <p className="text-slate-400 text-sm mb-4">Rewards for maintaining consecutive week streaks</p>
        
        <div className="space-y-3">
          {streakRewards.map((reward) => (
            <div 
              key={reward.id} 
              className={`flex items-center gap-4 rounded-lg p-4 transition-all ${
                reward.enabled ? 'bg-slate-700' : 'bg-slate-700/40'
              }`}
            >
              <button
                onClick={() => toggleReward(reward.id)}
                className={`w-12 h-6 rounded-full transition-all relative ${
                  reward.enabled ? 'bg-emerald-500' : 'bg-slate-600'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  reward.enabled ? 'left-7' : 'left-1'
                }`} />
              </button>
              
              <span className="text-3xl">{reward.icon}</span>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={`font-semibold ${reward.enabled ? 'text-white' : 'text-slate-500'}`}>
                    {reward.name}
                  </p>
                  {reward.is_preset === 1 && (
                    <span className="text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded">Preset</span>
                  )}
                </div>
                <p className={`text-sm ${reward.enabled ? 'text-slate-400' : 'text-slate-600'}`}>
                  {reward.trigger_value}-week streak → {reward.prize}
                </p>
              </div>
              
              <button
                onClick={() => setEditingReward(reward)}
                className="text-slate-400 hover:text-white px-3 py-1"
              >
                Edit
              </button>
              
              {!reward.is_preset && (
                <button
                  onClick={() => deleteReward(reward.id)}
                  className="text-red-400 hover:text-red-300 px-3 py-1"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

          {/* Recent Earned Rewards */}
          {stats?.recentEarned?.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">🎉 Recently Earned</h3>
              <div className="space-y-2">
                {stats.recentEarned.map((earned, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-700/50 rounded-lg p-3">
                    <img 
                      src={getAvatarUrl()} 
                      alt={earned.child_name}
                      className="w-8 h-8 rounded-full bg-slate-600"
                    />
                    <div className="flex-1">
                      <p className="text-white text-sm">
                        <span className="font-semibold">{earned.child_name}</span> earned{' '}
                        <span className="text-yellow-400">{earned.icon} {earned.name}</span>
                      </p>
                      <p className="text-slate-500 text-xs">
                        {new Date(earned.earned_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>

      {/* Edit Modal */}
      {editingReward && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Edit Reward</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-1">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {iconOptions.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setEditingReward({ ...editingReward, icon })}
                      className={`w-10 h-10 text-xl rounded-lg transition-all ${
                        editingReward.icon === icon 
                          ? 'bg-emerald-500' 
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">Name</label>
                <input
                  type="text"
                  value={editingReward.name}
                  onChange={(e) => setEditingReward({ ...editingReward, name: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">Description</label>
                <textarea
                  value={editingReward.description || ''}
                  onChange={(e) => setEditingReward({ ...editingReward, description: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white h-20"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">
                  {editingReward.trigger_type === 'streak' ? 'Streak Weeks Required' : 'Check-ins Required'}
                </label>
                <input
                  type="number"
                  value={editingReward.trigger_value}
                  onChange={(e) => setEditingReward({ ...editingReward, trigger_value: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  min="1"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">Prize</label>
                <input
                  type="text"
                  value={editingReward.prize || ''}
                  onChange={(e) => setEditingReward({ ...editingReward, prize: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  placeholder="e.g., Small toy from prize box"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingReward(null)}
                className="px-4 py-2 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => updateReward(editingReward)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Create Custom Reward</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm mb-1">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {iconOptions.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setNewReward({ ...newReward, icon })}
                      className={`w-10 h-10 text-xl rounded-lg transition-all ${
                        newReward.icon === icon 
                          ? 'bg-emerald-500' 
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">Reward Name</label>
                <input
                  type="text"
                  value={newReward.name}
                  onChange={(e) => setNewReward({ ...newReward, name: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  placeholder="e.g., Birthday Bonus"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">Description</label>
                <textarea
                  value={newReward.description}
                  onChange={(e) => setNewReward({ ...newReward, description: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white h-20"
                  placeholder="Describe when this reward is earned"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">Trigger Type</label>
                <select
                  value={newReward.trigger_type}
                  onChange={(e) => setNewReward({ ...newReward, trigger_type: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="checkin_count">Total Check-ins</option>
                  <option value="streak">Week Streak</option>
                </select>
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">
                  {newReward.trigger_type === 'streak' ? 'Weeks Required' : 'Check-ins Required'}
                </label>
                <input
                  type="number"
                  value={newReward.trigger_value}
                  onChange={(e) => setNewReward({ ...newReward, trigger_value: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  min="1"
                />
              </div>
              
              <div>
                <label className="block text-slate-300 text-sm mb-1">Prize</label>
                <input
                  type="text"
                  value={newReward.prize}
                  onChange={(e) => setNewReward({ ...newReward, prize: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  placeholder="e.g., Free ice cream cone"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={createReward}
                disabled={!newReward.name || !newReward.trigger_value}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Reward
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SETTINGS TAB
// ============================================

function SettingsTab({ logo, setLogo, token }) {
  const [orgName, setOrgName] = useState('Adventure Kids');
  const [tagline, setTagline] = useState('Check-In');
  const [rooms, setRooms] = useState([]);
  const [testPrintStatus, setTestPrintStatus] = useState(null);
  
  // Room editing state
  const [editingRoom, setEditingRoom] = useState(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomForm, setRoomForm] = useState({ name: '', age_range: '', capacity: '' });
  const [roomSaving, setRoomSaving] = useState(false);
  
  // Template state
  const [templates, setTemplates] = useState([]);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    day_of_week: '',
    start_time: '',
    end_time: '',
    checkout_enabled: false,
    room_ids: [],
    track_streaks: true,
    streak_reset_days: 7
  });
  const [templateSaving, setTemplateSaving] = useState(false);

  useEffect(() => {
    fetchRooms();
    fetchTemplates();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/rooms`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setRooms(data);
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setTemplates(data);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: '',
      day_of_week: '',
      start_time: '',
      end_time: '',
      checkout_enabled: false,
      room_ids: rooms.map(r => r.id), // Default to all rooms selected
      track_streaks: true,
      streak_reset_days: 7
    });
    setShowTemplateModal(true);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      day_of_week: template.day_of_week || '',
      start_time: template.start_time || '',
      end_time: template.end_time || '',
      checkout_enabled: template.checkout_enabled,
      room_ids: template.room_ids || [],
      track_streaks: template.track_streaks !== false,
      streak_reset_days: template.streak_reset_days || 7
    });
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) return;
    
    setTemplateSaving(true);
    try {
      const url = editingTemplate 
        ? `${API_BASE}/api/templates/${editingTemplate.id}`
        : `${API_BASE}/api/templates`;
      
      const response = await fetch(url, {
        method: editingTemplate ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: templateForm.name.trim(),
          day_of_week: templateForm.day_of_week || null,
          start_time: templateForm.start_time || null,
          end_time: templateForm.end_time || null,
          checkout_enabled: templateForm.checkout_enabled,
          room_ids: templateForm.room_ids,
          track_streaks: templateForm.track_streaks,
          streak_reset_days: templateForm.streak_reset_days
        })
      });
      
      if (response.ok) {
        await fetchTemplates();
        setShowTemplateModal(false);
        setEditingTemplate(null);
      }
    } catch (err) {
      console.error('Error saving template:', err);
    }
    setTemplateSaving(false);
  };

  const handleActivateTemplate = async (templateId) => {
    try {
      await fetch(`${API_BASE}/api/templates/${templateId}/activate`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchTemplates();
    } catch (err) {
      console.error('Error activating template:', err);
    }
  };

  const handleDeactivateTemplates = async () => {
    try {
      await fetch(`${API_BASE}/api/templates/deactivate`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchTemplates();
    } catch (err) {
      console.error('Error deactivating templates:', err);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/templates/${templateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        await fetchTemplates();
      }
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  const toggleRoomInTemplate = (roomId) => {
    setTemplateForm(prev => ({
      ...prev,
      room_ids: prev.room_ids.includes(roomId)
        ? prev.room_ids.filter(id => id !== roomId)
        : [...prev.room_ids, roomId]
    }));
  };

  const handleAddRoom = () => {
    setEditingRoom(null);
    setRoomForm({ name: '', age_range: '', capacity: '' });
    setShowRoomModal(true);
  };

  const handleEditRoom = (room) => {
    setEditingRoom(room);
    setRoomForm({ 
      name: room.name, 
      age_range: room.age_range || '', 
      capacity: room.capacity || '' 
    });
    setShowRoomModal(true);
  };

  const handleSaveRoom = async () => {
    if (!roomForm.name.trim()) return;
    
    setRoomSaving(true);
    try {
      const url = editingRoom 
        ? `${API_BASE}/api/rooms/${editingRoom.id}`
        : `${API_BASE}/api/rooms`;
      
      const response = await fetch(url, {
        method: editingRoom ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: roomForm.name.trim(),
          age_range: roomForm.age_range.trim() || null,
          capacity: roomForm.capacity ? parseInt(roomForm.capacity) : null
        })
      });
      
      if (response.ok) {
        await fetchRooms();
        setShowRoomModal(false);
        setEditingRoom(null);
        setRoomForm({ name: '', age_range: '', capacity: '' });
      }
    } catch (err) {
      console.error('Error saving room:', err);
    }
    setRoomSaving(false);
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm('Are you sure you want to delete this room?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        await fetchRooms();
      }
    } catch (err) {
      console.error('Error deleting room:', err);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTestPrint = async () => {
    setTestPrintStatus('printing');
    try {
      const response = await fetch(`${API_BASE}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childName: 'Test Label',
          avatar: '🦊',
          pickupCode: 'TEST',
          room: 'Room 101',
          streak: 5,
          rank: 1,
          badges: 10,
          tier: 'bronze'
        })
      });
      
      if (response.ok) {
        setTestPrintStatus('success');
      } else {
        setTestPrintStatus('error');
      }
    } catch (err) {
      setTestPrintStatus('error');
    }
    
    setTimeout(() => setTestPrintStatus(null), 3000);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>
      
      {/* Branding */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Branding</h3>
        
        <div className="mb-6">
          <label className="block text-slate-300 mb-2">Logo</label>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 bg-slate-700 rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-600">
              {logo ? (
                <img src={logo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-slate-500 text-sm text-center px-2">No logo uploaded</span>
              )}
            </div>
            <div>
              <input
                type="file"
                accept="image/*,.svg"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
              />
              <label
                htmlFor="logo-upload"
                className="inline-block px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 cursor-pointer transition-colors"
              >
                Upload Logo
              </label>
              <p className="text-slate-400 text-sm mt-2">SVG, PNG or JPG (max 2MB)</p>
              {logo && (
                <button 
                  onClick={() => setLogo(null)}
                  className="text-red-400 text-sm mt-2 hover:text-red-300"
                >
                  Remove Logo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-slate-300 mb-2">Organization Name</label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-slate-300 mb-2">Tagline</label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <button className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">
          Save Branding
        </button>
      </div>

      {/* Rooms */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Rooms</h3>
          <button 
            onClick={handleAddRoom}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
          >
            + Add Room
          </button>
        </div>
        <div className="space-y-3">
          {rooms.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No rooms configured yet. Add your first room!</p>
          ) : (
            rooms.map((room) => (
              <div key={room.id} className="flex items-center justify-between bg-slate-700 rounded-lg px-4 py-3">
                <div>
                  <span className="text-white font-medium">{room.name}</span>
                  {room.age_range && (
                    <span className="text-slate-400 text-sm ml-2">Ages {room.age_range}</span>
                  )}
                  {room.capacity && (
                    <span className="text-slate-500 text-sm ml-2">• Capacity: {room.capacity}</span>
                  )}
          </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEditRoom(room)}
                    className="text-emerald-400 hover:text-emerald-300 text-sm"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteRoom(room.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Delete
                  </button>
          </div>
          </div>
            ))
          )}
          </div>
        </div>

      {/* Room Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingRoom ? 'Edit Room' : 'Add New Room'}
            </h3>
            
            <div className="mb-4">
              <label className="block text-slate-300 mb-2">Room Name *</label>
              <input
                type="text"
                value={roomForm.name}
                onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                placeholder="e.g., Nursery, Kids Room 1"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              />
      </div>

            <div className="mb-4">
              <label className="block text-slate-300 mb-2">Age Range</label>
              <input
                type="text"
                value={roomForm.age_range}
                onChange={(e) => setRoomForm({ ...roomForm, age_range: e.target.value })}
                placeholder="e.g., 0-2, 3-5, 6-10"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-slate-300 mb-2">Capacity</label>
              <input
                type="number"
                value={roomForm.capacity}
                onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                placeholder="e.g., 20"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRoomModal(false);
                  setEditingRoom(null);
                  setRoomForm({ name: '', age_range: '', capacity: '' });
                }}
                className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoom}
                disabled={!roomForm.name.trim() || roomSaving}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {roomSaving ? 'Saving...' : (editingRoom ? 'Save Changes' : 'Add Room')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Event Templates</h3>
          <button 
            onClick={handleAddTemplate}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm"
          >
            + Create Template
          </button>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          Templates define which rooms are available during different events. Only one template can be active at a time.
        </p>
        <div className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No templates configured yet. Create your first template!</p>
          ) : (
            templates.map((template) => (
              <div 
                key={template.id} 
                className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                  template.is_active 
                    ? 'bg-emerald-900/30 border border-emerald-500/50' 
                    : 'bg-slate-700'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{template.name}</span>
                    {template.is_active && (
                      <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full">Active</span>
                    )}
                  </div>
                  <div className="text-slate-400 text-sm mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {template.day_of_week && (
                      <span className="capitalize">{template.day_of_week}</span>
                    )}
                    {template.start_time && template.end_time && (
                      <span>{template.start_time} - {template.end_time}</span>
                    )}
                    <span>
                      {template.room_ids.length} room{template.room_ids.length !== 1 ? 's' : ''}
                    </span>
                    {template.checkout_enabled && (
                      <span className="text-amber-400">Checkout enabled</span>
                    )}
                    {template.track_streaks && (
                      <span className="text-orange-400">🔥 Streaks ({template.streak_reset_days}d)</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  {template.is_active ? (
                    <button 
                      onClick={handleDeactivateTemplates}
                      className="text-amber-400 hover:text-amber-300 text-sm"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleActivateTemplate(template.id)}
                      className="text-emerald-400 hover:text-emerald-300 text-sm"
                    >
                      Activate
                    </button>
                  )}
                  <button 
                    onClick={() => handleEditTemplate(template)}
                    className="text-slate-400 hover:text-white text-sm"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </h3>
            
            <div className="mb-4">
              <label className="block text-slate-300 mb-2">Template Name *</label>
              <input
                type="text"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="e.g., Sunday Morning, VBS, Childcare"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-slate-300 mb-2">Day of Week</label>
                <select
                  value={templateForm.day_of_week}
                  onChange={(e) => setTemplateForm({ ...templateForm, day_of_week: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Any day</option>
                  <option value="sunday">Sunday</option>
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-slate-300 mb-2">Start Time</label>
                <input
                  type="time"
                  value={templateForm.start_time}
                  onChange={(e) => setTemplateForm({ ...templateForm, start_time: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">End Time</label>
                <input
                  type="time"
                  value={templateForm.end_time}
                  onChange={(e) => setTemplateForm({ ...templateForm, end_time: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={templateForm.checkout_enabled}
                  onChange={(e) => setTemplateForm({ ...templateForm, checkout_enabled: e.target.checked })}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                />
                <span className="text-white">Enable checkout (require pickup code)</span>
              </label>
              <p className="text-slate-400 text-sm mt-1 ml-8">
                When enabled, parents must enter pickup code to check out their children.
              </p>
            </div>

            {/* Streak Tracking Settings */}
            <div className="mb-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
              <label className="flex items-center gap-3 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={templateForm.track_streaks}
                  onChange={(e) => setTemplateForm({ ...templateForm, track_streaks: e.target.checked })}
                  className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                />
                <span className="text-white font-medium">🔥 Track attendance streaks</span>
              </label>
              <p className="text-slate-400 text-sm mb-3">
                Track consecutive attendance separately for this template/event.
              </p>
              
              {templateForm.track_streaks && (
                <div className="ml-8">
                  <label className="block text-slate-300 text-sm mb-2">
                    Reset streak after how many days?
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={templateForm.streak_reset_days}
                      onChange={(e) => setTemplateForm({ ...templateForm, streak_reset_days: parseInt(e.target.value) || 7 })}
                      className="w-20 bg-slate-600 border border-slate-500 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-slate-300">days</span>
                  </div>
                  <p className="text-slate-500 text-xs mt-2">
                    If a child doesn't check in within this many days, their streak resets to 1.
                    <br />
                    <span className="text-amber-400">Tip:</span> Use 7 for weekly events (Sunday service), 8-9 for some flexibility, 14 for bi-weekly events.
                  </p>
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-slate-300 mb-2">Available Rooms</label>
              <div className="bg-slate-700 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                {rooms.length === 0 ? (
                  <p className="text-slate-400 text-sm">No rooms available. Create rooms first.</p>
                ) : (
                  rooms.map((room) => (
                    <label key={room.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-600 rounded">
                      <input
                        type="checkbox"
                        checked={templateForm.room_ids.includes(room.id)}
                        onChange={() => toggleRoomInTemplate(room.id)}
                        className="w-5 h-5 rounded bg-slate-600 border-slate-500 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-700"
                      />
                      <span className="text-white">{room.name}</span>
                      {room.age_range && (
                        <span className="text-slate-400 text-sm">Ages {room.age_range}</span>
                      )}
                    </label>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setTemplateForm({ ...templateForm, room_ids: rooms.map(r => r.id) })}
                  className="text-emerald-400 hover:text-emerald-300 text-sm"
                >
                  Select All
                </button>
                <span className="text-slate-500">|</span>
                <button
                  type="button"
                  onClick={() => setTemplateForm({ ...templateForm, room_ids: [] })}
                  className="text-slate-400 hover:text-slate-300 text-sm"
                >
                  Clear All
                </button>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setEditingTemplate(null);
                }}
                className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateForm.name.trim() || templateSaving}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {templateSaving ? 'Saving...' : (editingTemplate ? 'Save Changes' : 'Create Template')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printer Settings */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Printer Settings</h3>
        <div className="mb-4">
          <label className="block text-slate-300 mb-2">Selected Printer</label>
          <select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500">
            <option>DYMO LabelWriter 450 Turbo</option>
            <option>DYMO LabelWriter 550</option>
            <option>Primera LX500 (Color)</option>
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-slate-300 mb-2">Label Size</label>
          <select className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500">
            <option>30256 - Shipping (2.3 x 4)</option>
            <option>30252 - Address (1.1 x 3.5)</option>
            <option>30324 - Diskette (2.1 x 2.8)</option>
          </select>
        </div>
        <button 
          onClick={handleTestPrint}
          disabled={testPrintStatus === 'printing'}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
        >
          {testPrintStatus === 'printing' ? 'Printing...' : 
           testPrintStatus === 'success' ? '✓ Printed!' :
           testPrintStatus === 'error' ? '✗ Failed' :
           'Print Test Label'}
        </button>
      </div>
    </div>
  );
}

// ============================================
// MAIN ADMIN COMPONENT
// ============================================

export default function Admin() {
  const [token, setToken] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logo, setLogo] = useState(null);

  useEffect(() => {
    // Check for existing session
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
      verifyToken(savedToken);
    } else {
      setCheckingAuth(false);
    }
  }, []);

  const verifyToken = async (savedToken) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/verify`, {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      });
      
      if (response.ok) {
        setToken(savedToken);
      } else {
        localStorage.removeItem('adminToken');
      }
    } catch (err) {
      console.error('Error verifying token:', err);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      // Ignore errors
    }
    
    localStorage.removeItem('adminToken');
    setToken(null);
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!token) {
    return <LoginScreen onLogin={setToken} />;
  }

  // Show dashboard if authenticated
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        logo={logo} 
        onLogout={handleLogout}
      />
      
      <main className="flex-1 p-8">
        {activeTab === 'dashboard' && <DashboardTab token={token} />}
        {activeTab === 'families' && <FamiliesTab token={token} />}
        {activeTab === 'volunteers' && <VolunteersTab token={token} />}
        {activeTab === 'rewards' && <RewardsTab token={token} />}
        {activeTab === 'attendance' && <AttendanceTab token={token} />}
        {activeTab === 'settings' && <SettingsTab logo={logo} setLogo={setLogo} token={token} />}
      </main>
    </div>
  );
}
