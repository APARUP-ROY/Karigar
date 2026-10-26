# Karigar (कारीगर) — The Indian Handcrafted & Artisan Marketplace

> **"Made slowly. Kept forever."**  
> Karigar is a modern, responsive, and privacy-respecting artisan marketplace connecting India's master craftspeople directly with thoughtful consumers worldwide. Built with **React 19**, **TypeScript**, **Vite 6**, **Express 5**, and Node.js native **SQLite**.

---

## The Problem Statement

India is home to over **200 million craftspeople and artisans**, representing the second-largest livelihood source after agriculture. Despite boasting thousands of years of intangible cultural heritage, the indigenous handicraft ecosystem suffers from severe structural vulnerabilities:

1. **Exploitative Middlemen & Margin Erosion**: Traditional supply chains involve 3 to 5 layers of traders, wholesalers, and exporters. Rural artisans typically receive less than **15% to 20%** of the final retail price, pushing generational craft clusters into economic distress.
2. **Digital Exclusion & High SaaS Barriers**: Mainstream e-commerce giants impose prohibitive seller fees, rigid logistical requirements, complex tax compliance overheads, and English-only algorithmic seller portals that alienate rural master artisans.
3. **Mass-Production & Counterfeits**: Powerloom textiles and plastic/machine-pressed trinkets flooding open marketplaces masquerade as "ethnic" or "handmade." This dilutes certified **Geographical Indication (GI)** craft heritages such as Jaipur Blue Pottery, Bastar Dhokra, and Kutch Ahir embroidery.
4. **Erasure of the Artisan's Voice**: Commercial platforms commoditize products while erasing the maker's identity. Shoppers have no transparency into who made their product, which craft tradition was preserved, or where their money goes.

---

## The Solution: Karigar

**Karigar** (meaning *Master Artisan / Craftsman* in Hindi and Urdu) solves these challenges through an ethical, direct-to-maker platform designed with simplicity, provenance, and performance at its core:

* **Direct Maker-to-Consumer (M2C) Architecture**: Artisans publish their works directly, set their own fair prices, tell their workshop stories, and receive order requests without intermediaries skimming margins.
* **Preserving Provenance & GI Heritage**: Every item in Karigar is mapped to its authentic craft cluster, geographical origin, and master artisan — celebrating techniques such as *Cire Perdue* (lost-wax casting), *Dabu* mud-resist block printing, and 16-stage natural indigo dyeing.
* **Contextual Co-Purchase & Craft-Affinity Recommendations**: A lightweight, transparent recommendation algorithm recommends complementary craft traditions (e.g., paired pottery and handloom textiles) without creepy behavioral tracking or predatory ad pixels.
* **Zero-Cloud, High-Performance Local-First Core**: Built using Node.js native `DatabaseSync` SQLite with Write-Ahead Logging (WAL). It requires **zero third-party cloud accounts, no external database servers, and no Firebase services**, ensuring full data sovereignty and effortless deployment.
* **Dual-Role Workflow & Dedicated Maker Studio**: Separate, tailored interfaces for conscious buyers (browsing, saving favourites, order-request checkout, purchase histories) and artisans (shop listings, inventory control, incoming order queues).

---

## Key Features

### For Connoisseurs & Conscious Buyers
* **Curated Craft Catalogue**: Search, filter by craft discipline (Pottery, Textiles, Metalwork, Woodwork, Home & Living), and sort by price or featured curation.
* **Rich Provenance Details**: Discover the artisan's name, region, raw materials, sustainable certifications, and craft lineage.
* **Fast Shopping Bag & Mock Checkout**: Interactive drawer bag with dynamic delivery fee computation (free delivery on orders over ₹3,000) and order-request submission.
* **Account Dashboard & Saved Favourites**: Track placed order statuses (`received`), revisit saved pieces, and view personalized craft recommendations based on order history.

### For Independent Artisans & Cooperatives
* **Maker Studio Dashboard**: Overview of live active listings, total pieces ordered, and workshop location.
* **Self-Publishing Listing Pipeline**: Intuitive listing creation form with title, price in INR, craft categorization, image URL, and craft narrative.
* **Order Fulfillment Queue**: View incoming buyer orders with reference codes, shipping destinations, and quantities.

### Intelligent Recommendation Engine
* **Co-Purchase Affinity Ranking**: Evaluates historical orders where products were purchased together, surfacing items with shared order frequency.
* **Same-Craft Fallback**: If co-purchase history is nascent, the engine dynamically falls back to products within the same craft category and comparable price bracket.

### Security & Privacy
* **Cryptographic Scrypt Hashing**: Passwords hashed using Node.js native `crypto.scrypt` with unique salt per user.
* **Hashed Session Tokens**: Session IDs stored in secure, `HttpOnly`, `SameSite=Lax` cookies with SHA-256 hashed database storage.
* **Defensive HTTP Headers**: Powered by `helmet` with strict Content Security Policy (CSP).
* **Rate Limiting**: Protected against brute-force attacks on authentication and checkout endpoints using `express-rate-limit`.

---

## Featured Craft Traditions

| Craft Tradition | Region | Technique & Material | Certified Heritage |
| :--- | :--- | :--- | :--- |
| **Jaipur Blue Pottery** | Jaipur, Rajasthan | Quartz powder, Fuller's earth, hand-painted cobalt arabesques | GI Tagged |
| **Kutch Ahir Embroidery** | Bhuj, Gujarat | Heavy canvas, fine needlework, *abhala* circular mirror-work | Handcrafted Heritage |
| **Bastar Dhokra** | Bastar, Chhattisgarh | 4,000-year-old lost-wax casting (*cire perdue*) with recycled brass | Ancient Tribal Metalcraft |
| **Sanganeri Dabu Block Print**| Sanganer, Rajasthan | Hand-carved teakwood blocks, mud-resist *dabu*, vegetable dyes | GI Tagged |
| **Molela Terracotta** | Molela, Rajasthan | Banas river alluvial clay, hand-moulded votive figures, open wood kiln | Regional Master Heritage |
| **Dhamadka Ajrakh** | Dhamadka, Gujarat | 16-stage resist dyeing, natural indigo, madder root, modal silk | Heritage Textile Art |
| **Banarasi Katan Silk Brocade**| Varanasi, Uttar Pradesh| Pure mulberry katan silk, hand-woven floral *kadhwa* gold zari | Master Weaver Lineage |
| **Bidriware Metalwork** | Bidar, Karnataka | Zinc-copper alloy, fort soil oxidation, 99.9% pure silver inlay | GI Tagged |
| **Saharanpur Woodcraft** | Saharanpur, Uttar Pradesh| Responsibly harvested Sheesham wood, hand-chiseled facets, walnut oil | Master Woodcraft |
| **Kashmir Walnut Woodcarving** | Srinagar, Kashmir | Wild seasoned walnut wood, three-dimensional *chinar* leaf relief | GI Tagged |
| **Prayagraj Moonj Weaving** | Prayagraj, UP | Sun-bleached wild riverbed moonj grass, coiled by women's co-ops | Eco-Friendly Grasscraft |
| **Khurja Studio Pottery** | Khurja, Uttar Pradesh | Wheel-thrown stoneware, reactive speckled earthen glaze, high-fired | Historical Ceramics Hub |
| **Mayurbhanj Sabai Grass** | Mayurbhanj, Odisha | Wild golden sabai grass, palm cordage, hand-plaited tribal baskets | Tribal Cooperative Craft |

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT ARCHITECTURE                      │
│     React 19  ·  TypeScript  ·  Vite 6  ·  Lucide Icons     │
│        Custom Warm-Editorial Design System (DM Sans)        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON API Proxy
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVER ARCHITECTURE                      │
│        Express 5  ·  Node.js 22  ·  Zod Schema Engine       │
│           Helmet CSP  ·  Express-Rate-Limit Security        │
└──────────────────────────────┬──────────────────────────────┘
                               │ Synchronous Native Binding
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATABASE ENGINE                         │
│           Node.js Native SQLite (node:sqlite)               │
│          Write-Ahead Logging (WAL) Mode  ·  scrypt          │
└─────────────────────────────────────────────────────────────┘
```

### Core Technologies
* **Frontend**:
  * [React 19](https://react.dev/) — Latest React primitives, functional components, and hooks (`useMemo`, `useState`, `useEffect`).
  * [TypeScript](https://www.typescriptlang.org/) — Strict static typing across client and server contract types.
  * [Vite 6](https://vitejs.dev/) — Ultra-fast HMR and optimized production bundle compilation.
  * [Lucide React](https://lucide.dev/) — Clean, accessible iconography.
  * Custom CSS Design System — Bespoke typography (`DM Sans` & `Manrope`), fluid responsive grid, and warm earthy tones.

* **Backend**:
  * [Express 5](https://expressjs.com/) — Fast, minimalist REST API routing.
  * [Node.js 22 `node:sqlite`](https://nodejs.org/api/sqlite.html) — Built-in native SQLite bindings via `DatabaseSync` for zero external DB server dependency.
  * [Zod](https://zod.dev/) — Runtime payload validation for authentication, order requests, and new product listings.
  * [Helmet](https://helmetjs.github.io/) — HTTP security headers and Content Security Policy directives.
  * [Express-Rate-Limit](https://github.com/express-rate-limit/express-rate-limit) — Brute-force and DDoS mitigation.

---

## Project Structure

```
Artisans/
├── database/
│   ├── karigar.db              # Local SQLite database (WAL mode, auto-created)
│   └── .gitkeep                # Directory anchor
├── server/
│   ├── index.js                # Express 5 server, SQLite schemas, auth & REST API
│   └── products.js             # Initial authentic Indian artisan catalogue data
├── src/
│   ├── api.ts                  # Fetch abstraction & error handling
│   ├── App.tsx                 # Primary storefront, bag, checkout & dashboard UI
│   ├── main.tsx                # React application entry point
│   ├── styles.css              # Custom editorial design system & responsive layout
│   ├── types.ts                # TypeScript interfaces for products, orders & users
│   └── vite-env.d.ts           # Vite type declarations
├── index.html                  # HTML entry point with Google Fonts integration
├── package.json                # Dependencies and build/run scripts
├── tsconfig.json               # Root TypeScript configuration
├── tsconfig.app.json           # Application TypeScript configuration
└── vite.config.ts              # Vite server & API proxy configuration
```

---

## Getting Started

### Prerequisites
* **Node.js**: Version **22.13.0** or newer (with built-in `node:sqlite` support)
* **npm**: Version **10+**

### 1. Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/APARUP-ROY/Karigar.git
cd Karigar
npm install
```

### 2. Run in Development Mode
Start both the Express 5 API and the Vite development server concurrently:

```bash
npm run dev
```

* **Storefront UI**: `http://localhost:5173`
* **API Server**: `http://localhost:4000` (Vite automatically proxies `/api/*` calls to port 4000)
* On first launch, the server automatically initializes `database/karigar.db` with all 13 authentic handcrafted artisan items.

### 3. Production Build & Execution
Compile the TypeScript frontend and run the production server:

```bash
# Build the optimized client bundle
npm run build

# Run server in production mode
npm start
```
In production mode, the Express server serves the static assets in `dist/` alongside the `/api` routes from a single unified port.

---

## REST API Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status check | Public |
| `GET` | `/api/products` | Retrieve searchable, filterable, and sorted product catalogue | Public |
| `GET` | `/api/artisans` | Retrieve list of active craftspeople represented in catalogue | Public |
| `GET` | `/api/recommendations`| Retrieve co-purchase or craft-affinity recommendations | Public |
| `POST`| `/api/auth/signup` | Create a new Buyer or Artisan account | Public |
| `POST`| `/api/auth/login` | Authenticate existing user and issue HttpOnly session cookie | Public |
| `POST`| `/api/auth/logout` | Terminate session and invalidate session cookie | Authenticated |
| `GET` | `/api/auth/me` | Fetch currently authenticated user profile | Authenticated |
| `GET` | `/api/dashboard` | Retrieve buyer orders/favourites or artisan shop inventory | Authenticated |
| `POST`| `/api/products` | Publish a new handmade piece to the marketplace | Artisan Only |
| `POST`| `/api/favorites` | Save a product to buyer's favourites list | Buyer Only |
| `DELETE`| `/api/favorites/:id`| Remove a product from buyer's favourites list | Buyer Only |
| `POST`| `/api/orders` | Submit a mock order request for items in shopping bag | Buyer Only |
| `POST`| `/api/newsletter` | Subscribe to artisan stories newsletter | Public |

---

## Environment Variables

Configuration options can be supplied via environment variables (see `.env.example`):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `4000` | Port for the Express API / Production server |
| `DATABASE_PATH` | `./database/karigar.db` | Relative or absolute path to SQLite database file |
| `NODE_ENV` | `development` | Set to `production` when serving compiled assets |

---

## License & Attribution

* **Code License**: MIT License. Open source and free for artisans and developers worldwide.
* **Imagery**: Product and craft imagery curated under the [Unsplash License](https://unsplash.com/license) celebrating traditional Indian craftspeople.
* **Mission**: Dedicated to the preservation, economic empowerment, and digital independence of India's artisan communities.
