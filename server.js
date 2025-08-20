const express = require('express');
const path = require('path');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const { neon } = require('@netlify/neon');
require('dotenv').config();

const app = express();
const sql = neon();

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'olatech_simple_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
  })
);

// Static
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
async function setupDatabase() {
    await sql`
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            price NUMERIC NOT NULL,
            category TEXT NOT NULL,
            subCategory TEXT,
            imageUrl TEXT,
            status TEXT DEFAULT 'available',
            createdAt TIMESTAMP DEFAULT current_timestamp
        );
    `;
}

// API: Products
app.get('/api/products', async (req, res) => {
    const { category, subCategory } = req.query;
    let products;
    if (category) {
        products = await sql`SELECT * FROM products WHERE category = ${category}`;
    } else {
        products = await sql`SELECT * FROM products`;
    }

    if (subCategory) {
        products = products.filter(p => p.subcategory === subCategory);
    }

    res.json(products);
});

// Admin: Create product
app.post('/api/admin/products', async (req, res) => {
    try {
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        if (req.body.password !== adminPassword) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { title, description, price, category, subCategory, image } = req.body;
        const id = uuidv4();

        await sql`
            INSERT INTO products (id, title, description, price, category, subCategory, imageUrl)
            VALUES (${id}, ${title}, ${description}, ${price}, ${category}, ${subCategory}, ${image})
        `;

        res.status(201).json({ id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// Admin: Update product
app.put('/api/admin/products/:id', async (req, res) => {
    try {
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        if (req.body.password !== adminPassword) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const { title, description, price, category, subCategory, image } = req.body;

        await sql`
            UPDATE products
            SET title = ${title}, description = ${description}, price = ${price}, category = ${category}, subCategory = ${subCategory}, imageUrl = ${image}
            WHERE id = ${id}
        `;

        res.json({ id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Admin: Mark product as sold
app.post('/api/admin/products/:id/sold', async (req, res) => {
    try {
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        if (req.body.password !== adminPassword) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;

        await sql`
            UPDATE products
            SET status = 'sold'
            WHERE id = ${id}
        `;

        res.json({ id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Admin: Delete product
app.delete('/api/admin/products/:id', async (req, res) => {
    try {
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        if (req.query.password !== adminPassword) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;

        await sql`
            DELETE FROM products
            WHERE id = ${id}
        `;

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Cart helpers
function ensureCart(req) {
  if (!req.session.cart) req.session.cart = [];
  return req.session.cart;
}

// API: Get cart
app.get('/api/cart', (req, res) => {
  const cart = ensureCart(req);
  res.json(cart);
});

// API: Add to cart
app.post('/api/cart/add', async (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId is required' });
  const qty = Math.max(1, Number(quantity || 1));
  const [product] = await sql`SELECT * FROM products WHERE id = ${productId}`;
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const cart = ensureCart(req);
  const existing = cart.find((i) => i.product.id === productId);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ product, quantity: qty });
  }
  res.json(cart);
});

// API: Update cart item quantity
app.post('/api/cart/update', (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId is required' });
  const qty = Math.max(0, Number(quantity || 0));
  const cart = ensureCart(req);
  const index = cart.findIndex((i) => i.product.id === productId);
  if (index === -1) return res.status(404).json({ error: 'Item not found in cart' });
  if (qty === 0) {
    cart.splice(index, 1);
  } else {
    cart[index].quantity = qty;
  }
  res.json(cart);
});

// API: Clear cart
app.post('/api/cart/clear', (req, res) => {
  req.session.cart = [];
  res.json({ ok: true });
});

// Fallback route to index
app.get('*', (req, res, next) => {
  const accept = req.headers.accept || '';
  if (accept.includes('text/html')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

setupDatabase();

module.exports = app;

