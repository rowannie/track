const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Puppeteer-based web scraper for kmonstar.org
 * Extracts product details, variants, stock levels, and order information
 */

class KmonstarScraper {
  constructor(options = {}) {
    this.baseUrl = 'https://kmonstar.org';
    this.headless = options.headless !== false;
    this.timeout = options.timeout || 30000;
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize browser and create a new page
   */
  async init() {
    try {
      this.browser = await puppeteer.launch({
        headless: this.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.page = await this.browser.newPage();
      this.page.setDefaultNavigationTimeout(this.timeout);
      this.page.setDefaultTimeout(this.timeout);
      console.log('[INFO] Browser initialized successfully');
    } catch (error) {
      console.error('[ERROR] Failed to initialize browser:', error.message);
      throw error;
    }
  }

  /**
   * Close browser instance
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('[INFO] Browser closed');
    }
  }

  /**
   * Scrape product details from product page
   * @param {string} productUrl - Full URL of the product
   * @returns {Promise<Object>} Product details object
   */
  async scrapeProductDetails(productUrl) {
    try {
      console.log(`[SCRAPING] Product details from: ${productUrl}`);
      await this.page.goto(productUrl, { waitUntil: 'networkidle2' });

      const productData = await this.page.evaluate(() => {
        const data = {
          title: null,
          price: null,
          originalPrice: null,
          description: null,
          images: [],
          rating: null,
          reviews: null,
          sku: null,
          category: null,
          vendor: null
        };

        // Extract title
        const titleElement = document.querySelector('h1, [data-testid="product-title"]');
        if (titleElement) {
          data.title = titleElement.textContent.trim();
        }

        // Extract price
        const priceElement = document.querySelector('[data-testid="product-price"], .price, .product-price');
        if (priceElement) {
          data.price = parseFloat(priceElement.textContent.replace(/[^\d.]/g, ''));
        }

        // Extract original price (if on sale)
        const originalPriceElement = document.querySelector('.original-price, .strikethrough-price');
        if (originalPriceElement) {
          data.originalPrice = parseFloat(originalPriceElement.textContent.replace(/[^\d.]/g, ''));
        }

        // Extract description
        const descElement = document.querySelector('[data-testid="product-description"], .product-description, .description');
        if (descElement) {
          data.description = descElement.textContent.trim();
        }

        // Extract product images
        const imageElements = document.querySelectorAll('[data-testid="product-image"] img, .product-image img, img[alt*="product"]');
        imageElements.forEach((img) => {
          const src = img.src || img.dataset.src;
          if (src) {
            data.images.push(src);
          }
        });

        // Extract rating
        const ratingElement = document.querySelector('[data-testid="product-rating"], .rating, .stars');
        if (ratingElement) {
          data.rating = parseFloat(ratingElement.textContent);
        }

        // Extract review count
        const reviewsElement = document.querySelector('[data-testid="review-count"], .review-count');
        if (reviewsElement) {
          data.reviews = parseInt(reviewsElement.textContent);
        }

        // Extract SKU
        const skuElement = document.querySelector('[data-testid="sku"], .sku');
        if (skuElement) {
          data.sku = skuElement.textContent.trim();
        }

        // Extract category
        const categoryElement = document.querySelector('[data-testid="category"], .category, .breadcrumb');
        if (categoryElement) {
          data.category = categoryElement.textContent.trim();
        }

        // Extract vendor/seller
        const vendorElement = document.querySelector('[data-testid="vendor"], .vendor, .seller');
        if (vendorElement) {
          data.vendor = vendorElement.textContent.trim();
        }

        return data;
      });

      console.log('[SUCCESS] Product details extracted');
      return productData;
    } catch (error) {
      console.error('[ERROR] Failed to scrape product details:', error.message);
      throw error;
    }
  }

  /**
   * Scrape product variants (colors, sizes, etc.)
   * @param {string} productUrl - Full URL of the product
   * @returns {Promise<Array>} Array of variant objects
   */
  async scrapeProductVariants(productUrl) {
    try {
      console.log(`[SCRAPING] Product variants from: ${productUrl}`);
      await this.page.goto(productUrl, { waitUntil: 'networkidle2' });

      const variants = await this.page.evaluate(() => {
        const variantsData = [];

        // Common variant container selectors
        const variantContainers = document.querySelectorAll(
          '[data-testid="variant"], .variant, .option, .product-option, [data-variant-id]'
        );

        variantContainers.forEach((container) => {
          const variant = {
            id: container.dataset.variantId || container.id || null,
            name: null,
            value: null,
            price: null,
            stock: null,
            image: null,
            selected: false
          };

          // Extract variant name
          const nameElement = container.querySelector('[data-testid="variant-name"], .variant-name, label');
          if (nameElement) {
            variant.name = nameElement.textContent.trim();
          }

          // Extract variant value
          const valueElement = container.querySelector('[data-testid="variant-value"], .variant-value, input[type="radio"], input[type="checkbox"]');
          if (valueElement) {
            variant.value = valueElement.value || valueElement.textContent.trim();
            variant.selected = valueElement.checked || false;
          }

          // Extract variant-specific price
          const variantPriceElement = container.querySelector('[data-testid="variant-price"], .variant-price');
          if (variantPriceElement) {
            variant.price = parseFloat(variantPriceElement.textContent.replace(/[^\d.]/g, ''));
          }

          // Extract variant-specific stock
          const variantStockElement = container.querySelector('[data-testid="variant-stock"], .variant-stock, .in-stock, .stock-status');
          if (variantStockElement) {
            variant.stock = variantStockElement.textContent.trim();
          }

          // Extract variant image
          const variantImageElement = container.querySelector('img');
          if (variantImageElement) {
            variant.image = variantImageElement.src || variantImageElement.dataset.src;
          }

          variantsData.push(variant);
        });

        return variantsData;
      });

      console.log(`[SUCCESS] Extracted ${variants.length} variants`);
      return variants;
    } catch (error) {
      console.error('[ERROR] Failed to scrape product variants:', error.message);
      throw error;
    }
  }

  /**
   * Scrape stock levels for a product
   * @param {string} productUrl - Full URL of the product
   * @returns {Promise<Object>} Stock information object
   */
  async scrapeStockLevels(productUrl) {
    try {
      console.log(`[SCRAPING] Stock levels from: ${productUrl}`);
      await this.page.goto(productUrl, { waitUntil: 'networkidle2' });

      const stockData = await this.page.evaluate(() => {
        const stock = {
          inStock: null,
          quantity: null,
          status: null,
          lastUpdated: new Date().toISOString(),
          variantStock: []
        };

        // Check overall stock status
        const stockStatusElement = document.querySelector(
          '[data-testid="stock-status"], .stock-status, .availability, [class*="stock"]'
        );
        if (stockStatusElement) {
          stock.status = stockStatusElement.textContent.trim();
          stock.inStock = !stock.status.toLowerCase().includes('out');
        }

        // Extract quantity
        const quantityElement = document.querySelector(
          '[data-testid="stock-quantity"], .quantity, [class*="quantity"]'
        );
        if (quantityElement) {
          const quantityText = quantityElement.textContent;
          const match = quantityText.match(/\d+/);
          stock.quantity = match ? parseInt(match[0]) : null;
        }

        // Extract variant-specific stock levels
        const variantStockElements = document.querySelectorAll('[data-testid="variant-stock"], [class*="variant"][class*="stock"]');
        variantStockElements.forEach((element) => {
          const variantStock = {
            variant: element.dataset.variant || element.textContent.split(':')[0],
            stock: element.textContent.split(':')[1] || element.textContent
          };
          stock.variantStock.push(variantStock);
        });

        return stock;
      });

      console.log('[SUCCESS] Stock levels extracted');
      return stockData;
    } catch (error) {
      console.error('[ERROR] Failed to scrape stock levels:', error.message);
      throw error;
    }
  }

  /**
   * Scrape order information (if accessible)
   * @param {string} ordersUrl - Full URL of the orders page
   * @returns {Promise<Array>} Array of order objects
   */
  async scrapeOrders(ordersUrl) {
    try {
      console.log(`[SCRAPING] Orders from: ${ordersUrl}`);
      await this.page.goto(ordersUrl, { waitUntil: 'networkidle2' });

      const orders = await this.page.evaluate(() => {
        const ordersData = [];

        // Find order containers
        const orderElements = document.querySelectorAll(
          '[data-testid="order"], .order, .order-item, [class*="order"][class*="row"]'
        );

        orderElements.forEach((element) => {
          const order = {
            id: null,
            date: null,
            status: null,
            total: null,
            items: [],
            shippingAddress: null,
            trackingNumber: null
          };

          // Extract order ID
          const idElement = element.querySelector('[data-testid="order-id"], .order-id, [class*="order-number"]');
          if (idElement) {
            order.id = idElement.textContent.trim();
          }

          // Extract order date
          const dateElement = element.querySelector('[data-testid="order-date"], .order-date, .date');
          if (dateElement) {
            order.date = dateElement.textContent.trim();
          }

          // Extract order status
          const statusElement = element.querySelector('[data-testid="order-status"], .order-status, .status');
          if (statusElement) {
            order.status = statusElement.textContent.trim();
          }

          // Extract order total
          const totalElement = element.querySelector('[data-testid="order-total"], .order-total, .total');
          if (totalElement) {
            order.total = parseFloat(totalElement.textContent.replace(/[^\d.]/g, ''));
          }

          // Extract order items
          const itemElements = element.querySelectorAll('[data-testid="order-item"], .order-item, .item');
          itemElements.forEach((itemElement) => {
            const item = {
              name: null,
              quantity: null,
              price: null
            };

            const nameElement = itemElement.querySelector('[data-testid="item-name"], .item-name');
            if (nameElement) {
              item.name = nameElement.textContent.trim();
            }

            const quantityElement = itemElement.querySelector('[data-testid="item-quantity"], .quantity');
            if (quantityElement) {
              item.quantity = parseInt(quantityElement.textContent);
            }

            const priceElement = itemElement.querySelector('[data-testid="item-price"], .price');
            if (priceElement) {
              item.price = parseFloat(priceElement.textContent.replace(/[^\d.]/g, ''));
            }

            if (item.name) {
              order.items.push(item);
            }
          });

          // Extract shipping address
          const addressElement = element.querySelector('[data-testid="shipping-address"], .shipping-address, .address');
          if (addressElement) {
            order.shippingAddress = addressElement.textContent.trim();
          }

          // Extract tracking number
          const trackingElement = element.querySelector('[data-testid="tracking-number"], .tracking-number, [class*="tracking"]');
          if (trackingElement) {
            order.trackingNumber = trackingElement.textContent.trim();
          }

          if (order.id) {
            ordersData.push(order);
          }
        });

        return ordersData;
      });

      console.log(`[SUCCESS] Extracted ${orders.length} orders`);
      return orders;
    } catch (error) {
      console.error('[ERROR] Failed to scrape orders:', error.message);
      throw error;
    }
  }

  /**
   * Search for products on kmonstar.org
   * @param {string} searchQuery - Search term
   * @returns {Promise<Array>} Array of product results
   */
  async searchProducts(searchQuery) {
    try {
      const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(searchQuery)}`;
      console.log(`[SCRAPING] Searching for: ${searchQuery}`);
      await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });

      const results = await this.page.evaluate(() => {
        const products = [];
        const productElements = document.querySelectorAll(
          '[data-testid="product-card"], .product-card, .product-item, [class*="product"]'
        );

        productElements.forEach((element) => {
          const product = {
            title: null,
            url: null,
            price: null,
            image: null,
            rating: null
          };

          const linkElement = element.querySelector('a');
          if (linkElement) {
            product.url = linkElement.href;
          }

          const titleElement = element.querySelector('[data-testid="product-title"], .title, h2, h3');
          if (titleElement) {
            product.title = titleElement.textContent.trim();
          }

          const priceElement = element.querySelector('[data-testid="price"], .price, [class*="price"]');
          if (priceElement) {
            product.price = parseFloat(priceElement.textContent.replace(/[^\d.]/g, ''));
          }

          const imageElement = element.querySelector('img');
          if (imageElement) {
            product.image = imageElement.src || imageElement.dataset.src;
          }

          const ratingElement = element.querySelector('[data-testid="rating"], .rating, [class*="star"]');
          if (ratingElement) {
            product.rating = parseFloat(ratingElement.textContent);
          }

          if (product.title && product.url) {
            products.push(product);
          }
        });

        return products;
      });

      console.log(`[SUCCESS] Found ${results.length} products`);
      return results;
    } catch (error) {
      console.error('[ERROR] Failed to search products:', error.message);
      throw error;
    }
  }

  /**
   * Scrape multiple products and aggregate data
   * @param {Array<string>} productUrls - Array of product URLs
   * @returns {Promise<Array>} Array of aggregated product data
   */
  async scrapeMultipleProducts(productUrls) {
    const allData = [];

    for (const url of productUrls) {
      try {
        const details = await this.scrapeProductDetails(url);
        const variants = await this.scrapeProductVariants(url);
        const stock = await this.scrapeStockLevels(url);

        allData.push({
          url,
          details,
          variants,
          stock,
          scrapedAt: new Date().toISOString()
        });

        // Add delay between requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`[ERROR] Failed to scrape ${url}:`, error.message);
        allData.push({
          url,
          error: error.message,
          scrapedAt: new Date().toISOString()
        });
      }
    }

    return allData;
  }

  /**
   * Save scraped data to JSON file
   * @param {Object|Array} data - Data to save
   * @param {string} filename - Output filename
   */
  async saveData(data, filename = 'scraped_data.json') {
    try {
      const filepath = path.join(process.cwd(), filename);
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
      console.log(`[SUCCESS] Data saved to ${filepath}`);
    } catch (error) {
      console.error('[ERROR] Failed to save data:', error.message);
      throw error;
    }
  }
}

/**
 * Example usage
 */
async function main() {
  const scraper = new KmonstarScraper({ headless: true });

  try {
    await scraper.init();

    // Example: Search for products
    const searchResults = await scraper.searchProducts('gaming');
    await scraper.saveData(searchResults, 'search_results.json');

    // Example: Scrape a specific product
    // const productDetails = await scraper.scrapeProductDetails('https://kmonstar.org/product/...');
    // await scraper.saveData(productDetails, 'product_details.json');

    // Example: Scrape product variants
    // const variants = await scraper.scrapeProductVariants('https://kmonstar.org/product/...');
    // await scraper.saveData(variants, 'variants.json');

    // Example: Check stock levels
    // const stock = await scraper.scrapeStockLevels('https://kmonstar.org/product/...');
    // await scraper.saveData(stock, 'stock_levels.json');

    // Example: Scrape orders (if authenticated)
    // const orders = await scraper.scrapeOrders('https://kmonstar.org/orders');
    // await scraper.saveData(orders, 'orders.json');

  } catch (error) {
    console.error('[FATAL] Scraper encountered an error:', error);
  } finally {
    await scraper.close();
  }
}

// Export the scraper class for use as a module
module.exports = KmonstarScraper;

// Run main if executed directly
if (require.main === module) {
  main();
}
