/**
 * Web Scraper for kmonstar.org
 * Extracts product details, variants, stock levels, and orders using Puppeteer
 */

const puppeteer = require('puppeteer');

class KmonstarScraper {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.timeout = options.timeout || 30000;
    this.baseUrl = 'https://kmonstar.org';
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize browser and page
   */
  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: this.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.page = await this.browser.newPage();
      this.page.setDefaultTimeout(this.timeout);
      console.log('Browser initialized successfully');
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  /**
   * Close browser and cleanup resources
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed');
    }
  }

  /**
   * Navigate to URL with retry logic
   */
  async navigateTo(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.page.goto(url, { waitUntil: 'networkidle2' });
        return true;
      } catch (error) {
        console.warn(`Navigation attempt ${i + 1} failed:`, error.message);
        if (i === retries - 1) throw error;
        await this.page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Scrape all products from the catalog
   */
  async scrapeProducts(pageUrl = null) {
    try {
      const url = pageUrl || `${this.baseUrl}/products`;
      await this.navigateTo(url);

      // Wait for product elements to load
      await this.page.waitForSelector('[data-product-id], .product-item', { timeout: 5000 }).catch(() => null);

      const products = await this.page.evaluate(() => {
        const productElements = document.querySelectorAll('[data-product-id], .product-item');
        const products = [];

        productElements.forEach(element => {
          const product = {
            id: element.getAttribute('data-product-id') || element.getAttribute('id'),
            name: element.querySelector('h2, .product-name, .title')?.textContent?.trim() || '',
            price: element.querySelector('[data-price], .price')?.textContent?.trim() || '',
            description: element.querySelector('[data-description], .description, .product-description')?.textContent?.trim() || '',
            url: element.querySelector('a')?.href || '',
            image: element.querySelector('img')?.src || '',
            sku: element.getAttribute('data-sku') || element.querySelector('[data-sku]')?.textContent?.trim() || ''
          };
          products.push(product);
        });

        return products;
      });

      console.log(`Scraped ${products.length} products`);
      return products;
    } catch (error) {
      console.error('Error scraping products:', error);
      throw error;
    }
  }

  /**
   * Scrape detailed information for a specific product
   */
  async scrapeProductDetails(productUrl) {
    try {
      await this.navigateTo(productUrl);

      const details = await this.page.evaluate(() => {
        return {
          title: document.querySelector('h1, .product-title')?.textContent?.trim() || '',
          price: document.querySelector('[data-price], .product-price, .price')?.textContent?.trim() || '',
          description: document.querySelector('[data-description], .product-description')?.textContent?.trim() || '',
          sku: document.querySelector('[data-sku]')?.textContent?.trim() || '',
          brand: document.querySelector('[data-brand], .brand')?.textContent?.trim() || '',
          category: document.querySelector('[data-category], .category')?.textContent?.trim() || '',
          rating: document.querySelector('[data-rating], .rating, .stars')?.textContent?.trim() || '',
          reviews: document.querySelector('[data-reviews-count], .reviews-count')?.textContent?.trim() || '',
          detailedDescription: document.querySelector('.detailed-description, [data-full-description]')?.textContent?.trim() || '',
          weight: document.querySelector('[data-weight]')?.textContent?.trim() || '',
          dimensions: document.querySelector('[data-dimensions]')?.textContent?.trim() || ''
        };
      });

      console.log(`Scraped details for product: ${details.title}`);
      return details;
    } catch (error) {
      console.error('Error scraping product details:', error);
      throw error;
    }
  }

  /**
   * Scrape product variants (sizes, colors, etc.)
   */
  async scrapeVariants(productUrl) {
    try {
      await this.navigateTo(productUrl);

      const variants = await this.page.evaluate(() => {
        const variantElements = document.querySelectorAll('[data-variant], .variant-option, .size-option, .color-option');
        const variants = [];

        variantElements.forEach(element => {
          const variant = {
            id: element.getAttribute('data-variant-id') || element.getAttribute('data-value'),
            name: element.getAttribute('data-variant-name') || element.textContent?.trim() || '',
            value: element.getAttribute('data-value') || element.getAttribute('value') || '',
            type: element.getAttribute('data-variant-type') || element.className.includes('color') ? 'color' : 'size',
            price: element.getAttribute('data-price') || '',
            available: !element.classList.contains('disabled') && !element.classList.contains('out-of-stock')
          };
          variants.push(variant);
        });

        return variants;
      });

      console.log(`Scraped ${variants.length} variants`);
      return variants;
    } catch (error) {
      console.error('Error scraping variants:', error);
      throw error;
    }
  }

  /**
   * Scrape stock levels for products
   */
  async scrapeStockLevels(productUrl) {
    try {
      await this.navigateTo(productUrl);

      const stock = await this.page.evaluate(() => {
        return {
          overall: document.querySelector('[data-stock], .stock, .inventory')?.textContent?.trim() || '',
          status: document.querySelector('[data-stock-status], .stock-status')?.textContent?.trim() || '',
          quantity: document.querySelector('[data-quantity], .quantity')?.textContent?.trim() || '',
          variantStock: Array.from(document.querySelectorAll('[data-variant-stock], .variant-stock')).map(el => ({
            variant: el.getAttribute('data-variant-name') || el.textContent?.trim(),
            quantity: el.getAttribute('data-quantity') || ''
          })) || []
        };
      });

      console.log(`Scraped stock information`);
      return stock;
    } catch (error) {
      console.error('Error scraping stock levels:', error);
      throw error;
    }
  }

  /**
   * Scrape order information (requires authentication)
   */
  async scrapeOrders(ordersUrl = null, loginRequired = false) {
    try {
      const url = ordersUrl || `${this.baseUrl}/orders`;
      
      if (loginRequired) {
        console.log('Note: Order scraping may require authentication');
      }

      await this.navigateTo(url);

      // Wait for order elements
      await this.page.waitForSelector('[data-order-id], .order-item, .order-row', { timeout: 5000 }).catch(() => null);

      const orders = await this.page.evaluate(() => {
        const orderElements = document.querySelectorAll('[data-order-id], .order-item, .order-row');
        const orders = [];

        orderElements.forEach(element => {
          const order = {
            id: element.getAttribute('data-order-id') || element.querySelector('.order-id')?.textContent?.trim() || '',
            date: element.getAttribute('data-order-date') || element.querySelector('[data-date], .order-date')?.textContent?.trim() || '',
            status: element.getAttribute('data-status') || element.querySelector('[data-status], .status, .order-status')?.textContent?.trim() || '',
            total: element.querySelector('[data-total], .total, .order-total')?.textContent?.trim() || '',
            customer: element.querySelector('[data-customer], .customer-name')?.textContent?.trim() || '',
            items: Array.from(element.querySelectorAll('[data-order-item], .order-item-detail')).map(item => ({
              productId: item.getAttribute('data-product-id'),
              name: item.querySelector('.item-name')?.textContent?.trim() || '',
              quantity: item.querySelector('[data-quantity]')?.textContent?.trim() || '',
              price: item.querySelector('[data-price]')?.textContent?.trim() || ''
            })) || [],
            shippingAddress: element.querySelector('[data-shipping-address], .shipping-address')?.textContent?.trim() || '',
            trackingNumber: element.getAttribute('data-tracking-number') || element.querySelector('[data-tracking]')?.textContent?.trim() || ''
          };
          orders.push(order);
        });

        return orders;
      });

      console.log(`Scraped ${orders.length} orders`);
      return orders;
    } catch (error) {
      console.error('Error scraping orders:', error);
      throw error;
    }
  }

  /**
   * Scrape all data comprehensively
   */
  async scrapeAll(options = {}) {
    try {
      await this.initialize();

      console.log('Starting comprehensive scrape of kmonstar.org...');

      // Scrape products
      const products = await this.scrapeProducts();

      // Scrape detailed information for each product
      const detailedProducts = [];
      for (const product of products.slice(0, Math.min(products.length, options.maxProducts || 5))) {
        if (product.url) {
          const details = await this.scrapeProductDetails(product.url);
          const variants = await this.scrapeVariants(product.url);
          const stock = await this.scrapeStockLevels(product.url);

          detailedProducts.push({
            ...product,
            details,
            variants,
            stock
          });

          // Add delay between requests to be respectful
          await this.page.waitForTimeout(1000);
        }
      }

      // Scrape orders if available
      let orders = [];
      if (options.scrapeOrders) {
        try {
          orders = await this.scrapeOrders(null, options.loginRequired);
        } catch (error) {
          console.warn('Could not scrape orders:', error.message);
        }
      }

      const result = {
        timestamp: new Date().toISOString(),
        baseUrl: this.baseUrl,
        summary: {
          totalProducts: products.length,
          detailedProducts: detailedProducts.length,
          totalOrders: orders.length
        },
        products,
        detailedProducts,
        orders
      };

      console.log('Scraping completed successfully');
      return result;
    } catch (error) {
      console.error('Error during comprehensive scrape:', error);
      throw error;
    } finally {
      await this.close();
    }
  }
}

// Export the scraper class
module.exports = KmonstarScraper;

// Example usage
if (require.main === module) {
  (async () => {
    const scraper = new KmonstarScraper({ headless: true });

    try {
      // Example: Scrape everything
      const data = await scraper.scrapeAll({
        maxProducts: 10,
        scrapeOrders: false,
        loginRequired: false
      });

      console.log('\n=== Scraping Results ===');
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Scraping failed:', error);
      process.exit(1);
    }
  })();
}
