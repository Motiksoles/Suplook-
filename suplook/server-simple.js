const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3009;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Config
const config = {
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  googleKey: process.env.GOOGLE_API_KEY,
  yelpKey: process.env.YELP_API_KEY
};

const AUTH_KEY = process.env.AUTH_KEY || 'suplook-team-2024';
const ADMIN_KEY = process.env.ADMIN_KEY || 'suplook-admin-secret-2024';

// In-memory storage
let leads = [];
let corrections = [];

// Auth middleware
const requireAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.key;
  if (!apiKey) return res.status(401).json({ error: 'Missing API key' });
  if (apiKey !== AUTH_KEY && apiKey !== ADMIN_KEY) return res.status(403).json({ error: 'Invalid API key' });
  req.isAdmin = (apiKey === ADMIN_KEY);
  next();
};

// Initialize Anthropic
let anthropic = null;
if (config.anthropicKey) {
  anthropic = new Anthropic({ apiKey: config.anthropicKey });
}

// Product catalog
const catalog = {
  categories: {
    pizza: ['Pizza Box 16"', 'Pizza Box 14"', 'Pizza Box 12"', 'Pizza Saver'],
    chinese: ['Chinese Takeout Box 32oz', 'Chinese Takeout Box 16oz', 'Chopsticks Wrapped', 'Soy Sauce Packet'],
    mexican: ['Foil Sheet 12x12', 'Portion Cup 2oz', 'Hot Sauce Packet', 'Kraft Bag'],
    cafe: ['Paper Hot Cup 12oz', 'Paper Hot Cup 16oz', 'Hot Cup Lid', 'Cup Sleeve Kraft'],
    deli: ['Deli Paper 12x12', 'Paper Bag Kraft', 'Sandwich Wrap', 'Toothpick Frilled'],
    general: ['Foam Container 9x9', 'Plastic Container', 'Utensil Kit', 'Napkins']
  }
};

// Fallback product matching
const fallbackMatch = (name, types = []) => {
  const n = (name || '').toLowerCase();
  const t = types.join(' ').toLowerCase();
  if (n.includes('pizza') || t.includes('pizza')) return { products: catalog.categories.pizza, cuisine: 'pizza' };
  if (n.includes('chinese') || n.includes('wok')) return { products: catalog.categories.chinese, cuisine: 'chinese' };
  if (n.includes('taco') || n.includes('mexican')) return { products: catalog.categories.mexican, cuisine: 'mexican' };
  if (n.includes('coffee') || n.includes('cafe')) return { products: catalog.categories.cafe, cuisine: 'cafe' };
  if (n.includes('deli') || n.includes('sandwich')) return { products: catalog.categories.deli, cuisine: 'deli' };
  return { products: catalog.categories.general, cuisine: 'general' };
};

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login
app.post('/login', (req, res) => {
  const { key } = req.body;
  if (key === AUTH_KEY) return res.json({ success: true, level: 'user', key });
  if (key === ADMIN_KEY) return res.json({ success: true, level: 'admin', key });
  res.status(401).json({ success: false, error: 'Invalid key' });
});

// Config
app.get('/config', requireAuth, (req, res) => {
  res.json({
    googleApiKey: config.googleKey || '',
    hasGoogleKey: !!config.googleKey,
    hasYelpKey: !!config.yelpKey,
    hasAnthropicKey: !!config.anthropicKey
  });
});

// Get catalog
app.get('/catalog', (req, res) => {
  res.json(catalog);
});

// Get leads
app.get('/leads', (req, res) => {
  res.json({ leads, total: leads.length });
});

// Get pending leads (for training UI)
app.get('/leads/pending', requireAuth, (req, res) => {
  const pending = leads.filter(l => !l.graduated);
  res.json({ leads: pending, total: pending.length });
});

// Get stats
app.get('/stats', requireAuth, (req, res) => {
  res.json({
    total: leads.length,
    pending: leads.filter(l => !l.graduated).length,
    graduated: leads.filter(l => l.graduated).length,
    corrected: leads.filter(l => l.ai_corrected).length
  });
});

// Graduate lead
app.post('/leads/:id/graduate', requireAuth, (req, res) => {
  const { id } = req.params;
  const { products, corrected } = req.body;
  const lead = leads.find(l => l.id === id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  
  lead.graduated = true;
  lead.products = products;
  lead.ai_corrected = corrected;
  lead.graduated_at = new Date().toISOString();
  
  res.json({ success: true, lead });
});

// Submit feedback
app.post('/feedback', requireAuth, (req, res) => {
  corrections.push({ ...req.body, timestamp: new Date().toISOString() });
  res.json({ success: true });
});

// Get corrections
app.get('/corrections', requireAuth, (req, res) => {
  res.json(corrections);
});

// ═══════════════════════════════════════════════════════════════════════════
// SERVER-SIDE SCRAPE
// ═══════════════════════════════════════════════════════════════════════════

app.post('/scrape/places', requireAuth, async (req, res) => {
  try {
    const { zipCodes, cuisine, batchSize, shuffle, demo } = req.body;
    
    if (!zipCodes || zipCodes.length === 0) {
      return res.status(400).json({ error: 'No zip codes provided' });
    }
    
    // DEMO MODE
    if (demo) {
      console.log('🎭 DEMO MODE');
      const demoLeads = [
        { id: 'demo_1', name: "Joe's Pizza", address: "123 Main St, Philadelphia, PA", phone: "(215) 555-0101", products: ['Pizza Box 16"', 'Pizza Box 14"', 'Napkins'], detected_cuisine: 'pizza', photo_tier: 1, graduated: false },
        { id: 'demo_2', name: "Golden Dragon", address: "456 Market St, Philadelphia, PA", phone: "(215) 555-0102", products: ['Chinese Takeout Box 32oz', 'Chopsticks', 'Soy Sauce'], detected_cuisine: 'chinese', photo_tier: 1, graduated: false },
        { id: 'demo_3', name: "Taco Loco", address: "789 South St, Philadelphia, PA", phone: "(215) 555-0103", products: ['Foil Sheet 12x12', 'Portion Cup 2oz', 'Hot Sauce'], detected_cuisine: 'mexican', photo_tier: 2, graduated: false },
        { id: 'demo_4', name: "Cafe Mocha", address: "321 Walnut St, Philadelphia, PA", phone: "(215) 555-0104", products: ['Paper Hot Cup 12oz', 'Cup Lid', 'Cup Sleeve'], detected_cuisine: 'cafe', photo_tier: 1, graduated: false },
        { id: 'demo_5', name: "Broadway Deli", address: "555 Chestnut St, Philadelphia, PA", phone: "(215) 555-0105", products: ['Deli Paper', 'Paper Bag', 'Toothpicks'], detected_cuisine: 'deli', photo_tier: 3, graduated: false }
      ];
      leads.push(...demoLeads);
      return res.json({ success: true, demo: true, total: 5, tier1: 3, tier2: 1, tier3: 1, leads: demoLeads });
    }
    
    if (!config.googleKey) {
      return res.status(400).json({ error: 'Google API key not configured' });
    }
    
    console.log(`\n🔍 SCRAPING ${zipCodes.length} zip codes for "${cuisine || 'restaurant'}"\n`);
    
    // Search Google Places
    const allPlaces = new Map();
    
    for (const zip of zipCodes) {
      try {
        const query = `${cuisine || 'restaurant'} in ${zip}`;
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${config.googleKey}`;
        const resp = await axios.get(url, { timeout: 10000 });
        
        if (resp.data.results) {
          for (const place of resp.data.results) {
            if (!allPlaces.has(place.place_id)) {
              allPlaces.set(place.place_id, {
                name: place.name,
                address: place.formatted_address,
                place_id: place.place_id,
                types: place.types || [],
                rating: place.rating
              });
            }
          }
        }
        console.log(`  ${zip}: ${resp.data.results?.length || 0} places`);
      } catch (err) {
        console.log(`  ${zip}: error - ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`\n✅ Found ${allPlaces.size} unique restaurants\n`);
    
    // Process batch
    let toProcess = Array.from(allPlaces.values());
    if (shuffle) toProcess = toProcess.sort(() => Math.random() - 0.5);
    toProcess = toProcess.slice(0, batchSize || 10);
    
    // Get details and enrich
    const results = [];
    
    for (let i = 0; i < toProcess.length; i++) {
      const place = toProcess[i];
      console.log(`[${i + 1}/${toProcess.length}] ${place.name}`);
      
      try {
        // Get contact info
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${config.googleKey}`;
        const detailsResp = await axios.get(detailsUrl, { timeout: 10000 });
        
        if (detailsResp.data.result) {
          place.phone = detailsResp.data.result.formatted_phone_number || '';
          place.website = detailsResp.data.result.website || '';
        }
        
        // Fallback product match
        const match = fallbackMatch(place.name, place.types);
        
        const enriched = {
          id: `lead_${Date.now()}_${i}`,
          ...place,
          products: match.products,
          detected_cuisine: match.cuisine,
          photo_tier: 3,
          graduated: false,
          enriched_at: new Date().toISOString()
        };
        
        results.push(enriched);
        leads.push(enriched);
        
      } catch (err) {
        console.log(`  Error: ${err.message}`);
      }
      
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log(`\n✅ COMPLETE: ${results.length} leads\n`);
    
    res.json({
      success: true,
      total: results.length,
      tier1: results.filter(r => r.photo_tier === 1).length,
      tier2: results.filter(r => r.photo_tier === 2).length,
      tier3: results.filter(r => r.photo_tier === 3).length,
      leads: results
    });
    
  } catch (err) {
    console.error('Scrape error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Batch enrich (for CSV upload)
app.post('/enrich/batch', requireAuth, async (req, res) => {
  try {
    const { restaurants } = req.body;
    const results = [];
    
    console.log(`\n🔄 BATCH ENRICH: ${restaurants.length} restaurants\n`);
    
    for (let i = 0; i < restaurants.length; i++) {
      const r = restaurants[i];
      const match = fallbackMatch(r.name, r.types || []);
      
      const enriched = {
        id: `lead_${Date.now()}_${i}`,
        ...r,
        products: match.products,
        detected_cuisine: match.cuisine,
        photo_tier: 3,
        graduated: false,
        enriched_at: new Date().toISOString()
      };
      
      results.push(enriched);
      leads.push(enriched);
    }
    
    console.log(`✅ COMPLETE: ${results.length} leads\n`);
    
    res.json({
      success: true,
      total: results.length,
      tier1: 0,
      tier2: 0,
      tier3: results.length,
      leads: results
    });
    
  } catch (err) {
    console.error('Batch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`🚀 SUPLOOK SERVER`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Anthropic: ${config.anthropicKey ? '✅' : '❌'}`);
  console.log(`   Google: ${config.googleKey ? '✅' : '❌'}`);
  console.log(`   Yelp: ${config.yelpKey ? '✅' : '❌'}`);
  console.log(`═══════════════════════════════════════════\n`);
});
