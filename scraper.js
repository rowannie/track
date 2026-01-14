const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Web scraper for kmonstar.org
 * Extracts product variants and stock levels using Puppeteer
 */

class KmonstarScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = 'https://kmonstar.org';
    this.products = [];
  }

  /**
   * Initialize browser and page
   */
  async init() {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.page = await this.browser.newPage();
      this.page.setDefaultNavigationTimeout(30000);
      console.log('Browser initialized successfully');
    } catch (error) {
      console.error('Error initializing browser:', error.message);
      throw error;
    }
  }

  /**
   * Navigate to a product page
   * @param {string} productUrl - Full URL of the product
   */
  async navigateToProduct(productUrl) {
    try {
      await this.page.goto(productUrl, { waitUntil: 'networkidle2' });
      console.log(`Navigated to: ${productUrl}`);
    } catch (error) {
      console.error(`Error navigating to ${productUrl}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract product information including variants and stock levels
   */
  async extractProductData() {
    try {
      const productData = await this.page.evaluate(() => {
        const product = {
          name: null,
          price: null,
          url: window.location.href,
          variants: [],
          stockLevel: null,
          description: null,
          images: [],
          availability: null
        };

        // Extract product name
        const nameElement = document.querySelector('h1, .product-name, [data-product-name]');
        if (nameElement) {
          product.name = nameElement.textContent.trim();
        }

        // Extract price
        const priceElement = document.querySelector('.price, [data-price], .product-price');
        if (priceElement) {
          product.price = priceElement.textContent.trim();
        }

        // Extract description
        const descElement = document.querySelector('.description, [data-description], .product-description');
        if (descElement) {
          product.description = descElement.textContent.trim();
        }

        // Extract variant information
        const variantElements = document.querySelectorAll('[data-variant], .variant, .product-option');
        variantElements.forEach((variant) => {
          const variantInfo = {
            name: variant.getAttribute('data-variant-name') || variant.textContent.split(':')[0]?.trim(),
            options: [],
            selected: variant.getAttribute('data-selected') || false
          };

          const optionElements = variant.querySelectorAll('.option, [data-option], li');
          optionElements.forEach((option) => {
            const optionData = {
              value: option.textContent.trim(),
              stock: option.getAttribute('data-stock') || 'Unknown',
              available: !option.classList.contains('disabled') && !option.classList.contains('out-of-stock')
            };
            variantInfo.options.push(optionData);
          });

          if (variantInfo.options.length > 0) {
            product.variants.push(variantInfo);
          }
        });

        // Extract stock level
        const stockElement = document.querySelector('[data-stock], .stock-level, .inventory');
        if (stockElement) {
          const stockText = stockElement.textContent.trim();
          const stockMatch = stockText.match(/\d+/);
          product.stockLevel = stockMatch ? parseInt(stockMatch[0]) : stockText;
        }

        // Extract availability status
        const availabilityElement = document.querySelector('[data-availability], .availability, .stock-status');
        if (availabilityElement) {
          product.availability = availabilityElement.textContent.trim();
        }

        // Extract images
        const imageElements = document.querySelectorAll('img[src*="product"], .product-image img, [data-product-image]');
        imageElements.forEach((img) => {
          if (img.src) {
            product.images.push(img.src);
          }
        });

        return product;
      });

      return productData;
    } catch (error) {
      console.error('Error extracting product data:', error.message);
      throw error;
    }
  }

  /**
   * Scrape multiple products
   * @param {string[]} productUrls - Array of product URLs to scrape
   */
  async scrapeProducts(productUrls) {
    try {
      await this.init();

      for (const url of productUrls) {
        try {
          await this.navigateToProduct(url);
          const productData = await this.extractProductData();
          this.products.push(productData);
          console.log(`✓ Scraped: ${productData.name}`);
        } catch (error) {
          console.error(`Failed to scrape ${url}:`, error.message);
        }
      }

      return this.products;
    } catch (error) {
      console.error('Error during scraping:', error.message);
      throw error;
    } finally {
      await this.close();
    }
  }

  /**
   * Scrape product listing page and extract product links
   * @param {string} listingUrl - URL of the listing page
   */
  async scrapeProductListing(listingUrl) {
    try {
      await this.init();
      await this.navigateToProduct(listingUrl);

      const productLinks = await this.page.evaluate(() => {
        const links = [];
        const linkElements = document.querySelectorAll('a[href*="/products/"], .product-link, [data-product-link]');
        linkElements.forEach((link) => {
          const href = link.getAttribute('href');
          if (href) {
            links.push(href.startsWith('http') ? href : window.location.origin + href);
          }
        });
        return [...new Set(links)]; // Remove duplicates
      });

      console.log(`Found ${productLinks.length} products on listing page`);
      return productLinks;
    } catch (error) {
      console.error('Error scraping listing:', error.message);
      throw error;
    }
  }

  /**
   * Save scraped data to JSON file
   * @param {string} filename - Output filename
   */
  async saveData(filename = 'products.json') {
    try {
      const outputPath = path.join(__dirname, filename);
      fs.writeFileSync(outputPath, JSON.stringify(this.products, null, 2));
      console.log(`Data saved to ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error('Error saving data:', error.message);
      throw error;
    }
  }

  /**
   * Close browser
   */
  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        console.log('Browser closed');
      }
    } catch (error) {
      console.error('Error closing browser:', error.message);
    }
  }

  /**
   * Get products with specific stock level
   * @param {number} minStock - Minimum stock level
   */
  getProductsByStock(minStock = 0) {
    return this.products.filter(product => {
      if (typeof product.stockLevel === 'number') {
        return product.stockLevel >= minStock;
      }
      return false;
    });
  }

  /**
   * Get available products (in stock)
   */
  getAvailableProducts() {
    return this.products.filter(product => {
      return product.availability?.toLowerCase().includes('in stock') ||
             product.availability?.toLowerCase().includes('available') ||
             (typeof product.stockLevel === 'number' && product.stockLevel > 0);
    });
  }
}

// Export for use as module
module.exports = KmonstarScraper;

// Example usage
if (require.main === module) {
  (async () => {
    const scraper = new KmonstarScraper();
    
    try {
      // Example: Scrape a single product
      const singleProductUrl = 'https://kmonstar.org/products/example';
      await scraper.init();
      await scraper.navigateToProduct(singleProductUrl);
      const productData = await scraper.extractProductData();
      console.log('Product Data:', JSON.stringify(productData, null, 2));
      await scraper.close();

      // Example: Scrape multiple products
      // const urls = ['url1', 'url2', 'url3'];
      // const products = await scraper.scrapeProducts(urls);
      // await scraper.saveData('kmonstar-products.json');

      // Example: Scrape listing page
      // const listingUrl = 'https://kmonstar.org/products';
      // const productLinks = await scraper.scrapeProductListing(listingUrl);
      // const allProducts = await scraper.scrapeProducts(productLinks);
      // await scraper.saveData('all-products.json');
    } catch (error) {
      console.error('Script error:', error);
      process.exit(1);
    }
  })();
}
