import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import { initialProducts } from './products.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(directory, '..');
const databasePath = path.resolve(projectRoot, process.env.DATABASE_PATH ?? './database/karigar.db');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
const scrypt = promisify(crypto.scrypt);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price > 0),
    category TEXT NOT NULL,
    category_slug TEXT NOT NULL,
    artisan TEXT NOT NULL,
    location TEXT NOT NULL,
    image TEXT NOT NULL,
    image_alt TEXT NOT NULL,
    label TEXT,
    description TEXT NOT NULL,
    owner_user_id TEXT
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    items_json TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    shipping INTEGER NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'received',
    created_at TEXT NOT NULL,
    user_id TEXT
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('buyer', 'artisan')),
    store_name TEXT,
    location TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, product_id)
  );
  CREATE TABLE IF NOT EXISTS order_items (
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    artisan TEXT NOT NULL,
    price INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    PRIMARY KEY (order_id, product_id)
  );
  CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    email TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
  CREATE INDEX IF NOT EXISTS products_category_slug_idx ON products(category_slug);
  CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items(product_id);
`);

const productColumns = new Set(database.prepare('PRAGMA table_info(products)').all().map((column) => column.name));
if (!productColumns.has('owner_user_id')) {
  database.exec('ALTER TABLE products ADD COLUMN owner_user_id TEXT');
}
const orderColumns = new Set(database.prepare('PRAGMA table_info(orders)').all().map((column) => column.name));
if (!orderColumns.has('user_id')) {
  database.exec('ALTER TABLE orders ADD COLUMN user_id TEXT');
}

const upsertProduct = database.prepare(`
    INSERT INTO products (id, name, price, category, category_slug, artisan, location, image, image_alt, label, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      price = excluded.price,
      category = excluded.category,
      category_slug = excluded.category_slug,
      artisan = excluded.artisan,
      location = excluded.location,
      image = excluded.image,
      image_alt = excluded.image_alt,
      label = excluded.label,
      description = excluded.description
    WHERE products.owner_user_id IS NULL
  `);
for (const product of initialProducts) {
  upsertProduct.run(
    product.id,
    product.name,
    product.price,
    product.category,
    product.categorySlug,
    product.artisan,
    product.location,
    product.image,
    product.imageAlt,
    product.label,
    product.description,
  );
}

const backfillOrderItems = database.prepare(
  'INSERT OR IGNORE INTO order_items (order_id, product_id, product_name, artisan, price, quantity) VALUES (?, ?, ?, ?, ?, ?)',
);
for (const order of database.prepare('SELECT id, items_json FROM orders').all()) {
  let items;
  try {
    items = JSON.parse(order.items_json);
  } catch (error) {
    console.error(`Could not migrate order items for order ${order.id}:`, error);
    continue;
  }
  if (!Array.isArray(items)) continue;
  for (const item of items) {
    if (
      typeof item.productId === 'string' &&
      typeof item.name === 'string' &&
      typeof item.artisan === 'string' &&
      Number.isSafeInteger(item.price) &&
      Number.isSafeInteger(item.quantity) &&
      database.prepare('SELECT 1 FROM products WHERE id = ?').get(item.productId)
    ) {
      backfillOrderItems.run(order.id, item.productId, item.name, item.artisan, item.price, item.quantity);
    }
  }
}

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'https:'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https:', 'data:'],
      },
    },
  }),
);
app.use(express.json({ limit: '20kb' }));

const toProduct = (row) => ({
  id: row.id,
  name: row.name,
  price: row.price,
  category: row.category,
  categorySlug: row.category_slug,
  artisan: row.artisan,
  location: row.location,
  image: row.image,
  imageAlt: row.image_alt,
  label: row.label,
  description: row.description,
});

const toUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  storeName: row.store_name,
  location: row.location,
});

const sessionLifetimeSeconds = 60 * 60 * 24 * 30;
const sessionCookieName = 'karigar_session';

function readCookies(request) {
  const cookies = new Map();
  for (const cookie of (request.headers.cookie ?? '').split(';')) {
    const separator = cookie.indexOf('=');
    if (separator > 0) cookies.set(cookie.slice(0, separator).trim(), cookie.slice(separator + 1).trim());
  }
  return cookies;
}

function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionLifetimeSeconds}${secure}`,
  );
}

function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `${sessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
}

function currentUser(request) {
  const token = readCookies(request).get(sessionCookieName);
  if (!token || !/^[\da-f]{64}$/.test(token)) return null;
  const session = database
    .prepare(`
      SELECT users.* FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `)
    .get(crypto.createHash('sha256').update(token).digest('hex'), new Date().toISOString());
  return session ?? null;
}

function requireUser(request, response, role) {
  const user = currentUser(request);
  if (!user) {
    clearSessionCookie(response);
    response.status(401).json({ error: 'Please sign in to continue.' });
    return null;
  }
  if (role && user.role !== role) {
    response.status(403).json({ error: `This page is for ${role}s.` });
    return null;
  }
  return user;
}

async function createSession(userId, response) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000).toISOString();
  database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash, userId, expiresAt);
  setSessionCookie(response, token);
}

const coerceUniqueQuery = (value, maxLength) => {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    return undefined;
  }
  return value.trim();
};

function getRecommendations(productId, limit = 4) {
  const seed = productId ? database.prepare('SELECT * FROM products WHERE id = ?').get(productId) : null;
  if (productId && !seed) return { products: [], basis: 'similar' };
  if (seed) {
    const rows = database.prepare(`
      SELECT recommended.id, COUNT(DISTINCT shared.order_id) AS co_purchases,
        SUM(shared.quantity) AS quantity
      FROM order_items AS seed_item
      JOIN order_items AS shared ON shared.order_id = seed_item.order_id
      JOIN products AS recommended ON recommended.id = shared.product_id
      WHERE seed_item.product_id = ? AND shared.product_id != ?
      GROUP BY recommended.id
      ORDER BY co_purchases DESC, quantity DESC, recommended.id ASC
      LIMIT ?
    `).all(seed.id, seed.id, limit);
    const ranked = rows.map((row) => database.prepare('SELECT * FROM products WHERE id = ?').get(row.id));
    if (ranked.length >= limit) return { products: ranked.map(toProduct), basis: 'community' };
    const alreadyIncluded = new Set([seed.id, ...ranked.map((product) => product.id)]);
    const fallback = database.prepare(`
      SELECT * FROM products
      WHERE id != ?
      ORDER BY CASE WHEN category_slug = ? THEN 0 ELSE 1 END, ABS(price - ?) ASC, name COLLATE NOCASE
    `).all(seed.id, seed.category_slug, seed.price);
    const recommendations = [
      ...ranked,
      ...fallback.filter((product) => !alreadyIncluded.has(product.id)),
    ].slice(0, limit);
    return { products: recommendations.map(toProduct), basis: ranked.length ? 'community' : 'similar' };
  }

  const popular = database.prepare(`
    SELECT products.*, SUM(order_items.quantity) AS purchased
    FROM order_items JOIN products ON products.id = order_items.product_id
    GROUP BY products.id ORDER BY purchased DESC, products.id ASC LIMIT ?
  `).all(limit).map((row) => toProduct(row));
  const included = new Set(popular.map((product) => product.id));
  const fallback = database.prepare('SELECT * FROM products ORDER BY rowid ASC LIMIT ?').all(limit);
  const recommendations = [...popular, ...fallback.filter((product) => !included.has(product.id))]
    .slice(0, limit).map((product) => ('category_slug' in product ? toProduct(product) : product));
  return { products: recommendations, basis: popular.length ? 'community' : 'popular' };
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

const signUpSchema = z.discriminatedUnion('role', [
  z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(128),
    role: z.literal('buyer'),
  }),
  z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(128),
    role: z.literal('artisan'),
    storeName: z.string().trim().min(2).max(100),
    location: z.string().trim().min(2).max(120),
  }),
]);

const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });

app.get('/api/auth/me', (request, response) => {
  const user = currentUser(request);
  response.json({ user: user ? toUser(user) : null });
});

app.post('/api/auth/signup', authRateLimit, async (request, response) => {
  const parsed = signUpSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Please check your details and try again.' });
  const data = parsed.data;
  const email = data.email.toLowerCase();
  if (database.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return response.status(409).json({ error: 'An account with this email already exists.' });
  }
  const salt = crypto.randomBytes(16);
  const passwordHash = await scrypt(data.password, salt, 64);
  const id = crypto.randomUUID();
  try {
    database.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, store_name, location, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      email,
      `${salt.toString('hex')}:${Buffer.from(passwordHash).toString('hex')}`,
      data.role,
      data.role === 'artisan' ? data.storeName : null,
      data.role === 'artisan' ? data.location : null,
      new Date().toISOString(),
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed: users.email')) {
      return response.status(409).json({ error: 'An account with this email already exists.' });
    }
    throw error;
  }
  const user = database.prepare('SELECT * FROM users WHERE id = ?').get(id);
  await createSession(id, response);
  response.status(201).json({ user: toUser(user) });
});

app.post('/api/auth/login', authRateLimit, async (request, response) => {
  const parsed = z.object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(128),
  }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Enter a valid email and password.' });
  const user = database.prepare('SELECT * FROM users WHERE email = ?').get(parsed.data.email.toLowerCase());
  if (!user) return response.status(401).json({ error: 'Email or password is incorrect.' });
  const [saltHex, expectedHex] = user.password_hash.split(':');
  const actual = Buffer.from(await scrypt(parsed.data.password, Buffer.from(saltHex, 'hex'), 64));
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return response.status(401).json({ error: 'Email or password is incorrect.' });
  }
  await createSession(user.id, response);
  response.json({ user: toUser(user) });
});

app.post('/api/auth/logout', (request, response) => {
  const token = readCookies(request).get(sessionCookieName);
  if (token && /^[\da-f]{64}$/.test(token)) {
    database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(crypto.createHash('sha256').update(token).digest('hex'));
  }
  clearSessionCookie(response);
  response.json({ signedOut: true });
});

app.get('/api/recommendations', (request, response) => {
  const productId = coerceUniqueQuery(request.query.productId, 80);
  const limit = Math.min(Math.max(Number(request.query.limit) || 4, 1), 8);
  response.json(getRecommendations(productId, limit));
});

app.get('/api/products', (request, response) => {
  const query = z
    .object({
      category: z.string().trim().max(60).optional(),
      search: z.string().trim().max(100).optional(),
      sort: z.enum(['featured', 'price-asc', 'price-desc']).default('featured'),
    })
    .safeParse(request.query);

  if (!query.success) {
    return response.status(400).json({ error: 'Invalid product filters.' });
  }

  const { category, search, sort } = query.data;
  const conditions = [];
  const parameters = [];
  if (category && category !== 'all') {
    conditions.push('category_slug = ?');
    parameters.push(category);
  }
  if (search) {
    conditions.push('(name LIKE ? OR artisan LIKE ? OR category LIKE ? OR location LIKE ?)');
    const term = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    parameters.push(term, term, term, term);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = sort === 'price-asc' ? 'price ASC, name ASC' : sort === 'price-desc' ? 'price DESC, name ASC' : 'rowid ASC';
  const rows = database
    .prepare(`SELECT * FROM products ${where} ORDER BY ${orderBy}`)
    .all(...parameters);
  response.json({ products: rows.map(toProduct) });
});

app.get('/api/artisans', (_request, response) => {
  const artisans = database
    .prepare(`
      SELECT artisan AS name, location, category, image, image_alt
      FROM products
      GROUP BY artisan
      ORDER BY artisan COLLATE NOCASE
    `)
    .all();
  response.json({ artisans });
});

app.get('/api/dashboard', (request, response) => {
  const user = requireUser(request, response);
  if (!user) return;
  if (user.role === 'buyer') {
    const orders = database.prepare(`
      SELECT reference, items_json AS itemsJson, subtotal, shipping, total, status, created_at AS createdAt
      FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(user.id).map((order) => ({ ...order, items: JSON.parse(order.itemsJson) }));
    const latestPurchasedProduct = database.prepare(`
      SELECT order_items.product_id AS productId
      FROM orders JOIN order_items ON order_items.order_id = orders.id
      WHERE orders.user_id = ?
      ORDER BY orders.created_at DESC, order_items.product_name COLLATE NOCASE
      LIMIT 1
    `).get(user.id);
    const favorites = database.prepare(`
      SELECT products.* FROM favorites
      JOIN products ON products.id = favorites.product_id
      WHERE favorites.user_id = ?
      ORDER BY favorites.created_at DESC
    `).all(user.id).map(toProduct);
    return response.json({
      dashboard: {
        role: 'buyer',
        orders,
        favorites,
        recommendations: getRecommendations(latestPurchasedProduct?.productId, 4).products,
      },
    });
  }
  const products = database.prepare('SELECT * FROM products WHERE owner_user_id = ? ORDER BY rowid DESC').all(user.id);
  const orders = database.prepare(`
    SELECT orders.reference, orders.status, orders.created_at AS createdAt,
      order_items.product_name AS productName, order_items.quantity, order_items.price,
      orders.customer_name AS customerName, orders.city
    FROM orders
    JOIN order_items ON order_items.order_id = orders.id
    JOIN products ON products.id = order_items.product_id
    WHERE products.owner_user_id = ?
    ORDER BY orders.created_at DESC LIMIT 30
  `).all(user.id);
  response.json({ dashboard: { role: 'artisan', products: products.map(toProduct), orders } });
});

app.post('/api/favorites', (request, response) => {
  const user = requireUser(request, response, 'buyer');
  if (!user) return;
  const parsed = z.object({ productId: z.string().min(1).max(80) }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Choose a valid product to save.' });
  const productExists = database.prepare('SELECT 1 FROM products WHERE id = ?').get(parsed.data.productId);
  if (!productExists) return response.status(404).json({ error: 'That product is no longer available.' });
  database.prepare('INSERT OR IGNORE INTO favorites (user_id, product_id, created_at) VALUES (?, ?, ?)').run(
    user.id,
    parsed.data.productId,
    new Date().toISOString(),
  );
  response.status(201).json({ saved: true });
});

app.delete('/api/favorites/:productId', (request, response) => {
  const user = requireUser(request, response, 'buyer');
  if (!user) return;
  const productId = z.string().min(1).max(80).safeParse(request.params.productId);
  if (!productId.success) return response.status(400).json({ error: 'Choose a valid product to remove.' });
  database.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').run(user.id, productId.data);
  response.json({ saved: false });
});

app.post('/api/products', (request, response) => {
  const user = requireUser(request, response, 'artisan');
  if (!user) return;
  const parsed = z.object({
    name: z.string().trim().min(3).max(120),
    price: z.number().int().min(1).max(10000000),
    category: z.enum(['Pottery', 'Textiles', 'Metalwork', 'Home & living', 'Woodwork']),
    image: z.string().url().max(1000).refine((value) => value.startsWith('https://'), 'Use a secure image URL.'),
    description: z.string().trim().min(10).max(1000),
  }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Please check the listing details and try again.' });
  const categorySlugs = {
    Pottery: 'pottery',
    Textiles: 'textiles',
    Metalwork: 'metalwork',
    'Home & living': 'home-living',
    Woodwork: 'woodwork',
  };
  const product = {
    id: crypto.randomUUID(),
    name: parsed.data.name,
    price: parsed.data.price,
    category: parsed.data.category,
    categorySlug: categorySlugs[parsed.data.category],
    artisan: user.store_name,
    location: user.location,
    image: parsed.data.image,
    imageAlt: `${parsed.data.name}, made by ${user.store_name}`,
    label: 'Made by an artisan',
    description: parsed.data.description,
  };
  database.prepare(`
    INSERT INTO products (id, name, price, category, category_slug, artisan, location, image, image_alt, label, description, owner_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    product.id, product.name, product.price, product.category, product.categorySlug,
    product.artisan, product.location, product.image, product.imageAlt,
    product.label, product.description, user.id,
  );
  response.status(201).json({ product });
});

app.post(
  '/api/newsletter',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }),
  (request, response) => {
    const parsed = z.object({ email: z.string().trim().email().max(254) }).safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({ error: 'Please enter a valid email address.' });
    }
    database
      .prepare('INSERT OR IGNORE INTO newsletter_subscribers (email, created_at) VALUES (?, ?)')
      .run(parsed.data.email.toLowerCase(), new Date().toISOString());
    response.status(201).json({ subscribed: true });
  },
);

const itemSchema = z.object({
  productId: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(10),
});

const orderSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  address: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().min(3).max(16),
  items: z.array(itemSchema).min(1).max(30),
});

app.post(
  '/api/orders',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }),
  (request, response) => {
    const user = requireUser(request, response, 'buyer');
    if (!user) return;
    const parsed = orderSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({
        error: 'Please check your details and try again.',
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const quantities = new Map();
    for (const item of parsed.data.items) {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }
    if ([...quantities.values()].some((quantity) => quantity > 10)) {
      return response.status(400).json({ error: 'You can order up to 10 of each item.' });
    }

    const ids = [...quantities.keys()];
    const products = database
      .prepare(`SELECT id, name, price, artisan FROM products WHERE id IN (${ids.map(() => '?').join(',')})`)
      .all(...ids);
    if (products.length !== ids.length) {
      return response.status(400).json({ error: 'One or more items are no longer available.' });
    }

    const productsById = new Map(products.map((product) => [product.id, product]));
    const items = ids.map((id) => {
      const product = productsById.get(id);
      return {
        productId: product.id,
        name: product.name,
        artisan: product.artisan,
        price: product.price,
        quantity: quantities.get(id),
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = subtotal >= 3000 ? 0 : 150;
    const total = subtotal + shipping;
    const id = crypto.randomUUID();
    const reference = `KG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const createdAt = new Date().toISOString();

    const insertOrder = database.prepare(`
      INSERT INTO orders (
        id, reference, customer_name, email, address, city, postal_code,
        items_json, subtotal, shipping, total, created_at, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertOrderItem = database.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, artisan, price, quantity)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    database.exec('BEGIN IMMEDIATE');
    try {
      insertOrder.run(
        id,
        reference,
        parsed.data.customerName,
        parsed.data.email,
        parsed.data.address,
        parsed.data.city,
        parsed.data.postalCode,
        JSON.stringify(items),
        subtotal,
        shipping,
        total,
        createdAt,
        user.id,
      );
      for (const item of items) {
        insertOrderItem.run(id, item.productId, item.name, item.artisan, item.price, item.quantity);
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }

    response.status(201).json({ order: { reference, items, subtotal, shipping, total, createdAt } });
  },
);

if (process.env.NODE_ENV === 'production') {
  const buildDirectory = path.join(projectRoot, 'dist');
  app.use(express.static(buildDirectory));
  app.get('*path', (_request, response) => response.sendFile(path.join(buildDirectory, 'index.html')));
}

app.use((error, _request, response, _next) => {
  console.error(error);
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ error: 'Request body must contain valid JSON.' });
  }
  response.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Karigar API listening on http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      database.close();
      process.exit(0);
    });
  });
}
