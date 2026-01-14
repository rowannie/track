const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock database (replace with actual database)
const products = [];
const variants = [];
const orders = [];
const dashboardMetrics = {
  totalProducts: 0,
  totalVariants: 0,
  totalOrders: 0,
  totalRevenue: 0,
  recentOrders: [],
  topProducts: []
};

// ==================== Product Scraping Endpoints ====================

/**
 * POST /api/products/scrape
 * Scrapes products from a given source URL
 */
app.post('/api/products/scrape', async (req, res) => {
  try {
    const { sourceUrl, productData } = req.body;

    if (!sourceUrl || !productData) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sourceUrl and productData'
      });
    }

    // Validate product data structure
    const validatedProduct = {
      id: productData.id || Date.now().toString(),
      name: productData.name,
      description: productData.description || '',
      price: parseFloat(productData.price) || 0,
      category: productData.category || 'Uncategorized',
      sourceUrl: sourceUrl,
      imageUrl: productData.imageUrl || null,
      sku: productData.sku || null,
      stock: parseInt(productData.stock) || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    products.push(validatedProduct);
    dashboardMetrics.totalProducts = products.length;

    res.status(201).json({
      success: true,
      message: 'Product scraped successfully',
      data: validatedProduct
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error scraping product',
      error: error.message
    });
  }
});

/**
 * GET /api/products
 * Retrieves all scraped products with optional filtering
 */
app.get('/api/products', (req, res) => {
  try {
    const { category, minPrice, maxPrice, search } = req.query;

    let filteredProducts = [...products];

    // Apply filters
    if (category) {
      filteredProducts = filteredProducts.filter(p => p.category === category);
    }

    if (minPrice) {
      filteredProducts = filteredProducts.filter(p => p.price >= parseFloat(minPrice));
    }

    if (maxPrice) {
      filteredProducts = filteredProducts.filter(p => p.price <= parseFloat(maxPrice));
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredProducts = filteredProducts.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }

    res.status(200).json({
      success: true,
      data: filteredProducts,
      total: filteredProducts.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

/**
 * GET /api/products/:id
 * Retrieves a single product by ID
 */
app.get('/api/products/:id', (req, res) => {
  try {
    const product = products.find(p => p.id === req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
});

// ==================== Variant Management Endpoints ====================

/**
 * POST /api/variants
 * Creates a new product variant
 */
app.post('/api/variants', (req, res) => {
  try {
    const { productId, type, value, price, stock } = req.body;

    if (!productId || !type || !value) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: productId, type, and value'
      });
    }

    const product = products.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const variant = {
      id: `variant_${Date.now()}`,
      productId: productId,
      type: type, // e.g., 'size', 'color', 'material'
      value: value,
      price: price ? parseFloat(price) : product.price,
      stock: stock ? parseInt(stock) : product.stock,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    variants.push(variant);
    dashboardMetrics.totalVariants = variants.length;

    res.status(201).json({
      success: true,
      message: 'Variant created successfully',
      data: variant
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating variant',
      error: error.message
    });
  }
});

/**
 * GET /api/variants
 * Retrieves all variants with optional product filtering
 */
app.get('/api/variants', (req, res) => {
  try {
    const { productId, type } = req.query;

    let filteredVariants = [...variants];

    if (productId) {
      filteredVariants = filteredVariants.filter(v => v.productId === productId);
    }

    if (type) {
      filteredVariants = filteredVariants.filter(v => v.type === type);
    }

    res.status(200).json({
      success: true,
      data: filteredVariants,
      total: filteredVariants.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching variants',
      error: error.message
    });
  }
});

/**
 * PUT /api/variants/:id
 * Updates a variant
 */
app.put('/api/variants/:id', (req, res) => {
  try {
    const { price, stock, value } = req.body;
    const variant = variants.find(v => v.id === req.params.id);

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found'
      });
    }

    if (price !== undefined) variant.price = parseFloat(price);
    if (stock !== undefined) variant.stock = parseInt(stock);
    if (value !== undefined) variant.value = value;
    variant.updatedAt = new Date();

    res.status(200).json({
      success: true,
      message: 'Variant updated successfully',
      data: variant
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating variant',
      error: error.message
    });
  }
});

/**
 * DELETE /api/variants/:id
 * Deletes a variant
 */
app.delete('/api/variants/:id', (req, res) => {
  try {
    const index = variants.findIndex(v => v.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found'
      });
    }

    const deletedVariant = variants.splice(index, 1);
    dashboardMetrics.totalVariants = variants.length;

    res.status(200).json({
      success: true,
      message: 'Variant deleted successfully',
      data: deletedVariant[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting variant',
      error: error.message
    });
  }
});

// ==================== Order Tracking Endpoints ====================

/**
 * POST /api/orders
 * Creates a new order
 */
app.post('/api/orders', (req, res) => {
  try {
    const { productId, variantId, quantity, customerEmail, customerName, totalPrice } = req.body;

    if (!productId || !quantity || !customerEmail) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: productId, quantity, and customerEmail'
      });
    }

    const product = products.find(p => p.id === productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const order = {
      id: `order_${Date.now()}`,
      productId: productId,
      variantId: variantId || null,
      quantity: parseInt(quantity),
      customerEmail: customerEmail,
      customerName: customerName || 'Guest',
      totalPrice: totalPrice ? parseFloat(totalPrice) : product.price * quantity,
      status: 'pending', // pending, processing, shipped, delivered, cancelled
      shippingAddress: null,
      trackingNumber: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    orders.push(order);
    dashboardMetrics.totalOrders = orders.length;
    dashboardMetrics.totalRevenue += order.totalPrice;
    dashboardMetrics.recentOrders.unshift(order);
    if (dashboardMetrics.recentOrders.length > 10) {
      dashboardMetrics.recentOrders.pop();
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
});

/**
 * GET /api/orders
 * Retrieves all orders with optional filtering
 */
app.get('/api/orders', (req, res) => {
  try {
    const { status, customerEmail, productId } = req.query;

    let filteredOrders = [...orders];

    if (status) {
      filteredOrders = filteredOrders.filter(o => o.status === status);
    }

    if (customerEmail) {
      filteredOrders = filteredOrders.filter(o => o.customerEmail === customerEmail);
    }

    if (productId) {
      filteredOrders = filteredOrders.filter(o => o.productId === productId);
    }

    res.status(200).json({
      success: true,
      data: filteredOrders,
      total: filteredOrders.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
});

/**
 * GET /api/orders/:id
 * Retrieves a single order by ID
 */
app.get('/api/orders/:id', (req, res) => {
  try {
    const order = orders.find(o => o.id === req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message
    });
  }
});

/**
 * PUT /api/orders/:id
 * Updates an order (status, tracking, shipping address)
 */
app.put('/api/orders/:id', (req, res) => {
  try {
    const { status, trackingNumber, shippingAddress } = req.body;
    const order = orders.find(o => o.id === req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (status) order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (shippingAddress) order.shippingAddress = shippingAddress;
    order.updatedAt = new Date();

    res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating order',
      error: error.message
    });
  }
});

/**
 * DELETE /api/orders/:id
 * Cancels/deletes an order
 */
app.delete('/api/orders/:id', (req, res) => {
  try {
    const index = orders.findIndex(o => o.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const deletedOrder = orders.splice(index, 1)[0];
    dashboardMetrics.totalOrders = orders.length;
    dashboardMetrics.totalRevenue -= deletedOrder.totalPrice;

    res.status(200).json({
      success: true,
      message: 'Order deleted successfully',
      data: deletedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting order',
      error: error.message
    });
  }
});

// ==================== Dashboard Endpoints ====================

/**
 * GET /api/dashboard
 * Retrieves comprehensive dashboard data and metrics
 */
app.get('/api/dashboard', (req, res) => {
  try {
    // Calculate additional metrics
    const orderStatuses = {
      pending: orders.filter(o => o.status === 'pending').length,
      processing: orders.filter(o => o.status === 'processing').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length
    };

    // Get top products by order count
    const productOrderCounts = {};
    orders.forEach(order => {
      productOrderCounts[order.productId] = (productOrderCounts[order.productId] || 0) + order.quantity;
    });

    const topProducts = Object.entries(productOrderCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([productId, count]) => {
        const product = products.find(p => p.id === productId);
        return {
          productId,
          name: product?.name || 'Unknown',
          orderCount: count
        };
      });

    const dashboard = {
      summary: {
        totalProducts: dashboardMetrics.totalProducts,
        totalVariants: dashboardMetrics.totalVariants,
        totalOrders: dashboardMetrics.totalOrders,
        totalRevenue: dashboardMetrics.totalRevenue.toFixed(2)
      },
      orderStatuses: orderStatuses,
      topProducts: topProducts,
      recentOrders: dashboardMetrics.recentOrders.slice(0, 10),
      averageOrderValue: dashboardMetrics.totalOrders > 0
        ? (dashboardMetrics.totalRevenue / dashboardMetrics.totalOrders).toFixed(2)
        : 0,
      lastUpdated: new Date()
    };

    res.status(200).json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
});

/**
 * GET /api/dashboard/stats
 * Retrieves detailed statistics
 */
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const stats = {
      products: {
        total: products.length,
        byCategory: {}
      },
      variants: {
        total: variants.length,
        byType: {}
      },
      orders: {
        total: orders.length,
        byStatus: {},
        totalValue: dashboardMetrics.totalRevenue
      }
    };

    // Count by category
    products.forEach(p => {
      stats.products.byCategory[p.category] = (stats.products.byCategory[p.category] || 0) + 1;
    });

    // Count variants by type
    variants.forEach(v => {
      stats.variants.byType[v.type] = (stats.variants.byType[v.type] || 0) + 1;
    });

    // Count orders by status
    orders.forEach(o => {
      stats.orders.byStatus[o.status] = (stats.orders.byStatus[o.status] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

// ==================== Health Check ====================

/**
 * GET /health
 * Simple health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date()
  });
});

// ==================== 404 Handler ====================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// ==================== Error Handler ====================

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// ==================== Start Server ====================

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
