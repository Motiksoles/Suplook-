import { useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// SUPLOOK TRAINING UI
// For: Graduating leads, correcting AI, teaching the model
// Port: 5174
// ═══════════════════════════════════════════════════════════════════════════

// Get server URL from env or default
const SERVER_URL = import.meta.env.VITE_SERVER_URL || localStorage.getItem('suplook_server') || 'http://localhost:3009';

// Login Screen
function LoginScreen({ onLogin }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const resp = await fetch(`${SERVER_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      
      const data = await resp.json();
      
      if (data.success) {
        localStorage.setItem('suplook_api_key', data.key);
        localStorage.setItem('suplook_access_level', data.level);
        onLogin(data.key, data.level);
      } else {
        setError(data.error || 'Invalid key');
      }
    } catch (err) {
      setError('Cannot connect to server. Make sure server is running.');
    }
    
    setLoading(false);
  };
  
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a0a2e 0%, #16213e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#111', border: '1px solid #333', borderRadius: '12px', padding: '40px', width: '360px', textAlign: 'center' }}>
        <svg width="80" height="80" viewBox="0 0 200 200" style={{ marginBottom: '10px' }}>
          <path d="M 15 100 Q 40 55 100 50 Q 160 55 185 100 Q 160 145 100 150 Q 40 145 15 100 Z" fill="#ffffff"/>
          <path d="M 15 100 Q 40 55 100 50 Q 160 55 185 100" fill="none" stroke="#a855f7" strokeWidth="6" strokeLinecap="round"/>
          <path d="M 15 100 Q 40 145 100 150 Q 160 145 185 100" fill="none" stroke="#a855f7" strokeWidth="4" strokeLinecap="round"/>
          <circle cx="100" cy="100" r="38" fill="#a855f7"/>
          <circle cx="96" cy="96" r="22" fill="none" stroke="#ffffff" strokeWidth="3"/>
          <circle cx="96" cy="96" r="20" fill="#4a90d9"/>
          <circle cx="96" cy="96" r="12" fill="#2563eb"/>
          <circle cx="96" cy="96" r="6" fill="#0a0a0a"/>
          <circle cx="88" cy="88" r="5" fill="rgba(255,255,255,0.4)"/>
          <line x1="113" y1="113" x2="125" y2="125" stroke="#ffffff" strokeWidth="5" strokeLinecap="round"/>
          <line x1="113" y1="113" x2="125" y2="125" stroke="#a855f7" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <h1 style={{ color: '#a855f7', margin: '0 0 5px', fontSize: '1.5rem' }}>Suplook Training</h1>
        <p style={{ color: '#666', margin: '0 0 30px', fontSize: '0.85rem' }}>Teach the AI. Build the moat.</p>
        
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          placeholder="Enter access key..."
          style={{ width: '100%', padding: '12px 15px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '8px', color: '#fff', fontSize: '1rem', marginBottom: '15px', boxSizing: 'border-box' }}
        />
        
        {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0 0 15px' }}>{error}</p>}
        
        <button
          onClick={handleLogin}
          disabled={loading || !key}
          style={{ width: '100%', padding: '12px', background: loading ? '#333' : '#a855f7', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: loading ? 'wait' : 'pointer' }}
        >
          {loading ? 'Connecting...' : 'Login'}
        </button>
        
        <p style={{ color: '#444', fontSize: '0.75rem', marginTop: '20px' }}>Server: {SERVER_URL}</p>
      </div>
    </div>
  );
}

export default function TrainingApp() {
  const [authKey, setAuthKey] = useState(() => localStorage.getItem('suplook_api_key') || '');
  const [accessLevel, setAccessLevel] = useState(() => localStorage.getItem('suplook_access_level') || '');
  
  // Check if logged in
  if (!authKey) {
    return <LoginScreen onLogin={(key, level) => { setAuthKey(key); setAccessLevel(level); }} />;
  }
  
  const logout = () => {
    localStorage.removeItem('suplook_api_key');
    localStorage.removeItem('suplook_access_level');
    setAuthKey('');
    setAccessLevel('');
  };
  
  // Auth headers for API calls
  const authHeaders = { 'Content-Type': 'application/json', 'x-api-key': authKey };
  
  const [leads, setLeads] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editProducts, setEditProducts] = useState([]);
  const [newProduct, setNewProduct] = useState('');
  const [catalog, setCatalog] = useState(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, graduated: 0, corrected: 0 });
  const [visionServer] = useState(SERVER_URL);
  const [googleApiKey, setGoogleApiKey] = useState('');

  useEffect(() => { 
    loadLeads(); 
    fetchCatalog(); 
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const resp = await fetch(`${visionServer}/config`, { headers: { 'x-api-key': authKey } });
      const data = await resp.json();
      if (data.googleApiKey) {
        setGoogleApiKey(data.googleApiKey);
        localStorage.setItem('suplook_google_key', data.googleApiKey);
      }
    } catch (err) {
      // Fallback to localStorage
      const saved = localStorage.getItem('suplook_google_key');
      if (saved) setGoogleApiKey(saved);
    }
  };

  const loadLeads = async () => {
    try {
      const resp = await fetch(`${visionServer}/leads?graduated=false`, { headers: { 'x-api-key': authKey } });
      const data = await resp.json();
      const pending = (data.leads || []).sort((a, b) => (a.photo_tier || 3) - (b.photo_tier || 3));
      setLeads(pending);
      setStats({ 
        total: data.total || 0, 
        pending: data.pending || 0, 
        graduated: data.graduated || 0, 
        corrected: pending.filter(l => l.ai_corrected).length 
      });
      if (pending.length > 0) setEditProducts(pending[0].products || []);
    } catch (err) {
      // Fallback to localStorage
      const saved = localStorage.getItem('mcd_enriched');
      if (saved) {
        const all = JSON.parse(saved);
        const pending = all.filter(l => !l.graduated).sort((a, b) => (a.photo_tier || 3) - (b.photo_tier || 3));
        setLeads(pending);
        setStats({ total: all.length, pending: pending.length, graduated: all.filter(l => l.graduated).length, corrected: all.filter(l => l.ai_corrected).length });
        if (pending.length > 0) setEditProducts(pending[0].products || []);
      }
    }
  };

  const fetchCatalog = async () => {
    try { const resp = await fetch(`${visionServer}/catalog`, { headers: { 'x-api-key': authKey } }); if (resp.ok) setCatalog(await resp.json()); } catch {}
  };

  const current = leads[currentIndex];

  const addProduct = () => {
    if (newProduct.trim() && !editProducts.includes(newProduct.trim())) {
      setEditProducts([...editProducts, newProduct.trim()]);
      setNewProduct('');
    }
  };

  const removeProduct = (index) => setEditProducts(editProducts.filter((_, i) => i !== index));

  const graduate = async (approved) => {
    if (!current) return;
    
    const originalProducts = current.products || [];
    const changed = JSON.stringify(originalProducts.sort()) !== JSON.stringify([...editProducts].sort());
    
    try {
      // Graduate via server API
      await fetch(`${visionServer}/leads/${current.id}/graduate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ 
          products: editProducts, 
          corrected: changed && !approved 
        })
      });
      
      // If corrected, also send feedback to Vision AI
      if (changed && !approved) {
        await fetch(`${visionServer}/feedback`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ 
            restaurantName: current.name, 
            cuisineType: current.detected_cuisine, 
            originalProducts, 
            correctedProducts: editProducts, 
            photoReference: current.photo_reference 
          })
        });
      }
    } catch (err) {
      console.error('Graduate error:', err);
    }
    
    // Move to next
    const remaining = leads.filter(l => l.id !== current.id);
    setLeads(remaining);
    if (remaining.length > 0) {
      const nextIndex = Math.min(currentIndex, remaining.length - 1);
      setCurrentIndex(nextIndex);
      setEditProducts(remaining[nextIndex]?.products || []);
    } else {
      setEditProducts([]);
    }
    loadLeads();
  };

  const graduateAll = async () => {
    if (!confirm(`Graduate all ${leads.length} pending leads with current AI suggestions?`)) return;
    
    try {
      await fetch(`${visionServer}/leads/graduate-all`, { method: 'POST', headers: { 'x-api-key': authKey } });
    } catch (err) {
      console.error('Graduate all error:', err);
    }
    
    loadLeads();
  };

  const skip = () => {
    if (currentIndex < leads.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setEditProducts(leads[currentIndex + 1]?.products || []);
    }
  };

  // Get the best photo URL from the lead's photos array
  const getPhotoUrl = () => {
    if (current?.photos && current.photos.length > 0) {
      return current.photos[0].url;
    }
    return null;
  };
  
  // Get photo source label
  const getPhotoSource = () => {
    if (current?.photos && current.photos.length > 0) {
      const source = current.photos[0].source;
      const labels = {
        'yelp': '📸 Yelp',
        'instagram': '📷 Instagram',
        'google_places': '🗺️ Google',
        'google_images': '🔍 Search'
      };
      return labels[source] || source;
    }
    return null;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a0a2e 0%, #16213e 100%)', fontFamily: 'system-ui, sans-serif', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid #333', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="40" height="40" viewBox="0 0 200 200">
            <path d="M 15 100 Q 40 55 100 50 Q 160 55 185 100 Q 160 145 100 150 Q 40 145 15 100 Z" fill="#ffffff"/>
            <path d="M 15 100 Q 40 55 100 50 Q 160 55 185 100" fill="none" stroke="#a855f7" strokeWidth="6" strokeLinecap="round"/>
            <path d="M 15 100 Q 40 145 100 150 Q 160 145 185 100" fill="none" stroke="#a855f7" strokeWidth="4" strokeLinecap="round"/>
            <circle cx="100" cy="100" r="38" fill="#a855f7"/>
            <circle cx="96" cy="96" r="22" fill="none" stroke="#ffffff" strokeWidth="3"/>
            <circle cx="96" cy="96" r="20" fill="#4a90d9"/>
            <circle cx="96" cy="96" r="12" fill="#2563eb"/>
            <circle cx="96" cy="96" r="6" fill="#0a0a0a"/>
            <circle cx="88" cy="88" r="5" fill="rgba(255,255,255,0.4)"/>
            <line x1="113" y1="113" x2="125" y2="125" stroke="#ffffff" strokeWidth="5" strokeLinecap="round"/>
            <line x1="113" y1="113" x2="125" y2="125" stroke="#a855f7" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <div>
            <h1 style={{ color: '#a855f7', margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Suplook Training</h1>
            <p style={{ color: '#666', margin: 0, fontSize: '0.75rem' }}>Teach the AI • Build the Moat</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#f59e0b', fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.pending}</div>
            <div style={{ color: '#666', fontSize: '0.7rem' }}>Pending</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#22c55e', fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.graduated}</div>
            <div style={{ color: '#666', fontSize: '0.7rem' }}>Graduated</div>
          </div>
          <a href="http://localhost:5173" target="_blank" rel="noopener noreferrer" style={{ background: '#10b981', color: '#000', padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 'bold' }}>
            👁️ Operations
          </a>
        </div>
      </div>

      {leads.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎉</div>
          <h2 style={{ color: '#22c55e', marginBottom: '10px' }}>All Caught Up!</h2>
          <p style={{ color: '#666' }}>No leads pending graduation.</p>
          <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '20px' }}>Run a scrape in Operations UI to add more leads.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', padding: '20px', maxWidth: '1300px', margin: '0 auto' }}>
          {/* Left: Photo & Lead Info */}
          <div>
            <div style={{ background: '#000', borderRadius: '12px', overflow: 'hidden', marginBottom: '15px', position: 'relative' }}>
              {getPhotoUrl() ? (
                <img src={getPhotoUrl()} alt={current?.name} style={{ width: '100%', height: '380px', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
              ) : (
                <div style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>No photo available</div>
              )}
              <div style={{ position: 'absolute', top: '15px', right: '15px', background: current?.photo_tier === 1 ? '#22c55e' : current?.photo_tier === 2 ? '#06b6d4' : '#666', color: '#000', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                {current?.photo_tier === 1 ? '🔥 Tier 1' : current?.photo_tier === 2 ? '✅ Tier 2' : '📋 Tier 3'}
              </div>
              {getPhotoSource() && (
                <div style={{ position: 'absolute', bottom: '15px', right: '15px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem' }}>
                  {getPhotoSource()} • {current?.photos?.length || 0} photos
                </div>
              )}
              {current?.delivery?.onDoorDash && (
                <div style={{ position: 'absolute', bottom: '15px', left: '15px', background: '#ef4444', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  🚗 DoorDash
                </div>
              )}
              <div style={{ position: 'absolute', top: '15px', left: '15px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem' }}>
                {currentIndex + 1} / {leads.length}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#fff', fontSize: '1.3rem' }}>{current?.name}</h2>
                  <p style={{ margin: '5px 0 0', color: '#888', fontSize: '0.85rem' }}>{current?.address}</p>
                </div>
                <span style={{ background: '#a855f7', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem' }}>{current?.detected_cuisine}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '15px' }}>
                <div style={{ background: '#1a1a1a', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ color: '#666', fontSize: '0.7rem' }}>Phone</div>
                  <div style={{ color: current?.phone ? '#22c55e' : '#444', fontSize: '0.9rem' }}>{current?.phone_display || 'N/A'}</div>
                </div>
                <div style={{ background: '#1a1a1a', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ color: '#666', fontSize: '0.7rem' }}>Email</div>
                  <div style={{ color: current?.email ? '#06b6d4' : '#444', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current?.email || 'N/A'}</div>
                </div>
                <div style={{ background: '#1a1a1a', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ color: '#666', fontSize: '0.7rem' }}>Instagram</div>
                  <div style={{ color: current?.instagram ? '#ec4899' : '#444', fontSize: '0.9rem' }}>{current?.instagram ? `@${current.instagram}` : 'N/A'}</div>
                </div>
              </div>

              {current?.vision_analysis?.description && (
                <div style={{ background: '#1a1a1a', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ color: '#a855f7', fontSize: '0.75rem', marginBottom: '5px' }}>🧠 AI Analysis</div>
                  <div style={{ color: '#888', fontStyle: 'italic', fontSize: '0.85rem' }}>"{current.vision_analysis.description}"</div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Products & Actions */}
          <div>
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px', marginBottom: '15px' }}>
              <h3 style={{ color: '#ff6600', margin: '0 0 15px', fontSize: '1rem' }}>Product Matches ({editProducts.length})</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px', maxHeight: '180px', overflowY: 'auto' }}>
                {editProducts.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a', padding: '10px 12px', borderRadius: '8px' }}>
                    <span style={{ color: '#fff', fontSize: '0.9rem' }}>{p}</span>
                    <button onClick={() => removeProduct(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                  </div>
                ))}
                {editProducts.length === 0 && <p style={{ color: '#666', textAlign: 'center', padding: '15px' }}>No products</p>}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                <input type="text" value={newProduct} onChange={(e) => setNewProduct(e.target.value)} placeholder="Add product..." style={{ flex: 1, background: '#0d0d0d', border: '1px solid #333', borderRadius: '6px', padding: '10px', color: '#fff', fontSize: '0.85rem' }} onKeyDown={(e) => e.key === 'Enter' && addProduct()} />
                <button onClick={addProduct} style={{ background: '#a855f7', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 15px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
              </div>

              {catalog && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '120px', overflowY: 'auto' }}>
                  {Object.entries(catalog.categories || {}).map(([key, cat]) => 
                    cat.products?.slice(0, 4).map(p => (
                      <button key={p.sku} onClick={() => !editProducts.includes(p.name) && setEditProducts([...editProducts, p.name])} style={{ padding: '4px 8px', background: editProducts.includes(p.name) ? '#333' : '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: editProducts.includes(p.name) ? '#555' : '#888', fontSize: '0.7rem', cursor: 'pointer' }}>
                        {p.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {current?.vision_analysis?.products?.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '15px', marginBottom: '15px' }}>
                <h4 style={{ color: '#a855f7', margin: '0 0 10px', fontSize: '0.9rem' }}>🧠 AI Reasoning</h4>
                {current.vision_analysis.products.slice(0, 3).map((p, i) => (
                  <div key={i} style={{ background: '#1a1a1a', padding: '8px 10px', borderRadius: '6px', marginBottom: '6px' }}>
                    <div style={{ color: '#ff6600', fontSize: '0.8rem' }}>{p.name}</div>
                    <div style={{ color: '#666', fontSize: '0.75rem' }}>{p.reason}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => graduate(true)} style={{ width: '100%', background: '#22c55e', color: '#000', border: 'none', borderRadius: '8px', padding: '16px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
                ✓ Approve & Graduate
              </button>
              <button onClick={() => graduate(false)} style={{ width: '100%', background: '#f59e0b', color: '#000', border: 'none', borderRadius: '8px', padding: '16px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
                💾 Save Edits & Graduate
              </button>
              <button onClick={skip} style={{ width: '100%', background: '#333', color: '#888', border: 'none', borderRadius: '8px', padding: '12px', cursor: 'pointer' }}>
                Skip →
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '15px', marginTop: '15px' }}>
              <button onClick={graduateAll} style={{ width: '100%', background: '#1a1a1a', color: '#888', border: '1px solid #333', borderRadius: '6px', padding: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                Graduate All {leads.length} (Trust AI)
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '15px' }}>
                <div style={{ background: '#1a1a1a', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ color: '#a855f7', fontSize: '1.2rem', fontWeight: 'bold' }}>{stats.corrected}</div>
                  <div style={{ color: '#666', fontSize: '0.7rem' }}>AI Corrections</div>
                </div>
                <div style={{ background: '#1a1a1a', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ color: '#22c55e', fontSize: '1.2rem', fontWeight: 'bold' }}>{stats.total > 0 ? Math.round((stats.graduated / stats.total) * 100) : 0}%</div>
                  <div style={{ color: '#666', fontSize: '0.7rem' }}>Complete</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
