const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Import routes and utilities
const scraper = require('./utils/scraper');
const database = require('./utils/database');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize database on startup
async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    await database.initialize();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

// Routes

/**
 * POST /api/scrape
 * Accepts productId and calls the scraper
 */
app.post('/api/scrape', async (req, res, next) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        error: 'Missing required field: productId',
      });
    }

    const result = await scraper.scrapeProduct(productId);
    res.status(200).json({
      success: true,
      message: 'Product scraped successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products
 * Returns all products from database
 */
app.get('/api/products', async (req, res, next) => {
  try {
    const products = await database.getAllProducts();
    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/products/:productId/variants
 * Returns variants for a specific product
 */
app.get('/api/products/:productId/variants', async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        error: 'Missing required parameter: productId',
      });
    }

    const variants = await database.getProductVariants(productId);
    res.status(200).json({
      success: true,
      data: variants,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/orders
 * Returns all orders from database
 */
app.get('/api/orders', async (req, res, next) => {
  try {
    const orders = await database.getAllOrders();
    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/orders
 * Adds a new order to database
 */
app.post('/api/orders', async (req, res, next) => {
  try {
    const orderData = req.body;

    if (!orderData || Object.keys(orderData).length === 0) {
      return res.status(400).json({
        error: 'Missing order data in request body',
      });
    }

    const newOrder = await database.createOrder(orderData);
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: newOrder,
    });
  } catch (error) {
    next(error);
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);

  // Default error status code
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error: ' + error.message;
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Resource not found';
  } else if (error.name === 'DatabaseError') {
    statusCode = 500;
    message = 'Database error occurred';
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
});

// Start server
async function startServer() {
  try {
    // Initialize database before starting server
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
