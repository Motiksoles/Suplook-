import { useState, useRef, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// SUPLOOK OPERATIONS UI
// For: Scraping, sending campaigns, managing leads
// Port: 5173
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#111', border: '1px solid #333', borderRadius: '12px', padding: '40px', width: '360px', textAlign: 'center' }}>
        <svg width="80" height="80" viewBox="0 0 200 200" style={{ marginBottom: '10px' }}>
          <path d="M 15 100 Q 40 55 100 50 Q 160 55 185 100 Q 160 145 100 150 Q 40 145 15 100 Z" fill="#ffffff"/>
          <path d="M 15 100 Q 40 55 100 50 Q 160 55 185 100" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round"/>
          <path d="M 15 100 Q 40 145 100 150 Q 160 145 185 100" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round"/>
          <circle cx="100" cy="100" r="38" fill="#10b981"/>
          <circle cx="96" cy="96" r="22" fill="none" stroke="#ffffff" strokeWidth="3"/>
          <circle cx="96" cy="96" r="20" fill="#4a90d9"/>
          <circle cx="96" cy="96" r="12" fill="#2563eb"/>
          <circle cx="96" cy="96" r="6" fill="#0a0a0a"/>
          <circle cx="88" cy="88" r="5" fill="rgba(255,255,255,0.4)"/>
          <line x1="113" y1="113" x2="125" y2="125" stroke="#ffffff" strokeWidth="5" strokeLinecap="round"/>
          <line x1="113" y1="113" x2="125" y2="125" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <h1 style={{ color: '#10b981', margin: '0 0 5px', fontSize: '1.5rem' }}>Suplook</h1>
        <p style={{ color: '#666', margin: '0 0 30px', fontSize: '0.85rem' }}>AI looks. You supply.</p>
        
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
          style={{ width: '100%', padding: '12px', background: loading ? '#333' : '#10b981', color: '#000', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: loading ? 'wait' : 'pointer' }}
        >
          {loading ? 'Connecting...' : 'Login'}
        </button>
        
        <p style={{ color: '#444', fontSize: '0.75rem', marginTop: '20px' }}>Server: {SERVER_URL}</p>
      </div>
    </div>
  );
}

export default function OperationsApp() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('suplook_api_key') || '');
  const [accessLevel, setAccessLevel] = useState(() => localStorage.getItem('suplook_access_level') || '');
  const [activeTab, setActiveTab] = useState('scrape');
  const [globalRunning, setGlobalRunning] = useState(false); // Track scrape status globally
  
  // Check if logged in
  if (!apiKey) {
    return <LoginScreen onLogin={(key, level) => { setApiKey(key); setAccessLevel(level); }} />;
  }
  
  const logout = () => {
    localStorage.removeItem('suplook_api_key');
    localStorage.removeItem('suplook_access_level');
    setApiKey('');
    setAccessLevel('');
  };
  
  const tabs = [
    { id: 'scrape', label: 'Scrape & Enrich', icon: '🚀', color: '#10b981' },
    { id: 'leads', label: 'Leads', icon: '📋', color: '#a855f7' },
    { id: 'email', label: 'Email', icon: '📧', color: '#06b6d4' },
    { id: 'sms', label: 'SMS', icon: '📞', color: '#22c55e' },
    { id: 'inbox', label: 'Inbox', icon: '📥', color: '#f59e0b' },
    { id: 'meta', label: 'Meta Ads', icon: '📣', color: '#ec4899' },
    { id: 'salesforce', label: 'Salesforce', icon: '☁️', color: '#00a1e0' },
    { id: 'settings', label: 'Settings', icon: '⚙️', color: '#888' },
  ];

  // Count pending graduation
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    const check = () => {
      const leads = JSON.parse(localStorage.getItem('suplook_enriched') || '[]');
      setPendingCount(leads.filter(l => !l.graduated).length);
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)', fontFamily: 'system-ui, sans-serif', color: '#fff' }}>
      <div style={{ background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid #333', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="40" height="40" viewBox="0 0 200 200">
            <path d="M 15 100 Q 40 55 100 50 Q 160 55 185 100 Q 160 145 100 150 Q 40 145 15 100 Z" fill="#ffffff"/>
            <path d="M 15 100 Q 40 55 100 50 Q 160 55 185 100" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round"/>
            <path d="M 15 100 Q 40 145 100 150 Q 160 145 185 100" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round"/>
            <circle cx="100" cy="100" r="38" fill="#10b981"/>
            <circle cx="96" cy="96" r="22" fill="none" stroke="#ffffff" strokeWidth="3"/>
            <circle cx="96" cy="96" r="20" fill="#4a90d9"/>
            <circle cx="96" cy="96" r="12" fill="#2563eb"/>
            <circle cx="96" cy="96" r="6" fill="#0a0a0a"/>
            <circle cx="88" cy="88" r="5" fill="rgba(255,255,255,0.4)"/>
            <line x1="113" y1="113" x2="125" y2="125" stroke="#ffffff" strokeWidth="5" strokeLinecap="round"/>
            <line x1="113" y1="113" x2="125" y2="125" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <div>
            <h1 style={{ color: '#10b981', margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Suplook Operations</h1>
            <p style={{ color: '#666', margin: 0, fontSize: '0.75rem' }}>Visual AI for Distributors</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {pendingCount > 0 && (
            <div style={{ background: '#f59e0b', color: '#000', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              {pendingCount} pending graduation
            </div>
          )}
          <a href="http://localhost:5174" target="_blank" rel="noopener noreferrer" style={{ background: '#a855f7', color: '#fff', padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 'bold' }}>
            🎓 Training UI
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#666', fontSize: '0.75rem' }}>{accessLevel === 'admin' ? '👑 Admin' : '👤 User'}</span>
            <button onClick={logout} style={{ background: '#333', color: '#888', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>Logout</button>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '4px', padding: '10px 20px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid #222', overflowX: 'auto', alignItems: 'center' }}>
        {globalRunning && (
          <div style={{ background: '#10b981', color: '#000', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', marginRight: '10px', animation: 'pulse 2s infinite' }}>
            🔄 Scraping...
          </div>
        )}
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: activeTab === tab.id ? tab.color : 'transparent', color: activeTab === tab.id ? '#000' : '#888', border: activeTab === tab.id ? 'none' : '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontWeight: activeTab === tab.id ? 'bold' : 'normal', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>
      
      <div style={{ padding: '20px' }}>
        {activeTab === 'scrape' && <ScrapeEnrichTab globalRunning={globalRunning} setGlobalRunning={setGlobalRunning} />}
        {activeTab === 'leads' && <LeadsTab />}
        {activeTab === 'email' && <EmailTab />}
        {activeTab === 'sms' && <SMSOutreachTab />}
        {activeTab === 'inbox' && <InboxTab />}
        {activeTab === 'meta' && <MetaTab />}
        {activeTab === 'salesforce' && <SalesforceTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED STYLES & COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const inputStyle = { width: '100%', background: '#0d0d0d', border: '1px solid #333', borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box' };
const btnStyle = (bg) => ({ width: '100%', background: bg, color: bg === '#333' ? '#888' : '#fff', border: 'none', borderRadius: '6px', padding: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' });
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' };
const thStyle = { textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #333', color: '#888' };
const tdStyle = { padding: '10px 8px', color: '#fff' };

const Card = ({ title, children }) => (
  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #222', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
    {title && <h3 style={{ color: '#10b981', margin: '0 0 12px', fontSize: '0.9rem' }}>{title}</h3>}
    {children}
  </div>
);

const StatRow = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #222' }}>
    <span style={{ color: '#888' }}>{label}</span>
    <span style={{ color: color || '#fff', fontWeight: 'bold' }}>{value}</span>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// SCRAPE & ENRICH TAB
// ═══════════════════════════════════════════════════════════════════════════

function ScrapeEnrichTab({ globalRunning, setGlobalRunning }) {
  const [mode, setMode] = useState('upload');
  const [leads, setLeads] = useState([]);
  const [enriched, setEnriched] = useState([]);
  const [log, setLog] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
  
  // Use globalRunning instead of local running state
  const running = globalRunning;
  const setRunning = setGlobalRunning;
  
  const [googleApiKey, setGoogleApiKey] = useState(() => localStorage.getItem('suplook_google_key') || '');
  const [visionServer, setVisionServer] = useState(() => localStorage.getItem('suplook_server') || SERVER_URL);
  const [useVisionAI, setUseVisionAI] = useState(true);
  const [batchSize, setBatchSize] = useState(10);
  const [shuffle, setShuffle] = useState(true);
  const [zipCodes, setZipCodes] = useState('');
  const [cuisineFilter, setCuisineFilter] = useState('restaurant');
  const [selectedZipArea, setSelectedZipArea] = useState(null);
  
  // Get auth key for API calls
  const authKey = localStorage.getItem('suplook_api_key') || '';
  const authHeaders = { 'Content-Type': 'application/json', 'x-api-key': authKey };
  
  const fileRef = useRef(null);
  const addLog = (msg, type = 'info') => setLog(prev => [...prev.slice(-100), { msg, type, time: new Date().toLocaleTimeString() }]);

  // Fetch API key from server on load
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const resp = await fetch(`${visionServer}/config`, { headers: { 'x-api-key': authKey } });
        const data = await resp.json();
        if (data.googleApiKey && !googleApiKey) {
          setGoogleApiKey(data.googleApiKey);
          localStorage.setItem('suplook_google_key', data.googleApiKey);
        }
      } catch {}
    };
    fetchConfig();
  }, []);
  
  const zipAreas = [
    { label: '🏙️ Jersey City/Newark', zips: '07102,07103,07104,07105,07106,07107,07108,07109,07110,07111,07112,07114,07302,07304,07305,07306,07307,07310,07311' },
    { label: '🏭 North Jersey', zips: '07003,07006,07009,07014,07017,07018,07021,07028,07029,07030,07031,07032,07035,07036,07039,07040,07041,07042,07043,07044,07047,07050,07052,07055,07060,07062,07063,07064,07065,07066,07067,07068,07070,07071,07072,07073,07074,07075,07076,07077,07078,07079,07080,07081,07083,07086,07087,07088,07090,07091,07092,07093,07094,07095' },
    { label: '🌊 Shore/Monmouth', zips: '07701,07702,07703,07704,07711,07712,07716,07717,07718,07719,07720,07721,07722,07723,07724,07726,07727,07728,07730,07731,07732,07733,07734,07735,07737,07738,07739,07740,07746,07747,07748,07750,07751,07753,07755,07756,07757,07758,07760,07762,07764' },
    { label: '🏢 Central Jersey', zips: '08526,08536,08810,08812,08816,08817,08820,08824,08828,08830,08831,08832,08837,08840,08846,08850,08852,08854,08855,08857,08859,08861,08862,08863,08871,08872,08877,08879,08882,08884,08899,08901,08902,08903,08904,08905,08906' },
    { label: '🔔 Philly', zips: '19106,19116,19123,19125,19127,19129' },
    { label: '🏠 Bergen County', zips: '07401,07407,07410,07417,07423,07424,07430,07432,07436,07446,07450,07451,07452,07458,07463,07481,07495,07601,07602,07603,07604,07605,07606,07607,07608,07620,07621,07624,07626,07627,07628,07630,07631,07632,07640,07641,07642,07643,07644,07645,07646,07647,07648,07649,07650,07652,07653,07656,07657,07660,07661,07662,07663,07666,07670,07675,07676,07677' },
    { label: '🏗️ Passaic/Paterson', zips: '07501,07502,07503,07504,07505,07506,07508,07512,07513,07522,07524' },
  ];
  
  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const vals = line.match(/(".*?"|[^,]+)/g) || [];
      const obj = {};
      headers.forEach((h, i) => obj[h] = (vals[i] || '').replace(/"/g, '').trim());
      return obj;
    }).filter(r => r.DBA || r.name || r['Restaurant Name']);
  };
  
  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => { const parsed = parseCSV(evt.target.result); setLeads(parsed); addLog(`Loaded ${parsed.length} leads from CSV`, 'success'); };
    reader.readAsText(file);
  };
  
  const analyzeWithVisionAI = async (photoRef, name) => {
    try {
      const resp = await fetch(`${visionServer}/analyze/google-photo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoReference: photoRef, restaurantName: name, googleApiKey: apiKey }) });
      if (!resp.ok) return null;
      return await resp.json();
    } catch { return null; }
  };
  
  const fallbackProductMatch = (name, types = []) => {
    const n = (name || '').toLowerCase();
    const t = types.join(' ').toLowerCase();
    if (n.includes('pizza') || t.includes('pizza')) return { products: ['Pizza Box 16"', 'Pizza Box 14"', 'Pizza Saver'], detected_cuisine: 'pizza' };
    if (n.includes('chinese') || n.includes('wok') || t.includes('chinese')) return { products: ['Chinese Takeout Box 32oz', 'Chopsticks Wrapped', 'Soy Sauce Packet'], detected_cuisine: 'chinese' };
    if (n.includes('taco') || n.includes('mexican') || n.includes('burrito')) return { products: ['Foil Sheet 12x12', 'Portion Cup 2oz', 'Hot Sauce Packet'], detected_cuisine: 'mexican' };
    if (n.includes('coffee') || n.includes('cafe') || t.includes('cafe')) return { products: ['Paper Hot Cup 12oz', 'Hot Cup Lid Sip', 'Cup Sleeve Kraft'], detected_cuisine: 'cafe' };
    if (n.includes('deli') || n.includes('sandwich') || n.includes('bagel')) return { products: ['Deli Paper 12x12', 'Paper Bag Kraft', 'Toothpick Frilled'], detected_cuisine: 'deli' };
    if (n.includes('bar') || n.includes('pub') || t.includes('bar')) return { products: ['Beverage Napkin', 'Straw Black 8"', 'Cocktail Pick'], detected_cuisine: 'bar' };
    return { products: ['Foam Container 9x9', 'Utensil Kit', 'Paper Bag Kraft'], detected_cuisine: 'general' };
  };
  
  const findEmailsInHtml = (html) => {
    const emails = new Set();
    const mailtoMatches = html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
    for (const m of mailtoMatches) emails.add(m[1].toLowerCase());
    const textMatches = html.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    for (const m of textMatches) emails.add(m[0].toLowerCase());
    const validEmails = [...emails].filter(e => {
      const junk = ['example.com', 'domain.com', 'email.com', 'yoursite.com', 'website.com', 'sentry.io', 'wixpress.com', 'squarespace.com', 'wordpress.com', 'jquery.com', 'w3.org', 'schema.org', 'googleusercontent.com', 'placeholder', 'test@', 'admin@admin', 'user@user', 'noreply@'];
      return !junk.some(j => e.includes(j)) && !e.startsWith('info@info') && e.length < 50;
    });
    return validEmails.sort((a, b) => {
      const priority = ['info@', 'contact@', 'hello@', 'orders@', 'reservations@', 'events@', 'catering@'];
      const aScore = priority.findIndex(p => a.startsWith(p));
      const bScore = priority.findIndex(p => b.startsWith(p));
      return (aScore === -1 ? 99 : aScore) - (bScore === -1 ? 99 : bScore);
    });
  };

  const runPipeline = async () => {
    setRunning(true);
    setEnriched([]);
    setLog([]);
    
    // Check server connection
    let serverAvailable = false;
    try {
      const resp = await fetch(`${visionServer}/health`);
      serverAvailable = (await resp.json()).status === 'ok';
      addLog(`🔗 Server: ${serverAvailable ? 'Connected' : 'Not available'}`, serverAvailable ? 'success' : 'error');
    } catch { 
      addLog('❌ Server not running! Start suplook-server first.', 'error'); 
      setRunning(false);
      return;
    }
    
    if (mode === 'scrape') {
      // SERVER-SIDE SCRAPE - No CORS issues!
      const zips = zipCodes.split(/[,\n]/).map(z => z.trim()).filter(z => z);
      
      if (zips.length === 0) {
        addLog('❌ No zip codes selected', 'error');
        setRunning(false);
        return;
      }
      
      addLog(`🚀 Starting server-side scrape...`, 'info');
      addLog(`📍 Zip codes: ${zips.length}`, 'info');
      addLog(`🍽️ Cuisine: ${cuisineFilter}`, 'info');
      addLog(`📊 Batch size: ${batchSize}`, 'info');
      addLog(``, 'info');
      addLog(`⏳ This runs entirely on server (no CORS issues)...`, 'info');
      
      setProgress({ current: 0, total: 1, phase: 'Server scraping...' });
      
      try {
        const resp = await fetch(`${visionServer}/scrape/places`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            zipCodes: zips,
            cuisine: cuisineFilter,
            batchSize: batchSize,
            shuffle: shuffle
          })
        });
        
        const result = await resp.json();
        
        if (result.success) {
          // Add message templates to each lead
          const enrichedLeads = result.leads.map(lead => {
            const firstName = (lead.name || '').split(/['s\s]/)[0];
            return {
              ...lead,
              phone_display: lead.phone,
              phone: (lead.phone || '').replace(/\D/g, ''),
              sms_message: `Hi ${firstName}, this is Suplook. Need ${lead.products?.[0] || 'supplies'}? Free delivery. Reply YES for info`,
              email_subject: 'Quick question about your supply needs',
              email_body: `Hi ${firstName},\n\nI noticed your restaurant and thought you might need:\n- ${(lead.products || []).join('\n- ')}\n\nWould you like to learn more?\n\nBest,\nSuplook`,
              status: { sms: 'pending', email: 'pending' }
            };
          });
          
          setEnriched(enrichedLeads);
          
          addLog(``, 'info');
          addLog(`═══════════════════════════════════════════`, 'info');
          addLog(`✅ SCRAPE COMPLETE!`, 'success');
          addLog(`   Total: ${result.total} leads`, 'info');
          addLog(`   🔥 Tier 1 (Yelp photos): ${result.tier1}`, 'success');
          addLog(`   ✅ Tier 2 (Instagram/Delivery): ${result.tier2}`, 'info');
          addLog(`   📋 Tier 3 (Rule-based): ${result.tier3}`, 'info');
          addLog(`═══════════════════════════════════════════`, 'info');
          addLog(``, 'info');
          addLog(`👉 Go to Training UI to graduate leads!`, 'success');
        } else {
          addLog(`❌ Scrape failed: ${result.error}`, 'error');
        }
      } catch (err) {
        addLog(`❌ Server error: ${err.message}`, 'error');
      }
      
    } else {
      // CSV UPLOAD MODE - send to server for enrichment
      if (leads.length === 0) {
        addLog('❌ No CSV uploaded', 'error');
        setRunning(false);
        return;
      }
      
      let toProcess = shuffle ? [...leads].sort(() => Math.random() - 0.5) : [...leads];
      toProcess = toProcess.slice(0, batchSize);
      addLog(`📄 Loaded ${toProcess.length} leads from CSV`, 'info');
      
      addLog('🔍 Sending to server for enrichment...', 'info');
      setProgress({ current: 0, total: toProcess.length, phase: 'Enriching...' });
      
      try {
        const enrichResp = await fetch(`${visionServer}/enrich/batch`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ 
            restaurants: toProcess,
            batchId: `batch_${Date.now()}`
          })
        });
        
        const result = await enrichResp.json();
        
        if (result.success) {
          const enrichedLeads = result.leads.map(lead => {
            const firstName = (lead.name || '').split(/['s\s]/)[0];
            return {
              ...lead,
              phone_display: lead.phone,
              phone: (lead.phone || '').replace(/\D/g, ''),
              sms_message: `Hi ${firstName}, this is Suplook. Need ${lead.products?.[0] || 'supplies'}? Free delivery. Reply YES for info`,
              email_subject: 'Quick question about your supply needs',
              email_body: `Hi ${firstName},\n\nI noticed your restaurant and thought you might need:\n- ${(lead.products || []).join('\n- ')}\n\nWould you like to learn more?\n\nBest,\nSuplook`,
              status: { sms: 'pending', email: 'pending' }
            };
          });
          
          setEnriched(enrichedLeads);
          
          addLog(`✅ Enrichment complete: ${result.total} leads`, 'success');
          addLog(`   Tier 1: ${result.tier1} | Tier 2: ${result.tier2} | Tier 3: ${result.tier3}`, 'info');
        } else {
          addLog(`❌ Enrichment failed: ${result.error}`, 'error');
        }
      } catch (err) {
        addLog(`❌ Server error: ${err.message}`, 'error');
      }
    }
    
    setProgress({ current: 0, total: 0, phase: '' });
    setRunning(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr 280px', gap: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Card title="1. Data Source">
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button onClick={() => setMode('upload')} style={{ flex: 1, padding: '12px', background: mode === 'upload' ? '#10b981' : '#1a1a1a', color: mode === 'upload' ? '#000' : '#888', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📄 CSV</button>
            <button onClick={() => setMode('scrape')} style={{ flex: 1, padding: '12px', background: mode === 'scrape' ? '#10b981' : '#1a1a1a', color: mode === 'scrape' ? '#000' : '#888', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🔍 Zips</button>
          </div>
          {mode === 'upload' ? (
            <><input type="file" accept=".csv" ref={fileRef} onChange={handleUpload} style={{ display: 'none' }} /><button onClick={() => fileRef.current?.click()} style={btnStyle('#1a1a1a')}>Upload CSV ({leads.length})</button></>
          ) : (
            <>
              <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '10px' }}>
                {zipAreas.map((area, i) => (<div key={i} onClick={() => { setSelectedZipArea(i); setZipCodes(area.zips); }} style={{ padding: '8px 10px', marginBottom: '4px', background: selectedZipArea === i ? 'rgba(255,102,0,0.2)' : '#1a1a1a', border: selectedZipArea === i ? '1px solid #10b981' : '1px solid #333', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>{area.label}</div>))}
              </div>
              <select value={cuisineFilter} onChange={(e) => setCuisineFilter(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }}>
                <option value="restaurant">All</option>
                <option value="pizza">Pizza</option>
                <option value="chinese restaurant">Chinese</option>
                <option value="mexican restaurant">Mexican</option>
                <option value="cafe coffee">Cafe</option>
                <option value="bar pub">Bar</option>
              </select>
            </>
          )}
        </Card>
        <Card title="2. API & Vision">
          <input type="password" placeholder="Google API Key" value={googleApiKey} onChange={(e) => setGoogleApiKey(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} />
          <input type="text" placeholder="Vision Server" value={visionServer} onChange={(e) => setVisionServer(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={useVisionAI} onChange={(e) => setUseVisionAI(e.target.checked)} />
            <span style={{ color: useVisionAI ? '#22c55e' : '#666' }}>🧠</span> Use Vision AI
          </label>
        </Card>
        <Card title="3. Batch">
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{[10, 25, 50, 100, 500, 'All'].map(n => (<button key={n} onClick={() => setBatchSize(n === 'All' ? 99999 : n)} style={{ padding: '8px 14px', background: (n === 'All' && batchSize === 99999) || batchSize === n ? '#10b981' : '#1a1a1a', color: (n === 'All' && batchSize === 99999) || batchSize === n ? '#000' : '#888', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer' }}>{n}</button>))}</div>
        </Card>
        <button onClick={runPipeline} disabled={running} style={{ ...btnStyle(running ? '#333' : '#10b981'), padding: '16px', fontSize: '1rem' }}>{running ? `Processing... ${progress.current}/${progress.total}` : '🚀 Run Pipeline'}</button>
        <Card title="Results">
          <StatRow label="Total" value={enriched.length} color="#10b981" />
          <StatRow label="Vision AI" value={enriched.filter(e => e.vision_analysis).length} color="#a855f7" />
          <StatRow label="Tier 1 (Packaging)" value={enriched.filter(e => e.photo_tier === 1).length} color="#22c55e" />
          <StatRow label="Tier 2 (Equipment)" value={enriched.filter(e => e.photo_tier === 2).length} color="#06b6d4" />
          <StatRow label="Tier 3 (Rule-based)" value={enriched.filter(e => e.photo_tier === 3).length} color="#888" />
        </Card>
      </div>
      
      <Card title={`Leads (${enriched.length})`}>
        <div style={{ height: '600px', overflowY: 'auto' }}>
          {enriched.length === 0 ? <p style={{ color: '#666', textAlign: 'center', padding: '60px' }}>Run pipeline to see leads</p> : (
            <table style={tableStyle}>
              <thead><tr><th style={thStyle}>Name</th><th style={thStyle}>Email</th><th style={thStyle}>Phone</th><th style={thStyle}>Products</th><th style={thStyle}>Tier</th></tr></thead>
              <tbody>
                {enriched.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                    <td style={tdStyle}>{l.name}</td>
                    <td style={{ ...tdStyle, color: l.email ? '#06b6d4' : '#444' }}>{l.email || '-'}</td>
                    <td style={{ ...tdStyle, color: l.phone ? '#22c55e' : '#444' }}>{l.phone_display || '-'}</td>
                    <td style={{ ...tdStyle, color: '#10b981' }}>{l.products?.length || 0}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', background: l.photo_tier === 1 ? '#22c55e' : l.photo_tier === 2 ? '#06b6d4' : '#333' }}>
                        {l.photo_tier === 1 ? '🔥' : l.photo_tier === 2 ? '✅' : '📋'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
      
      <Card title="Log">
        <div style={{ background: '#0a0a0a', borderRadius: '6px', padding: '10px', height: '600px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.7rem' }}>
          {log.map((l, i) => <div key={i} style={{ color: l.type === 'error' ? '#ef4444' : l.type === 'success' ? '#22c55e' : '#888', marginBottom: '4px' }}><span style={{ color: '#444' }}>{l.time}</span> {l.msg}</div>)}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADS TAB - View all leads, filter by status, track outcomes
// ═══════════════════════════════════════════════════════════════════════════

function LeadsTab() {
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState(null);
  const [stats, setStats] = useState(null);
  const visionServer = localStorage.getItem('suplook_server') || 'http://localhost:3009';
  
  const loadLeads = async () => {
    try {
      const resp = await fetch(`${visionServer}/leads`);
      const data = await resp.json();
      setLeads(data.leads || []);
    } catch {
      const saved = localStorage.getItem('suplook_enriched');
      if (saved) setLeads(JSON.parse(saved));
    }
  };
  
  const loadStats = async () => {
    try {
      const resp = await fetch(`${visionServer}/stats/outcomes`);
      setStats(await resp.json());
    } catch {}
  };
  
  useEffect(() => { loadLeads(); loadStats(); }, []);
  
  const filteredLeads = leads.filter(l => {
    if (filter === 'graduated') return l.graduated;
    if (filter === 'pending') return !l.graduated;
    if (filter === 'tier1') return l.photo_tier === 1;
    if (filter === 'tier2') return l.photo_tier === 2;
    if (filter === 'tier3') return l.photo_tier === 3;
    if (filter === 'no_outcome') return l.graduated && !l.outcome;
    if (filter === 'replied') return l.outcome === 'replied';
    if (filter === 'sold') return l.outcome === 'sold';
    if (filter === 'lost') return l.outcome === 'lost';
    return true;
  });
  
  const clearAll = async () => {
    if (confirm('Delete all leads?')) {
      try {
        await fetch(`${visionServer}/leads`, { method: 'DELETE' });
      } catch {}
      localStorage.removeItem('suplook_enriched');
      setLeads([]);
    }
  };
  
  const updateOutcome = async (leadId, outcome) => {
    try {
      await fetch(`${visionServer}/leads/${leadId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome })
      });
      loadLeads();
      loadStats();
    } catch (err) {
      console.error('Failed to update outcome:', err);
    }
  };
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '20px' }}>
      <div>
        <Card title="Filter">
          {[
            { id: 'all', label: 'All Leads', count: leads.length },
            { id: 'pending', label: '⏳ Pending Graduation', count: leads.filter(l => !l.graduated).length },
            { id: 'graduated', label: '✅ Graduated', count: leads.filter(l => l.graduated).length },
            { id: 'no_outcome', label: '📤 Needs Outcome', count: leads.filter(l => l.graduated && !l.outcome).length },
            { id: 'replied', label: '💬 Replied', count: leads.filter(l => l.outcome === 'replied').length },
            { id: 'sold', label: '💰 Sold', count: leads.filter(l => l.outcome === 'sold').length },
            { id: 'lost', label: '❌ Lost', count: leads.filter(l => l.outcome === 'lost').length },
          ].map(f => (
            <div key={f.id} onClick={() => setFilter(f.id)} style={{ padding: '10px', marginBottom: '6px', background: filter === f.id ? 'rgba(255,102,0,0.2)' : '#1a1a1a', border: filter === f.id ? '1px solid #10b981' : '1px solid #333', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
              <span>{f.label}</span>
              <span style={{ color: '#10b981' }}>{f.count}</span>
            </div>
          ))}
        </Card>
        
        {stats && (
          <Card title="📊 Stats">
            <div style={{ fontSize: '0.85rem', color: '#888' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Reply Rate:</span>
                <span style={{ color: '#22c55e' }}>{stats.reply_rate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>Conversion:</span>
                <span style={{ color: '#10b981' }}>{stats.conversion_rate}</span>
              </div>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px', marginTop: '8px' }}>
                <div style={{ marginBottom: '4px' }}>By Tier:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🔥 T1:</span>
                  <span>{stats.by_tier?.tier1?.sold || 0}/{stats.by_tier?.tier1?.total || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>✅ T2:</span>
                  <span>{stats.by_tier?.tier2?.sold || 0}/{stats.by_tier?.tier2?.total || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>📋 T3:</span>
                  <span>{stats.by_tier?.tier3?.sold || 0}/{stats.by_tier?.tier3?.total || 0}</span>
                </div>
              </div>
            </div>
          </Card>
        )}
        
        <button onClick={clearAll} style={{ ...btnStyle('#ef4444'), marginTop: '10px' }}>🗑️ Clear All Leads</button>
      </div>
      
      <Card title={`${filter === 'all' ? 'All' : filter} (${filteredLeads.length})`}>
        <div style={{ height: '600px', overflowY: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Name</th><th style={thStyle}>Cuisine</th><th style={thStyle}>Products</th><th style={thStyle}>Tier</th><th style={thStyle}>Yelp</th><th style={thStyle}>Outcome</th><th style={thStyle}>Actions</th></tr></thead>
            <tbody>
              {filteredLeads.map((l, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                  <td style={tdStyle}>
                    <div>{l.name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#666' }}>{l.address?.slice(0, 30)}</div>
                  </td>
                  <td style={{ ...tdStyle, color: '#888' }}>{l.detected_cuisine}</td>
                  <td style={{ ...tdStyle, color: '#10b981' }}>{l.products?.length || 0}</td>
                  <td style={tdStyle}><span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', background: l.photo_tier === 1 ? '#22c55e' : l.photo_tier === 2 ? '#06b6d4' : '#333' }}>{l.photo_tier}</span></td>
                  <td style={tdStyle}>
                    {l.yelp_url ? (
                      <a href={l.yelp_url} target="_blank" rel="noopener noreferrer" style={{ color: '#ef4444', fontSize: '0.75rem' }}>
                        ⭐ {l.yelp_rating || '?'}
                      </a>
                    ) : '-'}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      fontSize: '0.75rem', 
                      background: l.outcome === 'sold' ? '#22c55e' : l.outcome === 'replied' ? '#06b6d4' : l.outcome === 'lost' ? '#ef4444' : l.graduated ? '#f59e0b' : '#333',
                      color: '#000'
                    }}>
                      {l.outcome || (l.graduated ? 'Waiting' : 'Pending')}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {l.graduated && !l.outcome && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => updateOutcome(l.id, 'replied')} style={{ padding: '2px 6px', background: '#06b6d4', border: 'none', borderRadius: '3px', color: '#000', fontSize: '0.65rem', cursor: 'pointer' }}>💬</button>
                        <button onClick={() => updateOutcome(l.id, 'sold')} style={{ padding: '2px 6px', background: '#22c55e', border: 'none', borderRadius: '3px', color: '#000', fontSize: '0.65rem', cursor: 'pointer' }}>💰</button>
                        <button onClick={() => updateOutcome(l.id, 'no_reply')} style={{ padding: '2px 6px', background: '#666', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '0.65rem', cursor: 'pointer' }}>✗</button>
                        <button onClick={() => updateOutcome(l.id, 'lost')} style={{ padding: '2px 6px', background: '#ef4444', border: 'none', borderRadius: '3px', color: '#000', fontSize: '0.65rem', cursor: 'pointer' }}>❌</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL TAB
// ═══════════════════════════════════════════════════════════════════════════

function EmailTab() {
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState(new Set());
  useEffect(() => { const saved = localStorage.getItem('suplook_enriched'); if (saved) setLeads(JSON.parse(saved).filter(l => l.graduated)); }, []);
  const toggleSelect = (id) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSelected(n); };
  const selectAll = () => setSelected(selected.size === leads.length ? new Set() : new Set(leads.map(l => l.id)));
  const exportCSV = () => {
    const toExport = leads.filter(l => selected.has(l.id) && l.email);
    if (!toExport.length) return alert('Select graduated leads with email');
    const csv = ['email,first_name,company_name,custom_1,custom_2', ...toExport.map(l => [l.email, l.name.split(/['s\s]/)[0], l.name, l.email_subject, l.email_body.replace(/\n/g, '\\n')].map(v => `"${v}"`).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'instantly_export.csv'; a.click();
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
      <div>
        <Card title="Export">
          <StatRow label="Graduated" value={leads.length} color="#22c55e" />
          <StatRow label="Selected" value={selected.size} color="#10b981" />
          <StatRow label="With Email" value={leads.filter(l => selected.has(l.id) && l.email).length} color="#06b6d4" />
          <button onClick={selectAll} style={{ ...btnStyle('#333'), marginTop: '10px' }}>{selected.size === leads.length ? 'Deselect' : 'Select All'}</button>
          <button onClick={exportCSV} disabled={!selected.size} style={{ ...btnStyle(selected.size ? '#06b6d4' : '#333'), marginTop: '10px' }}>📧 Export for Instantly</button>
        </Card>
        {leads.length === 0 && <Card><p style={{ color: '#f59e0b', fontSize: '0.85rem' }}>⚠️ Only graduated leads can be emailed. Use Training UI to graduate leads.</p></Card>}
      </div>
      <Card title="Graduated Leads">
        <div style={{ height: '500px', overflowY: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>✓</th><th style={thStyle}>Name</th><th style={thStyle}>Email</th><th style={thStyle}>Products</th></tr></thead>
            <tbody>{leads.map((l, i) => <tr key={i} style={{ borderBottom: '1px solid #222' }}><td style={tdStyle}><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} /></td><td style={tdStyle}>{l.name}</td><td style={{ ...tdStyle, color: l.email ? '#06b6d4' : '#444' }}>{l.email || '-'}</td><td style={{ ...tdStyle, color: '#10b981' }}>{l.products?.length}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SMS TAB
// ═══════════════════════════════════════════════════════════════════════════

function SMSOutreachTab() {
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState([]);
  const [serverUrl] = useState(() => localStorage.getItem('mcd_twilio_server') || 'http://localhost:3007');
  useEffect(() => { const saved = localStorage.getItem('suplook_enriched'); if (saved) setLeads(JSON.parse(saved).filter(l => l.phone && l.graduated)); }, []);
  const addLog = (msg, type) => setLog(prev => [...prev.slice(-50), { msg, type, time: new Date().toLocaleTimeString() }]);
  const toggleSelect = (id) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSelected(n); };
  const startSending = async () => {
    setSending(true); const toSend = leads.filter(l => selected.has(l.id));
    for (const lead of toSend) {
      try {
        addLog(`Sending to ${lead.phone_display}...`, 'info');
        const resp = await fetch(`${serverUrl}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: lead.phone, message: lead.sms_message }) });
        const data = await resp.json();
        if (data.success) { lead.status.sms = 'sent'; addLog(`✓ Sent`, 'success'); } else throw new Error(data.error);
      } catch (e) { lead.status.sms = 'failed'; addLog(`✗ Failed: ${e.message}`, 'error'); }
      setLeads([...leads]); await new Promise(r => setTimeout(r, 500));
    }
    localStorage.setItem('suplook_enriched', JSON.stringify(leads)); setSending(false);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: '20px' }}>
      <div>
        <Card title="Server"><input type="text" value={serverUrl} readOnly style={inputStyle} /><p style={{ color: '#666', fontSize: '0.75rem', marginTop: '8px' }}>Configure in Settings</p></Card>
        <Card title="Stats"><StatRow label="Graduated w/ Phone" value={leads.length} color="#22c55e" /><StatRow label="Selected" value={selected.size} color="#10b981" /></Card>
        <button onClick={startSending} disabled={sending || !selected.size} style={{ ...btnStyle(sending ? '#333' : '#22c55e'), padding: '16px' }}>{sending ? 'Sending...' : `📞 Send ${selected.size} SMS`}</button>
        {leads.length === 0 && <Card><p style={{ color: '#f59e0b', fontSize: '0.85rem' }}>⚠️ Only graduated leads can receive SMS.</p></Card>}
      </div>
      <Card title="Queue"><div style={{ height: '500px', overflowY: 'auto' }}><table style={tableStyle}><thead><tr><th style={thStyle}>✓</th><th style={thStyle}>Name</th><th style={thStyle}>Phone</th><th style={thStyle}>Status</th></tr></thead><tbody>{leads.map((l, i) => <tr key={i} style={{ borderBottom: '1px solid #222' }}><td style={tdStyle}><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} disabled={l.status?.sms === 'sent'} /></td><td style={tdStyle}>{l.name}</td><td style={{ ...tdStyle, color: '#22c55e' }}>{l.phone_display}</td><td style={tdStyle}><span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', background: l.status?.sms === 'sent' ? '#22c55e' : '#333' }}>{l.status?.sms || 'pending'}</span></td></tr>)}</tbody></table></div></Card>
      <Card title="Log"><div style={{ background: '#0a0a0a', borderRadius: '6px', padding: '10px', height: '500px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem' }}>{log.map((l, i) => <div key={i} style={{ color: l.type === 'error' ? '#ef4444' : l.type === 'success' ? '#22c55e' : '#888' }}>{l.time} {l.msg}</div>)}</div></Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INBOX TAB
// ═══════════════════════════════════════════════════════════════════════════

function InboxTab() {
  const [messages, setMessages] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [twilioServer] = useState(() => localStorage.getItem('mcd_twilio_server') || 'http://localhost:3007');
  
  const fetchMessages = async () => {
    try {
      const resp = await fetch(`${twilioServer}/incoming`);
      const data = await resp.json();
      const msgs = (data.messages || []).map(m => ({ ...m, source: 'sms', sourceColor: '#22c55e', pushedToSF: m.pushedToSF || false }));
      setMessages(msgs);
      msgs.forEach(m => { if (!m.pushedToSF) pushToSalesforce(m); });
    } catch {}
  };
  
  const pushToSalesforce = (msg) => {
    const sfQueue = JSON.parse(localStorage.getItem('mcd_salesforce_queue') || '[]');
    const leads = JSON.parse(localStorage.getItem('suplook_enriched') || '[]');
    const phone = msg.from?.replace(/\D/g, '');
    const matchedLead = leads.find(l => l.phone === phone || l.phone === phone?.slice(-10));
    if (sfQueue.find(q => q.phone === phone)) return;
    const sfLead = { id: `sf_${Date.now()}`, name: matchedLead?.name || msg.from, phone: msg.from, email: matchedLead?.email || '', website: matchedLead?.website || '', products: matchedLead?.products || [], detected_cuisine: matchedLead?.detected_cuisine || '', source: msg.source, firstReply: msg.body, replyTimestamp: msg.timestamp, status: 'new', pushedAt: new Date().toISOString() };
    sfQueue.unshift(sfLead);
    localStorage.setItem('mcd_salesforce_queue', JSON.stringify(sfQueue));
    msg.pushedToSF = true;
  };
  
  useEffect(() => { fetchMessages(); const i = setInterval(fetchMessages, 30000); return () => clearInterval(i); }, []);
  
  const sendReply = async () => {
    if (!replyText.trim() || !replyTo) return;
    setSending(true);
    try {
      await fetch(`${twilioServer}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: replyTo.from, message: replyText }) });
      alert('Reply sent!');
      setReplyTo(null);
      setReplyText('');
    } catch (e) { alert('Failed: ' + e.message); }
    setSending(false);
  };
  
  const sfQueue = JSON.parse(localStorage.getItem('mcd_salesforce_queue') || '[]');
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px', maxWidth: '1100px', margin: '0 auto' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ color: '#f59e0b', margin: 0 }}>📥 Inbox</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ color: '#22c55e', fontSize: '0.8rem' }}>🚀 {sfQueue.length} in Salesforce queue</span>
            <button onClick={fetchMessages} style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer' }}>↻ Refresh</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '550px', overflowY: 'auto' }}>
          {messages.length === 0 ? <p style={{ color: '#666', textAlign: 'center', padding: '60px' }}>No replies yet. Replies auto-push to Salesforce.</p> : messages.map((m, i) => (
            <div key={i} onClick={() => { setReplyTo(m); setReplyText(''); }} style={{ background: replyTo === m ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)', border: replyTo === m ? '1px solid #f59e0b' : '1px solid #333', borderRadius: '10px', padding: '14px 16px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ background: m.sourceColor, color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>📞 SMS</span>
                  {m.pushedToSF && <span style={{ background: '#00a1e0', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem' }}>☁️ SF</span>}
                </div>
                <span style={{ color: '#666', fontSize: '0.8rem' }}>{new Date(m.timestamp).toLocaleString()}</span>
              </div>
              <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '8px' }}>{m.from}</div>
              <div style={{ color: '#fff' }}>{m.body}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Card title="Quick Reply">
          {replyTo ? (
            <>
              <div style={{ background: '#1a1a1a', borderRadius: '6px', padding: '10px', marginBottom: '12px' }}>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>Replying to:</div>
                <div style={{ color: '#fff', fontWeight: 'bold' }}>{replyTo.from}</div>
              </div>
              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type reply..." style={{ width: '100%', background: '#0d0d0d', border: '1px solid #333', borderRadius: '6px', padding: '10px', color: '#fff', fontSize: '0.85rem', minHeight: '100px', resize: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button onClick={() => setReplyTo(null)} style={{ flex: 1, background: '#333', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={sendReply} disabled={sending || !replyText.trim()} style={{ flex: 1, background: '#f59e0b', color: '#000', border: 'none', borderRadius: '6px', padding: '10px', cursor: 'pointer', fontWeight: 'bold' }}>{sending ? '...' : 'Send'}</button>
              </div>
            </>
          ) : <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>Click a message to reply</p>}
        </Card>
        <Card title="Templates">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {["Thanks! Here's our price list: [link]", "What products are you looking for?", "We can deliver tomorrow. What time works?", "Call us at 718-768-1818!"].map((t, i) => (
              <button key={i} onClick={() => setReplyText(t)} disabled={!replyTo} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', padding: '8px 10px', color: replyTo ? '#fff' : '#666', fontSize: '0.75rem', textAlign: 'left', cursor: replyTo ? 'pointer' : 'default' }}>{t}</button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// META ADS TAB
// ═══════════════════════════════════════════════════════════════════════════

function MetaTab() {
  const [leads, setLeads] = useState([]);
  useEffect(() => { const saved = localStorage.getItem('suplook_enriched'); if (saved) setLeads(JSON.parse(saved).filter(l => l.graduated)); }, []);
  const exportAudience = () => {
    const csv = ['email,phone,fn,ln,ct,st,zip,country', ...leads.map(l => [l.email || '', l.phone || '', l.name.split(' ')[0], l.name.split(' ').slice(1).join(' '), '', '', '', 'US'].join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'meta_custom_audience.csv'; a.click();
  };
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <Card title="Meta Custom Audience">
        <p style={{ color: '#888', marginBottom: '20px' }}>Export graduated leads for Meta Ads targeting.</p>
        <StatRow label="Graduated Leads" value={leads.length} color="#ec4899" />
        <StatRow label="With Email" value={leads.filter(l => l.email).length} color="#06b6d4" />
        <StatRow label="With Phone" value={leads.filter(l => l.phone).length} color="#22c55e" />
        <button onClick={exportAudience} disabled={!leads.length} style={{ ...btnStyle(leads.length ? '#ec4899' : '#333'), marginTop: '20px' }}>📣 Export Custom Audience CSV</button>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SALESFORCE TAB
// ═══════════════════════════════════════════════════════════════════════════

function SalesforceTab() {
  const [warmLeads, setWarmLeads] = useState([]);
  const [exporting, setExporting] = useState(false);
  
  useEffect(() => {
    const queue = localStorage.getItem('mcd_salesforce_queue');
    if (queue) setWarmLeads(JSON.parse(queue));
  }, []);
  
  const exportToSalesforce = () => {
    if (!warmLeads.length) return alert('No warm leads to export');
    setExporting(true);
    const csv = ['Company,LastName,FirstName,Phone,Email,Website,LeadSource,Description,Industry,Rating', ...warmLeads.map(l => [l.name, l.name, l.name.split(/['s\s]/)[0], l.phone || '', l.email || '', l.website || '', 'Suplook - Inbound Reply', `First reply: "${l.firstReply?.slice(0, 100)}". Products: ${l.products?.join(', ') || 'TBD'}`, 'Restaurant', 'Hot'].map(v => `"${(v || '').replace(/"/g, '')}"`).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `salesforce_warm_leads_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    setTimeout(() => setExporting(false), 1000);
  };
  
  const clearExported = () => { if (confirm('Clear all exported leads from queue?')) { localStorage.setItem('mcd_salesforce_queue', '[]'); setWarmLeads([]); } };
  const coldLeadsCount = JSON.parse(localStorage.getItem('suplook_enriched') || '[]').length;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div><h2 style={{ color: '#00a1e0', margin: 0 }}>☁️ Salesforce Export</h2><p style={{ color: '#666', margin: '4px 0 0', fontSize: '0.85rem' }}>Warm leads only (people who replied)</p></div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={clearExported} disabled={!warmLeads.length} style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 20px', cursor: 'pointer' }}>Clear Queue</button>
          <button onClick={exportToSalesforce} disabled={!warmLeads.length || exporting} style={{ background: warmLeads.length ? '#00a1e0' : '#333', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontWeight: 'bold', cursor: 'pointer' }}>{exporting ? '✓ Exported!' : `☁️ Export ${warmLeads.length} Warm Leads`}</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #333', borderRadius: '10px', padding: '20px', textAlign: 'center' }}><div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#666' }}>{coldLeadsCount}</div><div style={{ color: '#888', fontSize: '0.85rem' }}>Cold Leads (Suplook)</div></div>
        <div style={{ background: 'rgba(0,161,224,0.1)', border: '1px solid #00a1e0', borderRadius: '10px', padding: '20px', textAlign: 'center' }}><div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#00a1e0' }}>{warmLeads.length}</div><div style={{ color: '#888', fontSize: '0.85rem' }}>Warm Leads (Replied)</div></div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #333', borderRadius: '10px', padding: '20px', textAlign: 'center' }}><div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>{coldLeadsCount > 0 ? ((warmLeads.length / coldLeadsCount) * 100).toFixed(1) : 0}%</div><div style={{ color: '#888', fontSize: '0.85rem' }}>Reply Rate</div></div>
      </div>
      <Card title="Warm Leads Queue">
        {warmLeads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}><div style={{ fontSize: '3rem', marginBottom: '10px' }}>📥</div><p>No replies yet</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
            {warmLeads.map((l, i) => (
              <div key={i} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div><div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>{l.name}</div><div style={{ fontSize: '0.8rem', color: '#888' }}>{l.detected_cuisine && <span style={{ marginRight: '12px' }}>🍽️ {l.detected_cuisine}</span>}{l.products?.length > 0 && <span style={{ color: '#10b981' }}>👁️ {l.products.length} products</span>}</div></div>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '0.8rem' }}><span style={{ color: '#22c55e' }}>📞 {l.phone}</span>{l.email && <span style={{ color: '#06b6d4' }}>📧</span>}</div>
                </div>
                <div style={{ background: '#0d0d0d', borderRadius: '6px', padding: '10px', marginTop: '8px' }}><div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '4px' }}>Their reply:</div><div style={{ color: '#f59e0b', fontSize: '0.85rem' }}>"{l.firstReply}"</div></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS TAB
// ═══════════════════════════════════════════════════════════════════════════

function SettingsTab() {
  const [googleKey, setGoogleKey] = useState(() => localStorage.getItem('suplook_google_key') || '');
  const [visionServer, setVisionServer] = useState(() => localStorage.getItem('suplook_server') || 'http://localhost:3009');
  const [twilioServer, setTwilioServer] = useState(() => localStorage.getItem('mcd_twilio_server') || 'http://localhost:3007');
  const [igServer, setIgServer] = useState(() => localStorage.getItem('mcd_ig_server') || 'http://localhost:3008');
  
  const save = () => {
    localStorage.setItem('suplook_google_key', googleKey);
    localStorage.setItem('suplook_server', visionServer);
    localStorage.setItem('mcd_twilio_server', twilioServer);
    localStorage.setItem('mcd_ig_server', igServer);
    alert('Settings saved!');
  };
  
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <Card title="API Keys">
        <label style={{ color: '#888', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Google API Key</label>
        <input type="password" value={googleKey} onChange={(e) => setGoogleKey(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }} />
      </Card>
      <Card title="Server URLs">
        <label style={{ color: '#888', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Vision AI Server</label>
        <input type="text" value={visionServer} onChange={(e) => setVisionServer(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }} />
        <label style={{ color: '#888', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Twilio Server</label>
        <input type="text" value={twilioServer} onChange={(e) => setTwilioServer(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }} />
        <label style={{ color: '#888', fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Instagram Server</label>
        <input type="text" value={igServer} onChange={(e) => setIgServer(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }} />
      </Card>
      <button onClick={save} style={{ ...btnStyle('#10b981'), marginTop: '10px' }}>💾 Save Settings</button>
    </div>
  );
}
