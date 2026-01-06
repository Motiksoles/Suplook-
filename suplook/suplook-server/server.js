// ═══════════════════════════════════════════════════════════════════════════
// SUPLOOK SERVER v3.0
// Analyzes restaurant photos using Claude Vision to match products
// Now with SCRAPE 2: Multi-source photo hunting
// Includes: Auth, deployment ready
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3009;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

const AUTH_KEY = process.env.AUTH_KEY || 'suplook-team-2024';
const ADMIN_KEY = process.env.ADMIN_KEY || 'suplook-admin-2024';

// Auth middleware - check API key in header
const requireAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.key;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key. Add x-api-key header.' });
  }
  
  if (apiKey !== AUTH_KEY && apiKey !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  
  req.isAdmin = (apiKey === ADMIN_KEY);
  next();
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.key;
  
  if (apiKey !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

// Public routes (no auth needed)
const publicRoutes = ['/health', '/login'];

// Apply auth to all routes except public ones
app.use((req, res, next) => {
  if (publicRoutes.includes(req.path)) {
    return next();
  }
  requireAuth(req, res, next);
});

// Login endpoint - validate key and return access level
app.post('/login', (req, res) => {
  const { key } = req.body;
  
  if (key === ADMIN_KEY) {
    return res.json({ success: true, level: 'admin', key: ADMIN_KEY });
  }
  
  if (key === AUTH_KEY) {
    return res.json({ success: true, level: 'user', key: AUTH_KEY });
  }
  
  res.status(401).json({ error: 'Invalid key' });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG & DATA
// ═══════════════════════════════════════════════════════════════════════════

const config = {
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  googleKey: process.env.GOOGLE_API_KEY,
  yelpKey: process.env.YELP_API_KEY
};

// Initialize Anthropic client
let anthropic = null;
if (config.anthropicKey) {
  anthropic = new Anthropic({ apiKey: config.anthropicKey });
  console.log('✅ Anthropic client initialized');
} else {
  console.warn('⚠️ ANTHROPIC_API_KEY not set - running in demo mode');
}

// Load product catalog
let productCatalog = null;
try {
  const catalogPath = path.join(__dirname, 'product_catalog.json');
  if (fs.existsSync(catalogPath)) {
    productCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    console.log('✅ Product catalog loaded');
  } else {
    console.warn('⚠️ Product catalog not found - using inline catalog');
  }
} catch (err) {
  console.error('Error loading catalog:', err.message);
}

// Corrections storage (in production, use a database)
const correctionsFile = path.join(__dirname, 'corrections.json');
let corrections = { byName: {}, byCuisine: {}, byVisual: {} };

try {
  if (fs.existsSync(correctionsFile)) {
    corrections = JSON.parse(fs.readFileSync(correctionsFile, 'utf8'));
    console.log('✅ Corrections loaded:', Object.keys(corrections.byName).length, 'entries');
  }
} catch (err) {
  console.log('No existing corrections file');
}

const saveCorrections = () => {
  fs.writeFileSync(correctionsFile, JSON.stringify(corrections, null, 2));
};

// ═══════════════════════════════════════════════════════════════════════════
// SCRAPE 2: PHOTO HUNTER
// Searches multiple sources for restaurant photos
// Priority: Yelp reviews > Instagram > Google Reviews > Google Places
// ═══════════════════════════════════════════════════════════════════════════

const photoHunter = {
  // User agent to avoid blocks
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
  },

  // Search Yelp using Fusion API (proper way, no 403s)
  async searchYelp(restaurantName, city) {
    const photos = [];
    let yelpData = null;
    
    if (!config.yelpKey) {
      console.log(`  ⚠️ Yelp: No API key configured`);
      return { photos, yelpData };
    }
    
    try {
      // Step 1: Search for the business
      const searchUrl = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(restaurantName)}&location=${encodeURIComponent(city)}&limit=1`;
      
      const searchResp = await axios.get(searchUrl, {
        headers: { 'Authorization': `Bearer ${config.yelpKey}` },
        timeout: 10000
      });
      
      const business = searchResp.data.businesses?.[0];
      if (!business) {
        console.log(`  ⚠️ Yelp: No business found`);
        return { photos, yelpData };
      }
      
      // Step 2: Get business details with photos
      const detailsUrl = `https://api.yelp.com/v3/businesses/${business.id}`;
      const detailsResp = await axios.get(detailsUrl, {
        headers: { 'Authorization': `Bearer ${config.yelpKey}` },
        timeout: 10000
      });
      
      const details = detailsResp.data;
      
      // Store Yelp business data
      yelpData = {
        yelp_id: details.id,
        yelp_url: details.url,
        yelp_rating: details.rating,
        yelp_review_count: details.review_count,
        yelp_price: details.price,
        yelp_categories: details.categories?.map(c => c.title) || []
      };
      
      // Get main photo
      if (details.image_url) {
        photos.push({
          url: details.image_url.replace('/o.jpg', '/l.jpg'), // Get larger version
          source: 'yelp',
          type: 'main'
        });
      }
      
      // Get additional photos
      if (details.photos && details.photos.length > 0) {
        for (const photoUrl of details.photos.slice(0, 5)) {
          if (!photos.find(p => p.url === photoUrl)) {
            photos.push({
              url: photoUrl,
              source: 'yelp',
              type: 'gallery'
            });
          }
        }
      }
      
      console.log(`  📸 Yelp API: Found ${photos.length} photos | ⭐ ${details.rating} (${details.review_count} reviews)`);
    } catch (err) {
      console.log(`  ⚠️ Yelp API error: ${err.response?.status || err.message}`);
    }
    return { photos, yelpData };
  },

  // Search Instagram for restaurant photos
  async searchInstagram(handle) {
    const photos = [];
    if (!handle) return photos;
    
    try {
      // Try to get Instagram page (public profiles only)
      const url = `https://www.instagram.com/${handle}/`;
      const resp = await axios.get(url, { headers: this.headers, timeout: 10000 });
      
      // Extract image URLs from page data
      const imgMatches = resp.data.match(/https:\/\/[^"]*\.jpg[^"]*/g) || [];
      for (const imgUrl of imgMatches.slice(0, 5)) {
        if (imgUrl.includes('instagram') && !imgUrl.includes('profile')) {
          photos.push({
            url: imgUrl,
            source: 'instagram',
            type: 'post'
          });
        }
      }
      
      console.log(`  📸 Instagram: Found ${photos.length} photos`);
    } catch (err) {
      console.log(`  ⚠️ Instagram search failed: ${err.message}`);
    }
    return photos;
  },

  // Get Google Places photos (multiple)
  async searchGooglePlaces(placeId, apiKey) {
    const photos = [];
    if (!placeId || !apiKey) return photos;
    
    try {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${apiKey}`;
      const resp = await axios.get(detailsUrl, { timeout: 10000 });
      
      const placePhotos = resp.data.result?.photos || [];
      for (const photo of placePhotos.slice(0, 5)) {
        if (photo.photo_reference) {
          const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${apiKey}`;
          photos.push({
            url: photoUrl,
            source: 'google_places',
            type: photo.html_attributions?.[0]?.includes('owner') ? 'owner' : 'user'
          });
        }
      }
      
      console.log(`  📸 Google Places: Found ${photos.length} photos`);
    } catch (err) {
      console.log(`  ⚠️ Google Places search failed: ${err.message}`);
    }
    return photos;
  },

  // Search Google Images for takeout/delivery photos
  async searchGoogleImages(restaurantName, city) {
    const photos = [];
    try {
      const query = encodeURIComponent(`${restaurantName} ${city} takeout delivery food`);
      const url = `https://www.google.com/search?q=${query}&tbm=isch`;
      
      const resp = await axios.get(url, { headers: this.headers, timeout: 10000 });
      
      // Extract image URLs
      const imgMatches = resp.data.match(/https:\/\/[^"]*\.(jpg|jpeg|png)[^"]*/gi) || [];
      for (const imgUrl of imgMatches.slice(0, 3)) {
        if (!imgUrl.includes('google.com/images') && !imgUrl.includes('gstatic')) {
          photos.push({
            url: imgUrl,
            source: 'google_images',
            type: 'search'
          });
        }
      }
      
      console.log(`  📸 Google Images: Found ${photos.length} photos`);
    } catch (err) {
      console.log(`  ⚠️ Google Images search failed: ${err.message}`);
    }
    return photos;
  },

  // Check if restaurant is on DoorDash/UberEats (delivery signal)
  async checkDeliveryApps(restaurantName, city) {
    const result = { onDoorDash: false, onUberEats: false, photos: [] };
    
    try {
      // Check DoorDash
      const ddQuery = encodeURIComponent(`site:doordash.com ${restaurantName} ${city}`);
      const ddUrl = `https://www.google.com/search?q=${ddQuery}`;
      const ddResp = await axios.get(ddUrl, { headers: this.headers, timeout: 8000 });
      result.onDoorDash = ddResp.data.includes('doordash.com/store');
      
      // Check UberEats
      const ueQuery = encodeURIComponent(`site:ubereats.com ${restaurantName} ${city}`);
      const ueUrl = `https://www.google.com/search?q=${ueQuery}`;
      const ueResp = await axios.get(ueUrl, { headers: this.headers, timeout: 8000 });
      result.onUberEats = ueResp.data.includes('ubereats.com');
      
      console.log(`  🚗 Delivery: DoorDash=${result.onDoorDash}, UberEats=${result.onUberEats}`);
    } catch (err) {
      console.log(`  ⚠️ Delivery check failed: ${err.message}`);
    }
    
    return result;
  },

  // MAIN: Hunt all photos for a restaurant
  async huntPhotos(restaurant) {
    console.log(`\n🔍 Hunting photos for: ${restaurant.name}`);
    
    const allPhotos = [];
    let yelpData = null;
    const city = restaurant.city || restaurant.address?.split(',').slice(-2, -1)[0]?.trim() || 'Philadelphia';
    
    // 1. Yelp (best for real customer photos)
    const yelpResult = await this.searchYelp(restaurant.name, city);
    allPhotos.push(...yelpResult.photos);
    yelpData = yelpResult.yelpData;
    await this.delay(500);
    
    // 2. Instagram (if we have handle)
    if (restaurant.instagram) {
      const igPhotos = await this.searchInstagram(restaurant.instagram);
      allPhotos.push(...igPhotos);
      await this.delay(500);
    }
    
    // 3. Google Places (multiple photos)
    if (restaurant.place_id && config.googleKey) {
      const gpPhotos = await this.searchGooglePlaces(restaurant.place_id, config.googleKey);
      allPhotos.push(...gpPhotos);
      await this.delay(300);
    }
    
    // 4. Check delivery apps (signal, not photos)
    const delivery = await this.checkDeliveryApps(restaurant.name, city);
    
    // 5. Fallback: Google Images if we have < 3 photos
    if (allPhotos.length < 3) {
      const giPhotos = await this.searchGoogleImages(restaurant.name, city);
      allPhotos.push(...giPhotos);
    }
    
    // Prioritize photos (packaging/food shots first)
    const prioritized = this.prioritizePhotos(allPhotos);
    
    console.log(`  ✅ Total: ${prioritized.length} photos collected`);
    
    return {
      photos: prioritized.slice(0, 10), // Max 10 photos
      delivery: delivery,
      photoTier: this.calculateTier(prioritized, delivery),
      yelpData: yelpData
    };
  },

  // Prioritize photos by likely usefulness
  prioritizePhotos(photos) {
    return photos.sort((a, b) => {
      const priority = { yelp: 1, instagram: 2, google_places: 3, google_images: 4 };
      return (priority[a.source] || 5) - (priority[b.source] || 5);
    });
  },

  // Calculate photo tier based on what we found
  calculateTier(photos, delivery) {
    // Tier 1: Yelp photos (likely show real food/packaging)
    if (photos.some(p => p.source === 'yelp')) return 1;
    
    // Tier 2: Instagram or delivery confirmed
    if (photos.some(p => p.source === 'instagram') || delivery.onDoorDash || delivery.onUberEats) return 2;
    
    // Tier 3: Only Google Places or no photos
    return 3;
  },

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// LEADS STORAGE (shared between Operations & Training UIs)
// ═══════════════════════════════════════════════════════════════════════════

const leadsFile = path.join(__dirname, 'leads.json');
let leads = [];

try {
  if (fs.existsSync(leadsFile)) {
    leads = JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
    console.log('✅ Leads loaded:', leads.length, 'total');
  }
} catch (err) {
  console.log('No existing leads file');
}

const saveLeads = () => {
  fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));
};

// Salesforce queue storage
const sfQueueFile = path.join(__dirname, 'salesforce_queue.json');
let salesforceQueue = [];

try {
  if (fs.existsSync(sfQueueFile)) {
    salesforceQueue = JSON.parse(fs.readFileSync(sfQueueFile, 'utf8'));
    console.log('✅ Salesforce queue loaded:', salesforceQueue.length, 'leads');
  }
} catch (err) {
  console.log('No existing Salesforce queue');
}

// Stats
let stats = {
  analyzed: 0,
  corrected: 0,
  avgConfidence: 0
};

// ═══════════════════════════════════════════════════════════════════════════
// VISION AI CORE
// ═══════════════════════════════════════════════════════════════════════════

// Build the prompt for Claude Vision
function buildVisionPrompt() {
  const catalog = productCatalog || getInlineCatalog();
  
  let productList = '';
  for (const [catKey, cat] of Object.entries(catalog.categories)) {
    productList += `\n${cat.name}:\n`;
    for (const p of cat.products) {
      productList += `  - ${p.sku}: ${p.name} - ${p.description}\n`;
    }
  }
  
  return `You are a restaurant supply expert for Your Company, a Brooklyn-based supplier.

Analyze this restaurant photo and determine what supplies they would need.

PRODUCT CATALOG:
${productList}

VISUAL CUES TO LOOK FOR:
- Pizza oven → Pizza boxes, pizza savers
- Espresso machine → Hot cups, lids, sleeves
- Deli counter/slicer → Deli paper, sandwich bags
- Outdoor patio → Heavy duty napkin dispensers
- Takeout counter → Foam containers, plastic bags
- Chinese wok → Takeout boxes, chopsticks
- Taco station → Foil sheets, portion cups
- Bakery display → Cake boxes, pastry bags
- Bar area → Cocktail napkins, straws

INSTRUCTIONS:
1. Describe what you see in the photo (2-3 sentences)
2. Identify the restaurant type/cuisine
3. List the TOP 5-8 products this restaurant would need
4. For each product, explain WHY based on what you see
5. Rate your confidence (low/medium/high)

RESPOND IN THIS EXACT JSON FORMAT:
{
  "description": "What I see in the photo...",
  "cuisine_type": "pizza|chinese|mexican|cafe|deli|bakery|bar|general",
  "confidence": "low|medium|high",
  "products": [
    {
      "sku": "PB16",
      "name": "Pizza Box 16\"",
      "reason": "I can see a pizza oven in the background"
    }
  ],
  "visual_cues_detected": ["pizza oven", "takeout counter"]
}`;
}

// Analyze image with Claude Vision
async function analyzeWithVision(imageBase64, mimeType = 'image/jpeg') {
  if (!anthropic) {
    console.log('[DEMO] Would analyze image with Claude Vision');
    return getDemoResponse();
  }
  
  const prompt = buildVisionPrompt();
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    });
    
    // Parse JSON from response
    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Could not parse JSON from response');
    }
    
  } catch (err) {
    console.error('Vision API error:', err.message);
    throw err;
  }
}

// Fetch image from Google Places
async function fetchGooglePlacesImage(photoReference, maxWidth = 800) {
  if (!config.googleKey) {
    throw new Error('Google API key not configured');
  }
  
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${config.googleKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  
  return { base64, contentType };
}

// Apply corrections to results
function applyCorrections(result, restaurantName, cuisineType) {
  const nameLower = restaurantName?.toLowerCase() || '';
  
  // Check name-based corrections
  for (const [pattern, correction] of Object.entries(corrections.byName)) {
    if (nameLower.includes(pattern.toLowerCase())) {
      if (correction.add) {
        result.products.push(...correction.add.map(p => ({ ...p, reason: 'Added from your corrections' })));
      }
      if (correction.remove) {
        result.products = result.products.filter(p => !correction.remove.includes(p.sku));
      }
    }
  }
  
  // Check cuisine-based corrections
  if (cuisineType && corrections.byCuisine[cuisineType]) {
    const c = corrections.byCuisine[cuisineType];
    if (c.always_include) {
      for (const sku of c.always_include) {
        if (!result.products.find(p => p.sku === sku)) {
          result.products.push({ sku, name: sku, reason: 'Always included for ' + cuisineType });
        }
      }
    }
    if (c.never_include) {
      result.products = result.products.filter(p => !c.never_include.includes(p.sku));
    }
  }
  
  return result;
}

// Demo response when no API key
function getDemoResponse() {
  return {
    description: "Demo mode - no image analysis performed",
    cuisine_type: "general",
    confidence: "low",
    products: [
      { sku: "FOAM9", name: "Foam Container 9x9", reason: "Standard takeout container" },
      { sku: "UTKIT", name: "Utensil Kit", reason: "Basic utensil needs" },
      { sku: "NAP2PLY", name: "Napkin 2-Ply", reason: "Every restaurant needs napkins" },
      { sku: "BAGPLAST", name: "T-Shirt Bag", reason: "For takeout orders" }
    ],
    visual_cues_detected: [],
    demo: true
  };
}

// Inline catalog if file not found
function getInlineCatalog() {
  return {
    categories: {
      pizza: {
        name: "Pizza",
        products: [
          { sku: "PB16", name: "Pizza Box 16\"", description: "Large pizza box" },
          { sku: "PB12", name: "Pizza Box 12\"", description: "Small pizza box" },
          { sku: "PS100", name: "Pizza Saver", description: "Prevents box crush" }
        ]
      },
      general: {
        name: "General",
        products: [
          { sku: "FOAM9", name: "Foam Container 9x9", description: "Takeout container" },
          { sku: "UTKIT", name: "Utensil Kit", description: "Fork, knife, napkin" },
          { sku: "NAP2PLY", name: "Napkin 2-Ply", description: "Dinner napkin" }
        ]
      }
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MCD Vision AI Server',
    anthropicConfigured: !!anthropic,
    googleConfigured: !!config.googleKey,
    yelpConfigured: !!config.yelpKey,
    catalogLoaded: !!productCatalog,
    correctionsCount: Object.keys(corrections.byName).length,
    stats
  });
});

// Get config (for UIs to fetch API keys)
app.get('/config', (req, res) => {
  res.json({
    googleApiKey: config.googleKey || '',
    hasAnthropicKey: !!config.anthropicKey,
    hasGoogleKey: !!config.googleKey,
    hasYelpKey: !!config.yelpKey
  });
});

// Update config (optional - for setting keys from UI)
app.post('/config', (req, res) => {
  const { googleApiKey, anthropicApiKey } = req.body;
  
  if (googleApiKey) {
    config.googleKey = googleApiKey;
  }
  if (anthropicApiKey) {
    config.anthropicKey = anthropicApiKey;
    anthropic = new Anthropic({ apiKey: anthropicApiKey });
  }
  
  res.json({
    success: true,
    googleConfigured: !!config.googleKey,
    anthropicConfigured: !!config.anthropicKey
  });
});

// Analyze by Google Places photo reference
app.post('/analyze/google-photo', async (req, res) => {
  const { photoReference, restaurantName, maxWidth } = req.body;
  
  if (!photoReference) {
    return res.status(400).json({ error: 'Missing photoReference' });
  }
  
  try {
    console.log(`📷 Fetching image for: ${restaurantName || 'Unknown'}`);
    
    // Fetch image from Google
    const { base64, contentType } = await fetchGooglePlacesImage(photoReference, maxWidth || 800);
    
    console.log(`🧠 Analyzing with Claude Vision...`);
    
    // Analyze with Claude
    let result = await analyzeWithVision(base64, contentType);
    
    // Apply corrections
    result = applyCorrections(result, restaurantName, result.cuisine_type);
    
    // Update stats
    stats.analyzed++;
    
    console.log(`✅ Analysis complete: ${result.products.length} products matched`);
    
    res.json({
      success: true,
      analysis: result,
      photoUrl: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${config.googleKey}`
    });
    
  } catch (err) {
    console.error('Analysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Analyze by direct image upload (base64)
app.post('/analyze/image', async (req, res) => {
  const { imageBase64, mimeType, restaurantName } = req.body;
  
  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing imageBase64' });
  }
  
  try {
    console.log(`🧠 Analyzing uploaded image for: ${restaurantName || 'Unknown'}`);
    
    let result = await analyzeWithVision(imageBase64, mimeType || 'image/jpeg');
    result = applyCorrections(result, restaurantName, result.cuisine_type);
    
    stats.analyzed++;
    
    res.json({ success: true, analysis: result });
    
  } catch (err) {
    console.error('Analysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Analyze by image URL
app.post('/analyze/url', async (req, res) => {
  const { imageUrl, restaurantName } = req.body;
  
  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing imageUrl' });
  }
  
  try {
    console.log(`📷 Fetching image from URL: ${imageUrl.slice(0, 50)}...`);
    
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to fetch image');
    
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    console.log(`🧠 Analyzing with Claude Vision...`);
    
    let result = await analyzeWithVision(base64, contentType);
    result = applyCorrections(result, restaurantName, result.cuisine_type);
    
    stats.analyzed++;
    
    res.json({ success: true, analysis: result });
    
  } catch (err) {
    console.error('Analysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Submit correction/feedback
app.post('/feedback', (req, res) => {
  const { restaurantName, cuisineType, originalProducts, correctedProducts, visualCues } = req.body;
  
  try {
    // Find what was added/removed
    const originalSkus = originalProducts.map(p => p.sku);
    const correctedSkus = correctedProducts.map(p => p.sku);
    
    const added = correctedProducts.filter(p => !originalSkus.includes(p.sku));
    const removed = originalSkus.filter(sku => !correctedSkus.includes(sku));
    
    // Store by cuisine type
    if (cuisineType) {
      if (!corrections.byCuisine[cuisineType]) {
        corrections.byCuisine[cuisineType] = { always_include: [], never_include: [] };
      }
      
      for (const p of added) {
        if (!corrections.byCuisine[cuisineType].always_include.includes(p.sku)) {
          corrections.byCuisine[cuisineType].always_include.push(p.sku);
        }
      }
      
      for (const sku of removed) {
        if (!corrections.byCuisine[cuisineType].never_include.includes(sku)) {
          corrections.byCuisine[cuisineType].never_include.push(sku);
        }
      }
    }
    
    // Store by name pattern (if name contains common words)
    const nameLower = (restaurantName || '').toLowerCase();
    const patterns = ['pizza', 'taco', 'burger', 'sushi', 'thai', 'indian', 'deli', 'cafe', 'coffee', 'bakery', 'bar', 'grill'];
    
    for (const pattern of patterns) {
      if (nameLower.includes(pattern)) {
        if (!corrections.byName[pattern]) {
          corrections.byName[pattern] = { add: [], remove: [] };
        }
        corrections.byName[pattern].add.push(...added);
        corrections.byName[pattern].remove.push(...removed);
      }
    }
    
    // Save to file
    saveCorrections();
    stats.corrected++;
    
    console.log(`📝 Correction saved: +${added.length} -${removed.length} for ${cuisineType || restaurantName}`);
    
    res.json({
      success: true,
      added: added.length,
      removed: removed.length,
      totalCorrections: Object.keys(corrections.byName).length + Object.keys(corrections.byCuisine).length
    });
    
  } catch (err) {
    console.error('Feedback error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get corrections
app.get('/corrections', (req, res) => {
  res.json(corrections);
});

// Clear corrections
app.delete('/corrections', (req, res) => {
  corrections = { byName: {}, byCuisine: {}, byVisual: {} };
  saveCorrections();
  res.json({ success: true, message: 'Corrections cleared' });
});

// Get product catalog
app.get('/catalog', (req, res) => {
  res.json(productCatalog || getInlineCatalog());
});

// ═══════════════════════════════════════════════════════════════════════════
// SCRAPE 2 API: Full enrichment with photo hunting
// ═══════════════════════════════════════════════════════════════════════════

// Enrich a single restaurant with photos and analysis
app.post('/enrich', async (req, res) => {
  try {
    const restaurant = req.body;
    console.log(`\n🚀 Enriching: ${restaurant.name}`);
    
    // Step 1: Hunt photos from all sources
    const photoResult = await photoHunter.huntPhotos(restaurant);
    
    // Step 2: Analyze photos with Vision AI
    let visionAnalysis = null;
    let products = [];
    
    if (photoResult.photos.length > 0 && anthropic) {
      console.log(`  🧠 Analyzing ${photoResult.photos.length} photos with Vision AI...`);
      
      // Analyze the best photo (first one after prioritization)
      const bestPhoto = photoResult.photos[0];
      
      try {
        // Fetch the actual image
        const imgResp = await axios.get(bestPhoto.url, { 
          responseType: 'arraybuffer',
          timeout: 15000,
          headers: photoHunter.headers
        });
        const base64 = Buffer.from(imgResp.data).toString('base64');
        const mediaType = imgResp.headers['content-type'] || 'image/jpeg';
        
        // Send to Claude Vision
        visionAnalysis = await analyzeWithVision(base64, mediaType, restaurant.name);
        
        if (visionAnalysis?.products) {
          products = visionAnalysis.products.map(p => p.name);
        }
        
        console.log(`  ✅ Vision AI: ${products.length} products matched`);
      } catch (imgErr) {
        console.log(`  ⚠️ Image fetch failed: ${imgErr.message}`);
      }
    }
    
    // Fallback to rule-based if no vision analysis
    if (products.length === 0) {
      const fallback = fallbackProductMatch(restaurant.name, restaurant.types || []);
      products = fallback.products;
      visionAnalysis = { cuisine_type: fallback.cuisine, fallback: true };
      console.log(`  📋 Fallback: ${products.length} products (rule-based)`);
    }
    
    // Build enriched result
    const enriched = {
      ...restaurant,
      photos: photoResult.photos,
      photo_tier: photoResult.photoTier,
      delivery: photoResult.delivery,
      vision_analysis: visionAnalysis,
      products: products,
      detected_cuisine: visionAnalysis?.cuisine_type || 'general',
      enriched_at: new Date().toISOString()
    };
    
    res.json(enriched);
    
  } catch (err) {
    console.error('Enrich error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FULL SERVER-SIDE SCRAPE (No CORS issues)
// ═══════════════════════════════════════════════════════════════════════════

app.post('/scrape/places', requireAuth, async (req, res) => {
  try {
    const { zipCodes, cuisine, batchSize, shuffle } = req.body;
    
    if (!zipCodes || zipCodes.length === 0) {
      return res.status(400).json({ error: 'No zip codes provided' });
    }
    
    if (!config.googleKey) {
      return res.status(400).json({ error: 'Google API key not configured on server' });
    }
    
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`🔍 SERVER-SIDE SCRAPE`);
    console.log(`📍 Zip codes: ${zipCodes.length}`);
    console.log(`🍽️  Cuisine: ${cuisine || 'restaurant'}`);
    console.log(`📊 Batch size: ${batchSize || 10}`);
    console.log(`═══════════════════════════════════════════\n`);
    
    // STEP 1: Search Google Places for restaurants
    const allPlaces = new Map();
    
    for (let i = 0; i < zipCodes.length; i++) {
      const zip = zipCodes[i].trim();
      if (!zip) continue;
      
      console.log(`[${i + 1}/${zipCodes.length}] Searching zip: ${zip}`);
      
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
                rating: place.rating,
                user_ratings_total: place.user_ratings_total
              });
            }
          }
          console.log(`   Found ${resp.data.results.length} places (total: ${allPlaces.size})`);
        }
      } catch (err) {
        console.log(`   ⚠️ Error searching ${zip}: ${err.message}`);
      }
      
      await new Promise(r => setTimeout(r, 200));
    }
    
    console.log(`\n✅ SCRAPE 1 COMPLETE: ${allPlaces.size} unique restaurants found\n`);
    
    // Convert to array and optionally shuffle
    let toProcess = Array.from(allPlaces.values());
    
    if (shuffle) {
      toProcess = toProcess.sort(() => Math.random() - 0.5);
    }
    
    // Limit to batch size
    const limit = batchSize || 10;
    toProcess = toProcess.slice(0, limit);
    
    console.log(`📋 Processing ${toProcess.length} restaurants\n`);
    
    // STEP 2: Get contact info for each
    for (let i = 0; i < toProcess.length; i++) {
      const place = toProcess[i];
      console.log(`[${i + 1}/${toProcess.length}] Getting details: ${place.name}`);
      
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website,types&key=${config.googleKey}`;
        const resp = await axios.get(detailsUrl, { timeout: 10000 });
        
        if (resp.data.result) {
          place.phone = resp.data.result.formatted_phone_number || '';
          place.website = resp.data.result.website || '';
          place.types = resp.data.result.types || place.types || [];
        }
        
        // Try to get email from website
        if (place.website) {
          try {
            const siteResp = await axios.get(place.website, { 
              timeout: 5000,
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const emailMatch = siteResp.data.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
            if (emailMatch) {
              const validEmails = emailMatch.filter(e => 
                !e.includes('example.com') && 
                !e.includes('wixpress') && 
                !e.includes('squarespace') &&
                e.length < 50
              );
              if (validEmails.length > 0) {
                place.email = validEmails[0];
              }
            }
            
            // Try to get Instagram
            const igMatch = siteResp.data.match(/instagram\.com\/([a-zA-Z0-9_\.]+)/);
            if (igMatch && !['p', 'reel', 'stories', 'explore'].includes(igMatch[1])) {
              place.instagram = igMatch[1];
            }
          } catch (e) {}
        }
      } catch (err) {
        console.log(`   ⚠️ Error: ${err.message}`);
      }
      
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log(`\n✅ Contact info collected\n`);
    
    // STEP 3: Photo hunting + Vision AI (use existing batch enrich logic)
    console.log(`🔍 SCRAPE 2: Hunting photos + Vision AI...\n`);
    
    const results = [];
    const batchId = `batch_${Date.now()}`;
    
    for (let i = 0; i < toProcess.length; i++) {
      const restaurant = toProcess[i];
      console.log(`\n[${i + 1}/${toProcess.length}] ${restaurant.name}`);
      
      try {
        // Hunt photos
        const photoResult = await photoHunter.huntPhotos(restaurant);
        
        // Analyze with Vision AI
        let visionAnalysis = null;
        let products = [];
        
        if (photoResult.photos.length > 0 && anthropic) {
          const bestPhoto = photoResult.photos[0];
          
          try {
            const imgResp = await axios.get(bestPhoto.url, {
              responseType: 'arraybuffer',
              timeout: 15000,
              headers: photoHunter.headers
            });
            const base64 = Buffer.from(imgResp.data).toString('base64');
            const mediaType = imgResp.headers['content-type'] || 'image/jpeg';
            
            visionAnalysis = await analyzeWithVision(base64, mediaType, restaurant.name);
            
            if (visionAnalysis?.products) {
              products = visionAnalysis.products.map(p => p.name);
            }
          } catch (imgErr) {
            console.log(`  ⚠️ Image fetch failed`);
          }
        }
        
        // Fallback
        if (products.length === 0) {
          const fallback = fallbackProductMatch(restaurant.name, restaurant.types || []);
          products = fallback.products;
          visionAnalysis = { cuisine_type: fallback.cuisine, fallback: true };
        }
        
        const enriched = {
          ...restaurant,
          id: `lead_${Date.now()}_${i}`,
          batch_id: batchId,
          photos: photoResult.photos,
          photo_analyzed: photoResult.photos[0] || null,
          photo_tier: photoResult.photoTier,
          delivery: photoResult.delivery,
          yelp_url: photoResult.yelpData?.yelp_url || null,
          yelp_rating: photoResult.yelpData?.yelp_rating || null,
          vision_analysis: visionAnalysis,
          products: products,
          products_original: [...products],
          detected_cuisine: visionAnalysis?.cuisine_type || 'general',
          ai_confidence: visionAnalysis?.confidence || 'low',
          graduated: false,
          enriched_at: new Date().toISOString()
        };
        
        results.push(enriched);
        leads.push(enriched);
        
        console.log(`  ✅ Tier ${enriched.photo_tier} | ${products.length} products`);
        
      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
        results.push({ 
          ...restaurant, 
          id: `lead_${Date.now()}_${i}`,
          error: err.message,
          photo_tier: 3,
          products: fallbackProductMatch(restaurant.name, restaurant.types || []).products,
          enriched_at: new Date().toISOString()
        });
      }
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Save leads
    saveLeads();
    
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`✅ SERVER SCRAPE COMPLETE`);
    console.log(`   Total: ${results.length}`);
    console.log(`   Tier 1: ${results.filter(r => r.photo_tier === 1).length}`);
    console.log(`   Tier 2: ${results.filter(r => r.photo_tier === 2).length}`);
    console.log(`   Tier 3: ${results.filter(r => r.photo_tier === 3).length}`);
    console.log(`═══════════════════════════════════════════\n`);
    
    res.json({
      success: true,
      total: results.length,
      tier1: results.filter(r => r.photo_tier === 1).length,
      tier2: results.filter(r => r.photo_tier === 2).length,
      tier3: results.filter(r => r.photo_tier === 3).length,
      leads: results
    });
    
  } catch (err) {
    console.error('Server scrape error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Batch enrich multiple restaurants
app.post('/enrich/batch', async (req, res) => {
  try {
    const { restaurants, batchId } = req.body;
    const results = [];
    
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`🚀 BATCH ENRICH: ${restaurants.length} restaurants`);
    console.log(`📋 Batch ID: ${batchId || 'none'}`);
    console.log(`═══════════════════════════════════════════\n`);
    
    for (let i = 0; i < restaurants.length; i++) {
      const restaurant = restaurants[i];
      console.log(`\n[${i + 1}/${restaurants.length}] ${restaurant.name}`);
      
      try {
        // Hunt photos
        const photoResult = await photoHunter.huntPhotos(restaurant);
        
        // Analyze with Vision AI
        let visionAnalysis = null;
        let products = [];
        
        if (photoResult.photos.length > 0 && anthropic) {
          const bestPhoto = photoResult.photos[0];
          
          try {
            const imgResp = await axios.get(bestPhoto.url, {
              responseType: 'arraybuffer',
              timeout: 15000,
              headers: photoHunter.headers
            });
            const base64 = Buffer.from(imgResp.data).toString('base64');
            const mediaType = imgResp.headers['content-type'] || 'image/jpeg';
            
            visionAnalysis = await analyzeWithVision(base64, mediaType, restaurant.name);
            
            if (visionAnalysis?.products) {
              products = visionAnalysis.products.map(p => p.name);
            }
          } catch (imgErr) {
            console.log(`  ⚠️ Image fetch failed`);
          }
        }
        
        // Fallback
        if (products.length === 0) {
          const fallback = fallbackProductMatch(restaurant.name, restaurant.types || []);
          products = fallback.products;
          visionAnalysis = { cuisine_type: fallback.cuisine, fallback: true };
        }
        
        // Track which photo was actually analyzed
        const photoAnalyzed = photoResult.photos.length > 0 ? photoResult.photos[0] : null;
        
        const enriched = {
          ...restaurant,
          id: restaurant.id || `lead_${Date.now()}_${i}`,
          batch_id: batchId,
          photos: photoResult.photos,
          photo_analyzed: photoAnalyzed, // The specific photo AI looked at
          photo_tier: photoResult.photoTier,
          delivery: photoResult.delivery,
          
          // Yelp data for reference
          yelp_url: photoResult.yelpData?.yelp_url || null,
          yelp_rating: photoResult.yelpData?.yelp_rating || null,
          yelp_review_count: photoResult.yelpData?.yelp_review_count || null,
          yelp_price: photoResult.yelpData?.yelp_price || null,
          yelp_categories: photoResult.yelpData?.yelp_categories || [],
          
          // AI analysis
          vision_analysis: visionAnalysis,
          products: products,
          products_original: [...products], // Store original AI suggestion
          detected_cuisine: visionAnalysis?.cuisine_type || 'general',
          ai_confidence: visionAnalysis?.confidence || 'low',
          
          // Tracking fields
          graduated: false,
          ai_corrected: false,
          correction_notes: null,
          
          // Outcome tracking (to be filled later)
          outcome: null, // 'no_reply', 'replied', 'sold', 'lost'
          outcome_notes: null,
          actual_products_needed: null, // What they really needed (from salesperson)
          
          // Timestamps
          enriched_at: new Date().toISOString(),
          graduated_at: null,
          contacted_at: null,
          outcome_at: null
        };
        
        results.push(enriched);
        
        // Save to leads storage
        leads.push(enriched);
        
        console.log(`  ✅ Tier ${enriched.photo_tier} | ${products.length} products | ${photoResult.photos.length} photos${enriched.yelp_url ? ' | Yelp ✓' : ''}`);
        
        
      } catch (err) {
        console.log(`  ❌ Error processing ${restaurant.name}: ${err.message}`);
        // Still add the restaurant with basic data, just no enrichment
        results.push({ 
          ...restaurant, 
          id: restaurant.id || `lead_${Date.now()}_${i}`,
          batch_id: batchId,
          error: err.message,
          photo_tier: 3,
          products: fallbackProductMatch(restaurant.name, restaurant.types || []).products,
          photos: [],
          enriched_at: new Date().toISOString()
        });
      }
      
      // Rate limiting between restaurants (reduced from 1000ms)
      await photoHunter.delay(500);
    }
    
    // Save all leads
    saveLeads();
    
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`✅ BATCH COMPLETE`);
    console.log(`   Total: ${results.length}`);
    console.log(`   Tier 1: ${results.filter(r => r.photo_tier === 1).length}`);
    console.log(`   Tier 2: ${results.filter(r => r.photo_tier === 2).length}`);
    console.log(`   Tier 3: ${results.filter(r => r.photo_tier === 3).length}`);
    console.log(`═══════════════════════════════════════════\n`);
    
    res.json({
      success: true,
      total: results.length,
      tier1: results.filter(r => r.photo_tier === 1).length,
      tier2: results.filter(r => r.photo_tier === 2).length,
      tier3: results.filter(r => r.photo_tier === 3).length,
      leads: results
    });
    
  } catch (err) {
    console.error('Batch enrich error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Helper: Analyze image with Claude Vision
async function analyzeWithVision(base64Image, mediaType, restaurantName) {
  if (!anthropic) return null;
  
  const prompt = buildVisionPrompt();
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Image
            }
          },
          {
            type: 'text',
            text: `${prompt}\n\nRestaurant name: ${restaurantName}\n\nAnalyze this image and return JSON only.`
          }
        ]
      }]
    });
    
    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return null;
  } catch (err) {
    console.error('Vision API error:', err.message);
    return null;
  }
}

// Helper: Fallback product matching
function fallbackProductMatch(name, types = []) {
  const n = (name || '').toLowerCase();
  const t = types.join(' ').toLowerCase();
  
  if (n.includes('pizza') || t.includes('pizza')) {
    return { products: ['Pizza Box 16"', 'Pizza Box 14"', 'Pizza Saver 100ct'], cuisine: 'pizza' };
  }
  if (n.includes('chinese') || n.includes('wok') || t.includes('chinese')) {
    return { products: ['Chinese Takeout Box 32oz', 'Chopsticks Wrapped 500ct', 'Soy Sauce Packet 500ct'], cuisine: 'chinese' };
  }
  if (n.includes('taco') || n.includes('mexican') || n.includes('burrito')) {
    return { products: ['Foil Sheet 12x12 500ct', 'Portion Cup 2oz 2500ct', 'Hot Sauce Packet'], cuisine: 'mexican' };
  }
  if (n.includes('coffee') || n.includes('cafe') || t.includes('cafe')) {
    return { products: ['Paper Hot Cup 12oz', 'Hot Cup Lid Dome', 'Cup Sleeve Kraft 1000ct'], cuisine: 'cafe' };
  }
  if (n.includes('deli') || n.includes('sandwich') || n.includes('bagel')) {
    return { products: ['Deli Paper 12x12', 'Paper Bag Kraft #20', 'Toothpick Frilled'], cuisine: 'deli' };
  }
  if (n.includes('bar') || n.includes('pub') || t.includes('bar')) {
    return { products: ['Beverage Napkin White', 'Straw Black 8"', 'Cocktail Pick Sword'], cuisine: 'bar' };
  }
  
  return { products: ['Foam Container 9x9', 'Utensil Kit Fork/Knife/Napkin', 'Paper Bag Kraft #20'], cuisine: 'general' };
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADS API (shared storage for Operations & Training UIs)
// ═══════════════════════════════════════════════════════════════════════════

// Get all leads
app.get('/leads', (req, res) => {
  const graduated = req.query.graduated;
  let result = leads;
  
  if (graduated === 'true') {
    result = leads.filter(l => l.graduated);
  } else if (graduated === 'false') {
    result = leads.filter(l => !l.graduated);
  }
  
  res.json({
    total: leads.length,
    pending: leads.filter(l => !l.graduated).length,
    graduated: leads.filter(l => l.graduated).length,
    leads: result
  });
});

// Add leads (from Operations UI scrape)
app.post('/leads', (req, res) => {
  const newLeads = req.body.leads || [];
  
  // Add new leads, avoid duplicates by id
  const existingIds = new Set(leads.map(l => l.id));
  let added = 0;
  
  for (const lead of newLeads) {
    if (!existingIds.has(lead.id)) {
      leads.push(lead);
      added++;
    }
  }
  
  saveLeads();
  
  res.json({
    success: true,
    added,
    total: leads.length,
    pending: leads.filter(l => !l.graduated).length
  });
});

// Update a lead (graduate, edit products, etc)
app.put('/leads/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const leadIndex = leads.findIndex(l => l.id === id);
  if (leadIndex === -1) {
    return res.status(404).json({ error: 'Lead not found' });
  }
  
  leads[leadIndex] = { ...leads[leadIndex], ...updates };
  saveLeads();
  
  res.json({ success: true, lead: leads[leadIndex] });
});

// Graduate a lead
app.post('/leads/:id/graduate', (req, res) => {
  const { id } = req.params;
  const { products, corrected } = req.body;
  
  const leadIndex = leads.findIndex(l => l.id === id);
  if (leadIndex === -1) {
    return res.status(404).json({ error: 'Lead not found' });
  }
  
  leads[leadIndex].graduated = true;
  if (products) {
    leads[leadIndex].products = products;
  }
  if (corrected) {
    leads[leadIndex].ai_corrected = true;
  }
  
  saveLeads();
  
  res.json({
    success: true,
    lead: leads[leadIndex],
    pending: leads.filter(l => !l.graduated).length
  });
});

// Graduate all pending leads
app.post('/leads/graduate-all', (req, res) => {
  let graduated = 0;
  
  leads.forEach(lead => {
    if (!lead.graduated) {
      lead.graduated = true;
      graduated++;
    }
  });
  
  saveLeads();
  
  res.json({
    success: true,
    graduated,
    total: leads.length,
    pending: 0
  });
});

// Delete a lead
app.delete('/leads/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = leads.length;
  leads = leads.filter(l => l.id !== id);
  
  if (leads.length === initialLength) {
    return res.status(404).json({ error: 'Lead not found' });
  }
  
  saveLeads();
  res.json({ success: true, remaining: leads.length });
});

// Clear all leads
app.delete('/leads', (req, res) => {
  const count = leads.length;
  leads = [];
  saveLeads();
  res.json({ success: true, deleted: count });
});

// ═══════════════════════════════════════════════════════════════════════════
// OUTCOME TRACKING API (The Gold - makes the model smarter)
// ═══════════════════════════════════════════════════════════════════════════

// Update lead outcome (no_reply, replied, sold, lost)
app.post('/leads/:id/outcome', (req, res) => {
  const { id } = req.params;
  const { outcome, notes, actual_products } = req.body;
  
  const leadIndex = leads.findIndex(l => l.id === id);
  if (leadIndex === -1) {
    return res.status(404).json({ error: 'Lead not found' });
  }
  
  leads[leadIndex].outcome = outcome; // 'no_reply', 'replied', 'sold', 'lost'
  leads[leadIndex].outcome_notes = notes || null;
  leads[leadIndex].outcome_at = new Date().toISOString();
  
  // If salesperson provided actual products needed, this is GOLD for training
  if (actual_products && actual_products.length > 0) {
    leads[leadIndex].actual_products_needed = actual_products;
    
    // Also save as a correction to improve AI
    const originalProducts = leads[leadIndex].products_original || leads[leadIndex].products;
    
    // Store field feedback in corrections
    const cuisineType = leads[leadIndex].detected_cuisine || 'general';
    if (!corrections.byField) corrections.byField = {};
    if (!corrections.byField[cuisineType]) corrections.byField[cuisineType] = [];
    
    corrections.byField[cuisineType].push({
      restaurant: leads[leadIndex].name,
      ai_suggested: originalProducts,
      actual_needed: actual_products,
      outcome: outcome,
      recorded_at: new Date().toISOString()
    });
    
    saveCorrections();
    console.log(`📊 Field feedback saved: ${leads[leadIndex].name} → ${outcome} → Actually needed: ${actual_products.join(', ')}`);
  }
  
  saveLeads();
  
  res.json({
    success: true,
    lead: leads[leadIndex]
  });
});

// Get outcome stats
app.get('/stats/outcomes', (req, res) => {
  const outcomes = {
    total: leads.length,
    no_outcome: leads.filter(l => !l.outcome).length,
    no_reply: leads.filter(l => l.outcome === 'no_reply').length,
    replied: leads.filter(l => l.outcome === 'replied').length,
    sold: leads.filter(l => l.outcome === 'sold').length,
    lost: leads.filter(l => l.outcome === 'lost').length
  };
  
  // Calculate conversion rates
  const contacted = outcomes.replied + outcomes.sold + outcomes.lost;
  outcomes.reply_rate = contacted > 0 ? (outcomes.replied / contacted * 100).toFixed(1) + '%' : '0%';
  outcomes.conversion_rate = contacted > 0 ? (outcomes.sold / contacted * 100).toFixed(1) + '%' : '0%';
  
  // Breakdown by tier
  outcomes.by_tier = {
    tier1: {
      total: leads.filter(l => l.photo_tier === 1).length,
      sold: leads.filter(l => l.photo_tier === 1 && l.outcome === 'sold').length
    },
    tier2: {
      total: leads.filter(l => l.photo_tier === 2).length,
      sold: leads.filter(l => l.photo_tier === 2 && l.outcome === 'sold').length
    },
    tier3: {
      total: leads.filter(l => l.photo_tier === 3).length,
      sold: leads.filter(l => l.photo_tier === 3 && l.outcome === 'sold').length
    }
  };
  
  res.json(outcomes);
});

// Get AI accuracy stats
app.get('/stats/accuracy', (req, res) => {
  const withOutcome = leads.filter(l => l.outcome && l.actual_products_needed);
  
  let correctPredictions = 0;
  let totalPredictions = 0;
  
  for (const lead of withOutcome) {
    const predicted = new Set(lead.products_original || lead.products);
    const actual = new Set(lead.actual_products_needed);
    
    for (const product of predicted) {
      totalPredictions++;
      if (actual.has(product)) correctPredictions++;
    }
  }
  
  res.json({
    leads_with_feedback: withOutcome.length,
    total_predictions: totalPredictions,
    correct_predictions: correctPredictions,
    accuracy: totalPredictions > 0 ? (correctPredictions / totalPredictions * 100).toFixed(1) + '%' : 'N/A',
    corrections_count: Object.keys(corrections.byName || {}).length + Object.keys(corrections.byCuisine || {}).length,
    field_feedback_count: Object.values(corrections.byField || {}).flat().length
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SALESFORCE QUEUE API
// ═══════════════════════════════════════════════════════════════════════════

// Get Salesforce queue
app.get('/salesforce', (req, res) => {
  res.json({
    count: salesforceQueue.length,
    leads: salesforceQueue
  });
});

// Add to Salesforce queue
app.post('/salesforce', (req, res) => {
  const lead = req.body;
  
  // Check if already in queue
  if (salesforceQueue.find(l => l.phone === lead.phone)) {
    return res.json({ success: true, message: 'Already in queue' });
  }
  
  salesforceQueue.unshift({
    ...lead,
    id: `sf_${Date.now()}`,
    pushedAt: new Date().toISOString()
  });
  
  fs.writeFileSync(sfQueueFile, JSON.stringify(salesforceQueue, null, 2));
  
  res.json({ success: true, count: salesforceQueue.length });
});

// Clear Salesforce queue
app.delete('/salesforce', (req, res) => {
  const count = salesforceQueue.length;
  salesforceQueue = [];
  fs.writeFileSync(sfQueueFile, JSON.stringify(salesforceQueue, null, 2));
  res.json({ success: true, deleted: count });
});

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`
═══════════════════════════════════════════════════════════════
  SUPLOOK SERVER
  Running on http://localhost:${PORT}
═══════════════════════════════════════════════════════════════
  
  Endpoints:
  - GET  /health                Health check & status
  - POST /analyze/google-photo  Analyze by Google Places photo ref
  - POST /analyze/image         Analyze by base64 image
  - POST /analyze/url           Analyze by image URL
  - POST /feedback              Submit correction
  - GET  /corrections           View all corrections
  - GET  /catalog               Get product catalog
  
  Config:
  - Anthropic: ${anthropic ? 'Connected' : 'Demo Mode'}
  - Google: ${config.googleKey ? 'Connected' : 'Not configured'}
  - Catalog: ${productCatalog ? 'Loaded' : 'Using inline'}
  
═══════════════════════════════════════════════════════════════
  `);
});

module.exports = app;
