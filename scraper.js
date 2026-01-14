const puppeteer = require('puppeteer');

/**
 * Puppeteer-based Web Scraper for kmonstar.org
 * Extracts product details including variants and inventory information
 */

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
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });
      this.page = await this.browser.newPage();
      this.page.setDefaultTimeout(this.timeout);
      this.page.setDefaultNavigationTimeout(this.timeout);
      console.log('Browser initialized successfully');
    } catch (error) {
      console.error('Failed to initialize browser:', error.message);
      throw error;
    }
  }

  /**
   * Close browser instance
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed');
    }
  }

  /**
   * Scrape product details from a product page
   * @param {string} productUrl - URL of the product page
   * @returns {object} Product details including variants and inventory
   */
  async scrapeProduct(productUrl) {
    try {
      await this.page.goto(productUrl, { waitUntil: 'networkidle2' });
      
      const productData = await this.page.evaluate(() => {
        const product = {
          title: null,
          price: null,
          description: null,
          imageUrl: null,
          variants: [],
          inventory: {
            current: 0,
            status: 'unknown'
          },
          rating: null,
          url: window.location.href,
          scrapedAt: new Date().toISOString()
        };

        // Extract product title
        const titleElement = document.querySelector('h1.product-title, h1[itemprop="name"], .product-name');
        if (titleElement) {
          product.title = titleElement.textContent.trim();
        }

        // Extract price
        const priceElement = document.querySelector('[itemprop="price"], .product-price, .price');
        if (priceElement) {
          const priceText = priceElement.textContent.match(/[\d,]+\.?\d*/);
          product.price = priceText ? parseFloat(priceText[0].replace(/,/g, '')) : null;
        }

        // Extract description
        const descElement = document.querySelector('[itemprop="description"], .product-description, .description');
        if (descElement) {
          product.description = descElement.textContent.trim();
        }

        // Extract main product image
        const imageElement = document.querySelector('[itemprop="image"], .product-image img, .main-image img');
        if (imageElement) {
          product.imageUrl = imageElement.src || imageElement.getAttribute('data-src');
        }

        // Extract variants
        const variantContainers = document.querySelectorAll('[data-variant], .variant, .product-variant');
        if (variantContainers.length > 0) {
          variantContainers.forEach(container => {
            const variant = {
              name: null,
              value: null,
              price: null,
              inventory: 0
            };

            const nameElement = container.querySelector('[data-variant-name], .variant-name');
            if (nameElement) {
              variant.name = nameElement.textContent.trim();
            }

            const valueElement = container.querySelector('[data-variant-value], .variant-value');
            if (valueElement) {
              variant.value = valueElement.textContent.trim();
            }

            const priceElement = container.querySelector('.variant-price, [data-price]');
            if (priceElement) {
              const priceText = priceElement.textContent.match(/[\d,]+\.?\d*/);
              variant.price = priceText ? parseFloat(priceText[0].replace(/,/g, '')) : null;
            }

            const inventoryElement = container.querySelector('[data-inventory], .inventory, .stock-count');
            if (inventoryElement) {
              const inventoryText = inventoryElement.textContent.match(/\d+/);
              variant.inventory = inventoryText ? parseInt(inventoryText[0], 10) : 0;
            }

            if (variant.name || variant.value) {
              product.variants.push(variant);
            }
          });
        }

        // Extract inventory information
        const inventoryElement = document.querySelector('[itemprop="availability"], .inventory-count, .stock, [data-inventory-current]');
        if (inventoryElement) {
          const inventoryText = inventoryElement.textContent;
          const inventoryMatch = inventoryText.match(/\d+/);
          if (inventoryMatch) {
            product.inventory.current = parseInt(inventoryMatch[0], 10);
          }
          
          // Determine inventory status
          if (inventoryText.toLowerCase().includes('out') || inventoryText.toLowerCase().includes('unavailable')) {
            product.inventory.status = 'out-of-stock';
          } else if (inventoryText.toLowerCase().includes('in stock') || product.inventory.current > 0) {
            product.inventory.status = 'in-stock';
          } else if (inventoryText.toLowerCase().includes('limited') || product.inventory.current < 5) {
            product.inventory.status = 'limited';
          }
        }

        // Extract rating if available
        const ratingElement = document.querySelector('[itemprop="ratingValue"], .rating, .stars');
        if (ratingElement) {
          const ratingText = ratingElement.textContent.match(/[\d.]+/);
          product.rating = ratingText ? parseFloat(ratingText[0]) : null;
        }

        return product;
      });

      console.log(`Successfully scraped product: ${productData.title}`);
      return productData;
    } catch (error) {
      console.error(`Error scraping product at ${productUrl}:`, error.message);
      throw error;
    }
  }

  /**
   * Scrape multiple products from a list/category page
   * @param {string} listUrl - URL of the list/category page
   * @returns {array} Array of product URLs found on the page
   */
  async scrapeProductList(listUrl) {
    try {
      await this.page.goto(listUrl, { waitUntil: 'networkidle2' });
      
      const productUrls = await this.page.evaluate((baseUrl) => {
        const products = [];
        const productLinks = document.querySelectorAll('a[href*="/product"], a[href*="/item"], .product-link');
        
        productLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href) {
            const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
            if (!products.includes(fullUrl)) {
              products.push(fullUrl);
            }
          }
        });
        
        return products;
      }, this.baseUrl);

      console.log(`Found ${productUrls.length} products on the list page`);
      return productUrls;
    } catch (error) {
      console.error(`Error scraping product list at ${listUrl}:`, error.message);
      throw error;
    }
  }

  /**
   * Scrape multiple products with delay between requests
   * @param {array} productUrls - Array of product URLs to scrape
   * @param {number} delayMs - Delay between requests in milliseconds
   * @returns {array} Array of scraped product data
   */
  async scrapeMultipleProducts(productUrls, delayMs = 1000) {
    const results = [];
    
    for (let i = 0; i < productUrls.length; i++) {
      try {
        console.log(`Scraping product ${i + 1}/${productUrls.length}`);
        const productData = await this.scrapeProduct(productUrls[i]);
        results.push(productData);
        
        if (i < productUrls.length - 1) {
          await this.delay(delayMs);
        }
      } catch (error) {
        console.error(`Failed to scrape ${productUrls[i]}:`, error.message);
        results.push({
          url: productUrls[i],
          error: error.message,
          scrapedAt: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  /**
   * Utility function to delay execution
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for element to appear on page
   * @param {string} selector - CSS selector of the element
   * @param {number} timeout - Maximum time to wait in milliseconds
   */
  async waitForSelector(selector, timeout = 5000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      console.warn(`Element ${selector} not found within ${timeout}ms`);
      return false;
    }
  }

  /**
   * Click element and wait for navigation/new page
   * @param {string} selector - CSS selector of the element to click
   */
  async clickAndWait(selector) {
    await this.page.click(selector);
    await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
  }

  /**
   * Set viewport size
   * @param {object} viewport - Viewport dimensions {width, height}
   */
  async setViewport(viewport) {
    await this.page.setViewport(viewport);
  }
}

// Export the scraper class
module.exports = KmonstarScraper;

// Example usage
if (require.main === module) {
  (async () => {
    const scraper = new KmonstarScraper({ headless: true });
    
    try {
      await scraper.initialize();
      
      // Example: Scrape a single product
      // const productData = await scraper.scrapeProduct('https://kmonstar.org/product/example');
      // console.log('Scraped product:', JSON.stringify(productData, null, 2));
      
      // Example: Scrape product list and then all products
      // const productUrls = await scraper.scrapeProductList('https://kmonstar.org/products');
      // const allProducts = await scraper.scrapeMultipleProducts(productUrls);
      // console.log('All products:', JSON.stringify(allProducts, null, 2));
      
      console.log('Scraper ready. Use this module in your application.');
    } catch (error) {
      console.error('Scraper error:', error);
    } finally {
      await scraper.close();
    }
  })();
}
