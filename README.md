# Kmonstar Sales Tracker

A Node.js & React-based system for scraping product/variant/stock/order data from [kmonstar.org](https://kmonstar.org) and visualizing in a simple dashboard.

## Features

- Scrape product variants and stock levels (via Puppeteer)
- Track orders and display confirmed quantity
- API endpoints (Express/Node.js) and SQLite database
- Real-time dashboard (React)

## Setup

### 0. Requirements

- Node.js v16+
- npm v8+
- (Optionally) [Google Chrome](https://www.google.com/chrome/) – recommended for Puppeteer reliability

### 1. Clone and Install

```bash
git clone https://github.com/rowannie/track.git
cd track
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update as needed.

```bash
cp .env.example .env
```

### 3. Run Local Database Migrations

Database is SQLite and auto-initializes from `db.js`.

### 4. Start Backend

```
npm run start
```

You should see API available at: [http://localhost:5000/api](http://localhost:5000/api)

### 5. Start Frontend (React Dashboard)

```bash
cd client
npm install
npm start
```

Access the dashboard at [http://localhost:3000/](http://localhost:3000/)

## Usage

- Scrape product data:
  - Set product URLs in `scraper.js` and run (`node scraper.js`)
- Use API endpoints to fetch/update products, variants, orders
- View real-time dashboard at `/dashboard`

## Disclaimer

- This project is for educational use.
- Web scraping commercial sites may violate their Terms of Service.
- Use responsibly!

## File Overview

- `server.js` – Express backend/API
- `db.js` – Database setup (SQLite)
- `scraper.js` – Scraping logic (Puppeteer)
- `client/` – React dashboard app

## License

MIT
