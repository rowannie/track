const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/track', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// MongoDB Schemas and Models
const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  price: { type: Number },
  priceHistory: [{
    price: Number,
    date: { type: Date, default: Date.now }
  }],
  category: String,
  description: String,
  lastScraped: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const notificationSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  type: { type: String, enum: ['price_drop', 'price_increase', 'back_in_stock'], required: true },
  message: String,
  threshold: Number,
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Item = mongoose.model('Item', itemSchema);
const Notification = mongoose.model('Notification', notificationSchema);

// Utility Functions

/**
 * Scrape product information from URL
 * @param {string} url - The URL to scrape
 * @returns {Promise<Object>} - Scraped data (title, price, description)
 */
async function scrapeWebsite(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Generic selectors - can be customized per site
    const title = $('h1').first().text() || $('title').text() || 'Unknown Product';
    const price = extractPrice($('body').text());
    const description = $('meta[name="description"]').attr('content') || '';

    return {
      name: title.trim(),
      price,
      description: description.trim()
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return {
      name: 'Error',
      price: null,
      description: 'Failed to scrape content'
    };
  }
}

/**
 * Extract price from text using regex
 * @param {string} text - Text containing price
 * @returns {number|null} - Extracted price or null
 */
function extractPrice(text) {
  const priceMatch = text.match(/\$\s*(\d+(?:\.\d{2})?)/);
  return priceMatch ? parseFloat(priceMatch[1]) : null;
}

/**
 * Check for price changes and create notifications
 * @param {Object} item - The item document
 * @param {number} currentPrice - Current scraped price
 */
async function checkPriceChanges(item, currentPrice) {
  if (!currentPrice || !item.price) return;

  const priceDifference = currentPrice - item.price;
  const percentChange = (Math.abs(priceDifference) / item.price) * 100;

  // Create notification if price changed by more than 1%
  if (percentChange > 1) {
    const notificationType = priceDifference < 0 ? 'price_drop' : 'price_increase';
    const message = `Price ${notificationType === 'price_drop' ? 'dropped' : 'increased'} from $${item.price} to $${currentPrice}`;

    await Notification.create({
      itemId: item._id,
      type: notificationType,
      message,
      threshold: item.price
    });
  }
}

// API Routes

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * POST /api/items
 * Create a new item to track
 */
app.post('/api/items', async (req, res) => {
  try {
    const { name, url, category } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }

    // Scrape initial data
    const scrapedData = await scrapeWebsite(url);

    const item = new Item({
      name: scrapedData.name || name,
      url,
      price: scrapedData.price,
      description: scrapedData.description,
      category: category || 'Uncategorized',
      priceHistory: scrapedData.price ? [{ price: scrapedData.price }] : []
    });

    await item.save();
    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/items
 * Retrieve all tracked items
 */
app.get('/api/items', async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/items/:id
 * Retrieve a specific item by ID
 */
app.get('/api/items/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/items/:id
 * Update an item
 */
app.put('/api/items/:id', async (req, res) => {
  try {
    const { name, url, category } = req.body;
    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { name, url, category, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/items/:id
 * Delete an item
 */
app.delete('/api/items/:id', async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/items/:id/scrape
 * Manually trigger scraping for a specific item
 */
app.post('/api/items/:id/scrape', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const scrapedData = await scrapeWebsite(item.url);
    
    if (scrapedData.price) {
      // Check for price changes
      await checkPriceChanges(item, scrapedData.price);

      // Update price history
      item.priceHistory.push({ price: scrapedData.price });
      item.price = scrapedData.price;
    }

    item.lastScraped = new Date();
    await item.save();

    res.json({
      message: 'Scraping completed',
      item
    });
  } catch (error) {
    console.error('Error scraping item:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/scrape-all
 * Scrape all items in the database
 */
app.post('/api/scrape-all', async (req, res) => {
  try {
    const items = await Item.find();
    const results = [];

    for (const item of items) {
      const scrapedData = await scrapeWebsite(item.url);
      
      if (scrapedData.price) {
        await checkPriceChanges(item, scrapedData.price);
        item.priceHistory.push({ price: scrapedData.price });
        item.price = scrapedData.price;
      }

      item.lastScraped = new Date();
      await item.save();
      results.push({ id: item._id, status: 'success' });
    }

    res.json({
      message: 'Batch scraping completed',
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error batch scraping:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notifications
 * Retrieve all notifications
 */
app.get('/api/notifications', async (req, res) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const query = unreadOnly ? { isRead: false } : {};
    const notifications = await Notification.find(query)
      .populate('itemId')
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(notification);
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/items/:id/price-history
 * Get price history for an item
 */
app.get('/api/items/:id/price-history', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({
      itemId: item._id,
      name: item.name,
      priceHistory: item.priceHistory
    });
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/stats
 * Get statistics about tracked items
 */
app.get('/api/stats', async (req, res) => {
  try {
    const totalItems = await Item.countDocuments();
    const avgPrice = await Item.aggregate([
      { $match: { price: { $exists: true, $ne: null } } },
      { $group: { _id: null, avgPrice: { $avg: '$price' } } }
    ]);

    const recentNotifications = await Notification.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    res.json({
      totalItems,
      averagePrice: avgPrice[0]?.avgPrice || 0,
      recentNotifications,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Started at: ${new Date().toISOString()}`);
});

module.exports = app;
