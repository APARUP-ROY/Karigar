import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Feather,
  Heart,
  Leaf,
  Menu,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import type { CartLine, OrderReceipt, Product } from './types';
import type { AccountDashboard, AccountUser } from './types';
import { apiFetch } from './api';

const categories = [
  { name: 'Everything', slug: 'all', symbol: '✳' },
  { name: 'Pottery', slug: 'pottery', symbol: '◒' },
  { name: 'Textiles', slug: 'textiles', symbol: '▦' },
  { name: 'Metalwork', slug: 'metalwork', symbol: '⌁' },
  { name: 'Home & living', slug: 'home-living', symbol: '⌂' },
  { name: 'Woodwork', slug: 'woodwork', symbol: '⌘' },
];

const formatPrice = (price: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [notice, setNotice] = useState('');
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [accountMode, setAccountMode] = useState<'login' | 'signup'>('login');
  const [accountRole, setAccountRole] = useState<'buyer' | 'artisan'>('buyer');
  const [accountError, setAccountError] = useState('');
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [dashboard, setDashboard] = useState<AccountDashboard | null>(null);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardRetry, setDashboardRetry] = useState(0);
  const [listingSubmitting, setListingSubmitting] = useState(false);
  const [listingMessage, setListingMessage] = useState('');
  const [recommendationSeed, setRecommendationSeed] = useState('');
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [recommendationBasis, setRecommendationBasis] = useState<'community' | 'similar' | 'popular'>('popular');

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ sort });
    if (activeCategory !== 'all') params.set('category', activeCategory);
    if (search.trim()) params.set('search', search.trim());

    setLoading(true);
    setError('');
    apiFetch(`/api/products?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('We couldn’t load the collection just now. Please try again.');
        return (await response.json()) as { products: Product[] };
      })
      .then((data) => setProducts(data.products))
      .catch((fetchError: unknown) => {
        if (fetchError instanceof Error && fetchError.name !== 'AbortError') {
          setProducts([]);
          setError(fetchError.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [activeCategory, retryCount, search, sort]);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch('/api/auth/me', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('We couldn’t restore your account session.');
        return (await response.json()) as { user: AccountUser | null };
      })
      .then((data) => setUser(data.user))
      .catch((authError: unknown) => {
        if (authError instanceof Error && authError.name !== 'AbortError') {
          setNotice(authError.message);
          window.setTimeout(() => setNotice(''), 3000);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: '4' });
    if (recommendationSeed) params.set('productId', recommendationSeed);
    apiFetch(`/api/recommendations?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('We couldn’t load recommendations.');
        return (await response.json()) as {
          products: Product[];
          basis: 'community' | 'similar' | 'popular';
        };
      })
      .then((data) => {
        setRecommendations(data.products);
        setRecommendationBasis(data.basis);
      })
      .catch((recommendationError: unknown) => {
        if (recommendationError instanceof Error && recommendationError.name !== 'AbortError') {
          setRecommendations([]);
          setNotice(recommendationError.message);
          window.setTimeout(() => setNotice(''), 3000);
        }
      });
    return () => controller.abort();
  }, [recommendationSeed]);

  useEffect(() => {
    if (!dashboardOpen) return;
    const controller = new AbortController();
    setDashboardError('');
    apiFetch('/api/dashboard', { signal: controller.signal })
      .then(async (response) => {
        let data: { dashboard?: AccountDashboard; error?: string };
        try {
          data = (await response.json()) as { dashboard?: AccountDashboard; error?: string };
        } catch {
          throw new Error(
            'The account service returned an unreadable response. Please try again, or restart the app if this continues.',
          );
        }
        if (response.status === 401) {
          const expired = new Error(data.error ?? 'Your session has expired. Please sign in again.');
          expired.name = 'SessionExpiredError';
          throw expired;
        }
        if (!response.ok || !data.dashboard) throw new Error(data.error ?? 'We couldn’t load your dashboard.');
        return data.dashboard;
      })
      .then((data) => {
        setDashboard(data);
        if (data.role === 'buyer') setFavorites((data.favorites ?? []).map((product) => product.id));
      })
      .catch((dashboardFetchError: unknown) => {
        if (dashboardFetchError instanceof Error && dashboardFetchError.name !== 'AbortError') {
          if (dashboardFetchError.name === 'SessionExpiredError') {
            setUser(null);
            setDashboard(null);
            setDashboardOpen(false);
            setAccountMode('login');
            setAccountError('Your session has expired. Please sign in again.');
            setAccountOpen(true);
            return;
          }
          setDashboardError(dashboardFetchError.message);
        }
      });
    return () => controller.abort();
  }, [dashboardOpen, dashboardRetry, user]);

  const cartCount = cart.reduce((count, line) => count + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const shipping = subtotal >= 3000 || subtotal === 0 ? 0 : 150;

  const beginCheckout = () => {
    setCartOpen(false);
    if (user?.role === 'buyer') {
      setCheckoutOpen(true);
      return;
    }
    setPendingCheckout(true);
    setAccountMode('login');
    setAccountRole('buyer');
    setAccountError('Sign in or create a buyer account to continue to checkout.');
    setAccountOpen(true);
  };

  const addToBag = (product: Product) => {
    if (user?.role === 'artisan') {
      setNotice('Artisan accounts can manage their shop; sign in as a buyer to shop.');
      window.setTimeout(() => setNotice(''), 3000);
      return;
    }
    setCart((current) => {
      const match = current.find((line) => line.product.id === product.id);
      if (match) {
        return current.map((line) =>
          line.product.id === product.id ? { ...line, quantity: Math.min(10, line.quantity + 1) } : line,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
    setRecommendationSeed(product.id);
    setNotice(`${product.name} added to your bag`);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const submitAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountSubmitting(true);
    setAccountError('');
    const formData = new FormData(event.currentTarget);
    const payload: Record<string, string> = {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    };
    if (accountMode === 'signup') {
      payload.name = String(formData.get('name') ?? '');
      payload.role = accountRole;
      if (accountRole === 'artisan') {
        payload.storeName = String(formData.get('storeName') ?? '');
        payload.location = String(formData.get('location') ?? '');
      }
    }
    try {
      const response = await apiFetch(`/api/auth/${accountMode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { user?: AccountUser; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error ?? 'We couldn’t sign you in. Please try again.');
      if (pendingCheckout && data.user.role !== 'buyer') {
        const logoutResponse = await apiFetch('/api/auth/logout', { method: 'POST' });
        if (!logoutResponse.ok) throw new Error('We couldn’t switch accounts. Please try signing out and back in.');
        throw new Error('Checkout requires a buyer account. Sign in or create a buyer account to continue.');
      }
      setUser(data.user);
      setAccountOpen(false);
      setAccountError('');
      if (pendingCheckout) {
        setPendingCheckout(false);
        setCheckoutOpen(true);
        return;
      }
      setDashboardOpen(true);
      setDashboard(null);
    } catch (authError) {
      setAccountError(authError instanceof Error ? authError.message : 'We couldn’t sign you in. Please try again.');
    } finally {
      setAccountSubmitting(false);
    }
  };

  const signOut = async () => {
    const response = await apiFetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) {
      setDashboardError('We couldn’t sign you out. Please try again.');
      return;
    }
    setUser(null);
    setDashboard(null);
    setDashboardOpen(false);
    setAccountOpen(false);
  };

  const submitListing = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setListingSubmitting(true);
    setListingMessage('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get('listingName') ?? ''),
      price: Number(data.get('listingPrice')),
      category: String(data.get('listingCategory') ?? ''),
      image: String(data.get('listingImage') ?? ''),
      description: String(data.get('listingDescription') ?? ''),
    };
    try {
      const response = await apiFetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { product?: Product; error?: string };
      if (!response.ok || !result.product) throw new Error(result.error ?? 'We couldn’t publish this listing.');
      setDashboard((current) =>
        current?.role === 'artisan'
          ? { ...current, products: [result.product!, ...(current.products ?? [])] }
          : current,
      );
      form.reset();
      setListingMessage('Your new piece is live in the shop.');
      setRetryCount((count) => count + 1);
    } catch (listingError) {
      setListingMessage(listingError instanceof Error ? listingError.message : 'We couldn’t publish this listing.');
    } finally {
      setListingSubmitting(false);
    }
  };

  const changeQuantity = (productId: string, amount: number) => {
    setCart((current) =>
      current
        .map((line) =>
          line.product.id === productId
            ? { ...line, quantity: Math.max(0, Math.min(10, line.quantity + amount)) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const toggleFavorite = (productId: string) => {
    const removing = favorites.includes(productId);
    setFavorites((current) => removing ? current.filter((id) => id !== productId) : [...current, productId]);
    if (user?.role !== 'buyer') return;
    apiFetch(removing ? `/api/favorites/${encodeURIComponent(productId)}` : '/api/favorites', {
      method: removing ? 'DELETE' : 'POST',
      headers: removing ? undefined : { 'Content-Type': 'application/json' },
      body: removing ? undefined : JSON.stringify({ productId }),
    }).then(async (response) => {
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'We couldn’t update your saved items.');
      }
    }).catch((favoriteError: unknown) => {
      setFavorites((current) => removing ? [...current, productId] : current.filter((id) => id !== productId));
      setNotice(favoriteError instanceof Error ? favoriteError.message : 'We couldn’t update your saved items.');
      window.setTimeout(() => setNotice(''), 3000);
    });
  };

  const submitOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const formData = new FormData(event.currentTarget);
    const payload = {
      customerName: String(formData.get('customerName') ?? ''),
      email: String(formData.get('email') ?? ''),
      address: String(formData.get('address') ?? ''),
      city: String(formData.get('city') ?? ''),
      postalCode: String(formData.get('postalCode') ?? ''),
      items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
    };

    try {
      const response = await apiFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { order?: OrderReceipt; error?: string };
      if (!response.ok || !data.order) {
        throw new Error(data.error ?? 'We couldn’t place your order. Please try again.');
      }
      setReceipt(data.order);
      setCart([]);
      setCheckoutOpen(false);
      setCartOpen(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'We couldn’t place your order. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const subscribe = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewsletterSubmitting(true);
    setNewsletterMessage('');
    const form = event.currentTarget;
    const email = String(new FormData(form).get('email') ?? '');
    try {
      const response = await apiFetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'We couldn’t add you to the list. Please try again.');
      form.reset();
      setNewsletterMessage('You’re on the list. Keep an eye on your inbox!');
    } catch (subscribeError) {
      setNewsletterMessage(
        subscribeError instanceof Error ? subscribeError.message : 'We couldn’t add you to the list. Please try again.',
      );
    } finally {
      setNewsletterSubmitting(false);
    }
  };

  const visibleProducts = useMemo(() => products, [products]);

  return (
    <>
      <div className="announcement">
        <span>Little things, made with a lot of love.</span>
        <span className="announcement-detail">Complimentary shipping on orders over ₹3,000</span>
        <ArrowRight size={14} aria-hidden="true" />
      </div>
      <header className="site-header">
        <div className="header-inner">
          <button className="mobile-menu icon-button" aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'} onClick={() => setMobileNavOpen(!mobileNavOpen)}>
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <a className="wordmark" href="#" aria-label="Karigar home">
            <span className="wordmark-symbol">k<span>.</span></span>
            <span>karigar</span>
          </a>
          <nav className={`main-nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Main navigation">
            <a href="#shop" onClick={() => setMobileNavOpen(false)}>Shop all</a>
            <a href="#makers" onClick={() => setMobileNavOpen(false)}>Meet the makers</a>
            <a href="#our-story" onClick={() => setMobileNavOpen(false)}>Our story</a>
          </nav>
          <div className="header-actions">
            <a className="header-link" href="#shop">Find your next favourite <ArrowUpRight size={14} /></a>
            {user ? (
              <button className="account-button" onClick={() => { setDashboardOpen(true); setDashboard(null); }}>
                <span className="account-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                <span className="account-button-name">{user.name.split(' ')[0]}</span>
              </button>
            ) : (
              <button className="sign-in-button" onClick={() => { setPendingCheckout(false); setAccountMode('login'); setAccountOpen(true); setAccountError(''); }}>Sign in</button>
            )}
            <button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Open shopping bag, ${cartCount} items`}>
              <ShoppingBag size={18} strokeWidth={1.7} />
              <span>Bag</span>
              <span className="bag-count">{cartCount}</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> THE HANDMADE EDIT · INDIA</div>
            <h1>Made slowly.<br /><span>Kept forever.</span></h1>
            <p>Thoughtful things for everyday living, made by remarkable hands and the stories they carry.</p>
            <div className="hero-buttons">
              <a className="button button-primary" href="#shop">Find something lovely <ArrowRight size={16} /></a>
              <a className="text-link" href="#our-story">Why handmade? <ArrowDown size={14} /></a>
            </div>
            <div className="hero-note">
              <div className="avatar-stack" aria-hidden="true">
                <span className="maker-avatar avatar-one">M</span><span className="maker-avatar avatar-two">R</span><span className="maker-avatar avatar-three">S</span>
              </div>
              <span>Made by <strong>240+ independent artisans</strong></span>
            </div>
          </div>
          <div className="hero-art" aria-label="A collection of handmade pottery and textiles">
            <div className="hero-image-main">
              <img
                src="https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=1400&q=90"
                alt="A sunlit, thoughtfully arranged collection of handmade homeware"
                fetchPriority="high"
              />
            </div>
            <div className="hero-image-small">
              <img
                src="https://images.unsplash.com/photo-1597696929644-a2157a251a43?auto=format&fit=crop&w=600&q=85"
                alt="Hand-thrown studio pottery shaped on a potter wheel"
              />
            </div>
            <div className="hero-stamp"><span>made<br />by hand</span><Sparkles size={15} /></div>
            <div className="hero-caption"><span>01 / 04</span><span>Objects with a point of view</span><ArrowRight size={14} /></div>
          </div>
        </section>

        <section className="trust-strip" aria-label="Our promises">
          <span><Feather size={17} /> Made by hand, never mass-produced</span>
          <i />
          <span><Leaf size={17} /> Kind to people & planet</span>
          <i />
          <span><ShieldCheck size={17} /> Every purchase supports a maker</span>
        </section>

        <section className="shop-section content-width" id="shop">
          <div className="section-heading shop-heading">
            <div>
              <div className="eyebrow">A GOOD PLACE TO START</div>
              <h2>Objects to live with.</h2>
              <p>Made with care, chosen to be used and loved every day.</p>
            </div>
            <a className="view-all-link" href="#makers">Get to know our makers <ArrowRight size={15} /></a>
          </div>

          <div className="shop-controls">
            <div className="category-list" aria-label="Product categories">
              {categories.map((category) => (
                <button
                  className={`category-chip ${activeCategory === category.slug ? 'active' : ''}`}
                  key={category.slug}
                  onClick={() => setActiveCategory(category.slug)}
                  aria-pressed={activeCategory === category.slug}
                >
                  <span aria-hidden="true">{category.symbol}</span>{category.name}
                </button>
              ))}
            </div>
            <div className="shop-tools">
              <label className="search-box">
                <Search size={16} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find something..." aria-label="Search products" />
                {search && <button className="clear-search" aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}
              </label>
              <label className="sort-select">
                <span className="sr-only">Sort products</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                  <option value="featured">Sort: featured</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
          </div>

          {error && !checkoutOpen && !receipt && (
            <div className="inline-error" role="alert">
              <span>{error}</span><button className="text-link" onClick={() => setRetryCount((count) => count + 1)}>Try again</button>
            </div>
          )}

          {loading ? (
            <div className="product-grid" aria-label="Loading products">
              {Array.from({ length: 4 }, (_, index) => <div className="product-skeleton" key={index} />)}
            </div>
          ) : error ? null : visibleProducts.length > 0 ? (
            <>
              <div className="product-grid">
                {visibleProducts.map((product, index) => (
                  <article className="product-card" key={product.id}>
                    <div className={`product-image image-tone-${index % 4}`}>
                      <img src={product.image} alt={product.imageAlt} loading="lazy" />
                      {product.label && <span className="product-label">{product.label}</span>}
                      <button
                        className={`favorite-button ${favorites.includes(product.id) ? 'is-favorite' : ''}`}
                        onClick={() => toggleFavorite(product.id)}
                        aria-label={favorites.includes(product.id) ? `Remove ${product.name} from saved items` : `Save ${product.name}`}
                        aria-pressed={favorites.includes(product.id)}
                      >
                        <Heart size={17} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} />
                      </button>
                      <button className="quick-add" onClick={() => addToBag(product)} disabled={user?.role === 'artisan'}><Plus size={15} /> {user?.role === 'artisan' ? 'Shop as a buyer' : 'Add to bag'}</button>
                    </div>
                    <div className="product-info">
                      <div className="product-title-row"><h3>{product.name}</h3><span>{formatPrice(product.price)}</span></div>
                      <p>{product.artisan} <span>·</span> {product.location}</p>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-results"><Search size={24} /><h3>Nothing here just yet.</h3><p>Try another search or browse all of our handmade finds.</p><button className="button button-outline" onClick={() => { setActiveCategory('all'); setSearch(''); }}>See everything</button></div>
          )}
          {recommendations.length > 0 && (
            <section className="recommendations-section" aria-labelledby="recommendations-title">
              <div className="recommendations-heading">
                <div>
                  <div className="eyebrow">{recommendationBasis === 'community' ? 'A LITTLE COLLECTIVE WISDOM' : 'CHOSEN TO GO TOGETHER'}</div>
                  <h2 id="recommendations-title">{recommendationBasis === 'community' ? 'People also checked out.' : 'A few things you might like.'}</h2>
                </div>
                <span>{recommendationBasis === 'community' ? 'Based on what customers bought together' : 'A good place to keep looking'}</span>
              </div>
              <div className="recommendation-grid">
                {recommendations.map((product) => (
                  <article className="recommendation-card" key={product.id}>
                    <img src={product.image} alt={product.imageAlt} loading="lazy" />
                    <div><h3>{product.name}</h3><p>{product.artisan}</p><div className="recommendation-card-bottom"><strong>{formatPrice(product.price)}</strong><button onClick={() => addToBag(product)} aria-label={`Add ${product.name} to bag`} disabled={user?.role === 'artisan'}><Plus size={15} /></button></div></div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </section>

        <section className="makers-section" id="makers">
          <div className="makers-inner content-width">
            <div className="maker-portrait">
              <img src="https://images.unsplash.com/photo-1607453998774-d533f65dac99?auto=format&fit=crop&w=1000&q=85" alt="A craftsperson carefully working in their studio" loading="lazy" />
              <div className="portrait-note"><span className="note-star">✳</span><span>Every piece has<br />a person behind it.</span></div>
            </div>
            <div className="makers-copy">
              <div className="eyebrow">THE PEOPLE BEHIND THE PIECES</div>
              <h2>Good things happen<br />when we make<br /><em>room for makers.</em></h2>
              <p>Behind every object is someone who knows their craft by heart. We bring their work closer to your home — and make sure your purchase goes straight back to the people who made it.</p>
              <a className="button button-primary" href="#our-story">Meet the maker community <ArrowRight size={16} /></a>
              <div className="maker-stats">
                <div><strong>240<span>+</span></strong><small>independent makers</small></div>
                <div><strong>18</strong><small>craft traditions</small></div>
                <div><strong>12</strong><small>states, one big family</small></div>
              </div>
            </div>
          </div>
        </section>

        <section className="values-section content-width" id="our-story">
          <div className="values-intro">
            <div className="eyebrow">A LITTLE MORE MEANING</div>
            <h2>Buy less.<br /><em>Choose with heart.</em></h2>
            <p>We believe the best things aren’t made in a hurry. They’re made with intention, from materials that belong where they come from.</p>
            <a className="text-link dark-link" href="#shop">Our way of doing things <ArrowUpRight size={15} /></a>
          </div>
          <div className="value-list">
            <div className="value-item"><span className="value-number">01</span><span className="value-icon"><Heart size={19} /></span><div><h3>A fairer kind of trade</h3><p>Makers set the price. We keep things transparent, so more of each sale lands where it should.</p></div><ChevronRight size={17} /></div>
            <div className="value-item"><span className="value-number">02</span><span className="value-icon"><Leaf size={19} /></span><div><h3>Thoughtful by nature</h3><p>Local materials, smaller batches and fewer miles. Made to be kept, repaired and passed on.</p></div><ChevronRight size={17} /></div>
            <div className="value-item"><span className="value-number">03</span><span className="value-icon"><Sparkles size={19} /></span><div><h3>Never quite the same</h3><p>Little variations aren’t imperfections. They’re proof that a real person made this, by hand.</p></div><ChevronRight size={17} /></div>
          </div>
        </section>

        <section className="newsletter">
          <div className="newsletter-mark"><span>k.</span></div>
          <div className="newsletter-copy"><div className="eyebrow">A NOTE FROM THE MAKERS</div><h2>Good stories, no noise.</h2><p>Occasional notes from the workshop, new finds and the people who make them.</p></div>
          <form className="newsletter-form" onSubmit={subscribe}>
            <label className="sr-only" htmlFor="newsletter-email">Your email address</label>
            <input id="newsletter-email" name="email" type="email" placeholder="Your email address" required maxLength={254} />
            <button className="button button-primary" type="submit" disabled={newsletterSubmitting}>{newsletterSubmitting ? 'Joining…' : 'Count me in'} {!newsletterSubmitting && <ArrowRight size={15} />}</button>
            <small>By subscribing, you agree to our <a href="#footer">privacy policy.</a></small>
            {newsletterMessage && <small className="newsletter-message" role="status">{newsletterMessage}</small>}
          </form>
        </section>
      </main>

      <footer className="site-footer" id="footer">
        <div className="footer-main content-width">
          <div className="footer-brand"><a className="wordmark" href="#"><span className="wordmark-symbol">k<span>.</span></span><span>karigar</span></a><p>A little marketplace for<br />a lot of wonderful makers.</p><span className="footer-location">Made with care, in India <span>✳</span></span></div>
          <div className="footer-column"><h4>Wander around</h4><a href="#shop">Shop everything</a><a href="#shop">By craft</a><a href="#makers">Meet the makers</a><a href="#our-story">Our story</a></div>
          <div className="footer-column"><h4>Here to help</h4><a href="#footer">Shipping & returns</a><a href="#footer">Care for your pieces</a><a href="#footer">Get in touch</a><a href="#footer">Frequently asked</a></div>
          <div className="footer-column footer-signoff"><span className="signoff-flower">✳</span><p>Good things take time.<br />So do we.</p><span>© 2025 Karigar Market</span></div>
        </div>
        <div className="footer-bottom content-width"><span>Handmade with love, never in a hurry.</span><div><a href="#footer">Instagram</a><a href="#footer">Journal</a><a href="#footer">Privacy</a></div></div>
      </footer>

      {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}

      {accountOpen && (
        <div className="overlay overlay-centered" onMouseDown={(event) => { if (event.target === event.currentTarget) { setAccountOpen(false); setPendingCheckout(false); } }}>
          <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
            <div className="drawer-header">
              <div><span className="eyebrow">{accountMode === 'signup' ? 'A PLACE AT THE TABLE' : 'WELCOME BACK'}</span><h2 id="account-title">{accountMode === 'signup' ? 'Make yourself at home.' : 'Good to see you.'}</h2></div>
              <button className="icon-button" onClick={() => { setAccountOpen(false); setPendingCheckout(false); }} aria-label="Close sign in"><X size={20} /></button>
            </div>
            <p className="account-intro">{pendingCheckout ? 'Sign in or create a buyer account. Your bag will be here when you’re ready.' : accountMode === 'signup' ? 'One account, made for the way you take part.' : 'Sign in to pick up where you left off.'}</p>
            {accountMode === 'signup' && !pendingCheckout && (
              <div className="role-picker" aria-label="Choose account type">
                <button className={accountRole === 'buyer' ? 'selected' : ''} onClick={() => setAccountRole('buyer')} type="button"><ShoppingBag size={17} /><span><strong>I’m here to shop</strong><small>Save favourites and keep track of orders</small></span></button>
                <button className={accountRole === 'artisan' ? 'selected' : ''} onClick={() => setAccountRole('artisan')} type="button"><Feather size={17} /><span><strong>I’m a maker</strong><small>Showcase your craft and manage your shop</small></span></button>
              </div>
            )}
            {accountError && <div className="form-error" role="alert">{accountError}</div>}
            <form className="checkout-form account-form" onSubmit={submitAccount}>
              {accountMode === 'signup' && (
                <>
                  <label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={100} /></label>
                  {accountRole === 'artisan' && (
                    <div className="form-row">
                      <label>Shop or studio name<input name="storeName" required minLength={2} maxLength={100} /></label>
                      <label>Your location<input name="location" placeholder="e.g. Bhuj, Gujarat" required minLength={2} maxLength={120} /></label>
                    </div>
                  )}
                </>
              )}
              <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
              <label>Password<input name="password" type="password" autoComplete={accountMode === 'signup' ? 'new-password' : 'current-password'} required minLength={accountMode === 'signup' ? 8 : 1} maxLength={128} />{accountMode === 'signup' && <small className="field-hint">At least 8 characters.</small>}</label>
              <button className="button button-primary checkout-button" type="submit" disabled={accountSubmitting}>{accountSubmitting ? 'One moment…' : accountMode === 'signup' ? 'Create my account' : 'Sign in'} {!accountSubmitting && <ArrowRight size={16} />}</button>
            </form>
            <p className="account-switch">{accountMode === 'signup' ? 'Already have an account?' : 'New around here?'} <button onClick={() => { setAccountMode(accountMode === 'signup' ? 'login' : 'signup'); setAccountError(''); }}>{accountMode === 'signup' ? 'Sign in' : 'Create an account'}</button></p>
          </section>
        </div>
      )}

      {dashboardOpen && user && (
        <div className="overlay overlay-centered dashboard-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setDashboardOpen(false); }}>
          <section className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-title">
            <div className="dashboard-header">
              <div className="dashboard-greeting"><span className="account-avatar dashboard-avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><span className="eyebrow">{user.role === 'artisan' ? 'YOUR MAKER STUDIO' : 'YOUR KARIGAR ACCOUNT'}</span><h2 id="dashboard-title">{user.role === 'artisan' ? user.storeName : `Hello, ${user.name.split(' ')[0]}.`}</h2></div></div>
              <div className="dashboard-header-actions"><button className="text-link" onClick={() => { setDashboardOpen(false); void signOut(); }}>Sign out</button><button className="icon-button" onClick={() => setDashboardOpen(false)} aria-label="Close dashboard"><X size={20} /></button></div>
            </div>
            {dashboardError && <div className="form-error dashboard-error" role="alert"><span>{dashboardError}</span><button className="text-link" onClick={() => setDashboardRetry((count) => count + 1)}>Try again</button></div>}
            {!dashboard && !dashboardError && <div className="dashboard-loading" role="status">Getting your little corner ready…</div>}
            {dashboard?.role === 'buyer' && (
              <div className="buyer-dashboard">
                <div className="dashboard-section-heading"><div><div className="eyebrow">THE PAPER TRAIL</div><h3>Your orders</h3></div><span>{dashboard.orders?.length ?? 0} so far</span></div>
                {dashboard.orders?.length ? (
                  <div className="dashboard-orders">
                    {dashboard.orders.map((order) => (
                      <article className="buyer-order" key={order.reference}>
                        <div><span className="order-reference">{order.reference}</span><p>{order.items?.map((item) => `${item.quantity} × ${item.name}`).join(' · ')}</p></div>
                        <div className="buyer-order-meta"><span className="order-status">{order.status}</span><strong>{formatPrice(order.total ?? 0)}</strong><small>{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</small></div>
                      </article>
                    ))}
                  </div>
                ) : <div className="dashboard-empty"><ShoppingBag size={20} /><p>Your first handmade find is waiting.</p><button className="text-link" onClick={() => { setDashboardOpen(false); document.querySelector('#shop')?.scrollIntoView({ behavior: 'smooth' }); }}>Browse the collection <ArrowRight size={14} /></button></div>}
                {!!dashboard.favorites?.length && (
                  <>
                    <div className="dashboard-section-heading dashboard-picks-heading"><div><div className="eyebrow">SAVED FOR LATER</div><h3>Your favourites</h3></div></div>
                    <div className="dashboard-picks">
                      {dashboard.favorites.map((product) => <article key={product.id}><img src={product.image} alt={product.imageAlt} /><div><h4>{product.name}</h4><small>{product.artisan} · {formatPrice(product.price)}</small><button onClick={() => { addToBag(product); setDashboardOpen(false); }}>Add to bag <ArrowRight size={13} /></button></div></article>)}
                    </div>
                  </>
                )}
                <div className="dashboard-section-heading dashboard-picks-heading"><div><div className="eyebrow">A GOOD NEXT STEP</div><h3>Picked for you</h3></div></div>
                <div className="dashboard-picks">
                  {dashboard.recommendations?.map((product) => <article key={product.id}><img src={product.image} alt={product.imageAlt} /><div><h4>{product.name}</h4><small>{product.artisan} · {formatPrice(product.price)}</small><button onClick={() => { addToBag(product); setDashboardOpen(false); }}>Add to bag <ArrowRight size={13} /></button></div></article>)}
                </div>
              </div>
            )}
            {dashboard?.role === 'artisan' && (
              <div className="artisan-dashboard">
                <div className="artisan-stats">
                  <article><span>YOUR LISTINGS</span><strong>{dashboard.products?.length ?? 0}</strong></article>
                  <article><span>ORDERED PIECES</span><strong>{dashboard.orders?.reduce((sum, order) => sum + (order.quantity ?? 0), 0) ?? 0}</strong></article>
                  <article><span>YOUR WORKSHOP</span><strong className="workshop-location">{user.location}</strong></article>
                </div>
                <div className="artisan-columns">
                  <section className="artisan-listings"><div className="dashboard-section-heading"><div><div className="eyebrow">ON THE SHELF</div><h3>Your pieces</h3></div></div>
                    {dashboard.products?.length ? <div className="inventory-list">{dashboard.products.map((product) => <article key={product.id}><img src={product.image} alt="" /><div><strong>{product.name}</strong><small>{product.category}</small></div><b>{formatPrice(product.price)}</b></article>)}</div> : <div className="dashboard-empty inventory-empty"><p>Your shop is ready for its first piece.</p></div>}
                  </section>
                  <section className="artisan-orders"><div className="dashboard-section-heading"><div><div className="eyebrow">FROM YOUR WORKSHOP</div><h3>Recent orders</h3></div></div>
                    {dashboard.orders?.length ? <div className="artisan-order-list">{dashboard.orders.map((order, index) => <article key={`${order.reference}-${index}`}><div><strong>{order.productName}</strong><small>{order.reference} · {order.customerName} · {order.city}</small></div><span>× {order.quantity}</span></article>)}</div> : <div className="dashboard-empty inventory-empty"><p>Orders for your work will appear here.</p></div>}
                  </section>
                </div>
                <section className="new-listing-section"><div className="dashboard-section-heading"><div><div className="eyebrow">ADD SOMETHING NEW</div><h3>List a handmade piece</h3></div></div>
                  <form className="listing-form" onSubmit={submitListing}>
                    <label>Piece name<input name="listingName" required minLength={3} maxLength={120} /></label>
                    <div className="form-row"><label>Price in rupees<input name="listingPrice" type="number" min="1" max="10000000" required /></label><label>Craft<select name="listingCategory" required defaultValue="Pottery"><option>Pottery</option><option>Textiles</option><option>Metalwork</option><option>Home & living</option><option>Woodwork</option></select></label></div>
                    <label>Photo URL<input name="listingImage" type="url" placeholder="https://…" required /></label>
                    <label>Tell shoppers about it<textarea name="listingDescription" rows={3} minLength={10} maxLength={1000} required /></label>
                    {listingMessage && <p className="listing-message" role="status">{listingMessage}</p>}
                    <button className="button button-primary" type="submit" disabled={listingSubmitting}>{listingSubmitting ? 'Publishing…' : 'Publish piece'} {!listingSubmitting && <ArrowRight size={15} />}</button>
                  </form>
                </section>
              </div>
            )}
          </section>
        </div>
      )}

      {cartOpen && (
        <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping bag">
            <div className="drawer-header"><div><span className="eyebrow">YOUR LITTLE FINDS</span><h2>Your bag <span>({cartCount})</span></h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close bag"><X size={20} /></button></div>
            {cart.length ? (
              <>
                <div className="cart-lines">
                  {cart.map(({ product, quantity }) => (
                    <div className="cart-line" key={product.id}>
                      <img src={product.image} alt="" />
                      <div className="cart-line-info"><h3>{product.name}</h3><p>by {product.artisan}</p><div className="quantity-control"><button aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product.id, -1)}><Minus size={13} /></button><span>{quantity}</span><button aria-label={`Add one ${product.name}`} onClick={() => changeQuantity(product.id, 1)} disabled={quantity >= 10}><Plus size={13} /></button></div></div>
                      <strong>{formatPrice(product.price * quantity)}</strong>
                    </div>
                  ))}
                </div>
                <div className="cart-summary"><div><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div><div><span>Delivery</span><span>{shipping ? formatPrice(shipping) : 'On us'}</span></div><p>{subtotal >= 3000 ? 'Lovely — your delivery is on us.' : `You’re ${formatPrice(Math.max(0, 3000 - subtotal))} away from free delivery.`}</p><div className="summary-total"><strong>Total</strong><strong>{formatPrice(subtotal + shipping)}</strong></div><button className="button button-primary checkout-button" onClick={beginCheckout} disabled={user?.role === 'artisan'}>{user?.role === 'artisan' ? 'Buyer account needed to check out' : user ? 'Continue to checkout' : 'Sign in to checkout'} {!user && <ArrowRight size={16} />}</button><small>Buyer account required · Order request only; no payment is collected</small></div>
              </>
            ) : (
              <div className="cart-empty"><ShoppingBag size={28} /><h3>A little room for lovely things.</h3><p>Your bag is waiting for something made with care.</p><button className="button button-primary" onClick={() => setCartOpen(false)}>Go find something <ArrowRight size={15} /></button></div>
            )}
          </aside>
        </div>
      )}

      {checkoutOpen && (
        <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutOpen(false); }}>
          <section className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
            <div className="drawer-header"><div><span className="eyebrow">ALMOST YOURS</span><h2 id="checkout-title">Delivery details</h2></div><button className="icon-button" onClick={() => setCheckoutOpen(false)} aria-label="Close checkout"><X size={20} /></button></div>
            <p className="checkout-intro">We’ll send your order confirmation and delivery updates by email.</p>
            {error && <div className="form-error" role="alert">{error}</div>}
            <form className="checkout-form" onSubmit={submitOrder}>
              <label>Full name<input name="customerName" autoComplete="name" defaultValue={user?.role === 'buyer' ? user.name : ''} required minLength={2} maxLength={100} /></label>
              <label>Email address<input name="email" type="email" autoComplete="email" defaultValue={user?.role === 'buyer' ? user.email : ''} required maxLength={254} /></label>
              <label>Street address<input name="address" autoComplete="street-address" required minLength={5} maxLength={200} /></label>
              <div className="form-row"><label>City<input name="city" autoComplete="address-level2" required minLength={2} maxLength={100} /></label><label>PIN / postal code<input name="postalCode" autoComplete="postal-code" required minLength={3} maxLength={16} /></label></div>
              <div className="checkout-total"><span>{cartCount} {cartCount === 1 ? 'piece' : 'pieces'} · including delivery</span><strong>{formatPrice(subtotal + shipping)}</strong></div>
              <button className="button button-primary checkout-button" type="submit" disabled={submitting}>{submitting ? 'Placing your order…' : 'Place order request'} {!submitting && <ArrowRight size={16} />}</button>
              <small className="checkout-disclaimer">Mock checkout: this saves an order request only. No payment is collected.</small>
            </form>
          </section>
        </div>
      )}

      {receipt && (
        <div className="overlay">
          <section className="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
            <div className="receipt-check"><Check size={25} /></div>
            <div className="eyebrow">A VERY GOOD CHOICE</div>
            <h2 id="receipt-title">Your order is with us.</h2>
            <p>Thanks for choosing something handmade. We’ve saved your order and will be in touch with the next steps.</p>
            <div className="receipt-reference"><span>ORDER REFERENCE</span><strong>{receipt.reference}</strong><small>Total · {formatPrice(receipt.total)}</small></div>
            <button className="button button-primary" onClick={() => setReceipt(null)}>Back to the good things <ArrowRight size={16} /></button>
          </section>
        </div>
      )}
    </>
  );
}

export default App;
