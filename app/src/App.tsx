import { type FormEvent, type ReactNode, startTransition, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  Clock3,
  LogOut,
  Menu,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  User,
} from 'lucide-react';
import { CartProvider, useCart, type CartItem } from './context/CartContext';
import {
  categories,
  getFeaturedProducts,
  getProductById,
  getProductsByCategory,
  products,
  type Product,
} from './data/products';
import { searchProductsOnline, searchResultToProduct } from './lib/searchEngine';
import './App.css';

type View = 'home' | 'catalog' | 'product' | 'assistant' | 'stock' | 'cart' | 'auth' | 'checkout' | 'success';
type AuthMode = 'signin' | 'signup';
type DeliveryPreference = 'all' | 'fast';
type PriceFilter = 'all' | 'under-100' | 'under-125';
type AvailabilityFilter = 'all' | 'available';
type ShippingMethod = 'standard' | 'expedited';

interface StoredUser {
  name: string;
  email: string;
  password: string;
  styleFocus: string;
}

interface ActiveUser {
  name: string;
  email: string;
  styleFocus: string;
}

interface FilterState {
  maxPrice: PriceFilter;
  delivery: DeliveryPreference;
  availability: AvailabilityFilter;
}

interface ConciergeResult {
  title: string;
  summary: string;
  reasons: string[];
  items: Product[];
  total: number;
}

interface SubmittedOrder {
  id: string;
  customerName: string;
  shippingMethod: ShippingMethod;
  etaLabel: string;
  items: CartItem[];
  subtotal: number;
}

interface StockInventoryItem {
  id: string;
  name: string;
  brand: string;
  merchant: string;
  price: number;
  availability: 'In stock' | 'Limited stock' | 'Out of stock';
  deliveryBusinessDays: number;
  sourceUrl: string;
  source: string;
}

const DEFAULT_FILTERS: FilterState = {
  maxPrice: 'all',
  delivery: 'all',
  availability: 'available',
};

const DEFAULT_PROMPT = 'I need a breathable linen vacation look under $220 that can arrive fast.';

function App() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}

function AppContent() {
  const [view, setView] = useState<View>('home');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(products[0]?.id ?? null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [assistantInput, setAssistantInput] = useState(DEFAULT_PROMPT);
  const [_assistantPrompt, setAssistantPrompt] = useState(DEFAULT_PROMPT);
  const [users, setUsers] = usePersistentState<StoredUser[]>('olnavae.users', []);
  const [currentUser, setCurrentUser] = usePersistentState<ActiveUser | null>('olnavae.current-user', null);
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrder | null>(null);
  const deferredSearchInput = useDeferredValue(searchInput);
  const { addToCart, clearCart, items, totalItems, totalPrice } = useCart();

  const [assistantResult, setAssistantResult] = useState<ConciergeResult>(() => buildLocalConciergeResult(DEFAULT_PROMPT));
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [styleAnalysis, setStyleAnalysis] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);

  const featuredProducts = getFeaturedProducts();
  const catalogProducts = filterProducts(getProductsByCategory(selectedCategory), deferredSearchInput, filters);
  const selectedProduct = selectedProductId ? getProductById(selectedProductId) ?? null : null;

  const navigateTo = (nextView: View, productId?: string) => {
    startTransition(() => {
      setView(nextView);
      if (productId) {
        setSelectedProductId(productId);
      }
      setIsMenuOpen(false);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const runSearch = (query: string) => {
    setSearchInput(query);
    setSelectedCategory('all');
    navigateTo('catalog');
  };

  const runAssistant = useCallback((prompt: string) => {
    const nextPrompt = prompt.trim() || DEFAULT_PROMPT;
    setAssistantInput(nextPrompt);
    setAssistantPrompt(nextPrompt);
    navigateTo('assistant');

    // Cancel any in-flight search
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAssistantLoading(true);
    setAssistantResult(buildLocalConciergeResult(nextPrompt, currentUser, !!uploadedImage));

    const budget = extractBudget(nextPrompt.toLowerCase());

    searchProductsOnline(nextPrompt, budget)
      .then((webResults) => {
        if (controller.signal.aborted) return;
        if (webResults.length === 0) {
          setAssistantResult(buildLocalConciergeResult(nextPrompt, currentUser, !!uploadedImage));
          return;
        }
        const mapped = webResults.map(searchResultToProduct);
        setAssistantResult(buildConciergeResultFromProducts(nextPrompt, mapped, currentUser, !!uploadedImage));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAssistantResult(buildLocalConciergeResult(nextPrompt, currentUser, !!uploadedImage));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAssistantLoading(false);
      });
  }, [currentUser, uploadedImage]);

  const openProduct = (productId: string) => {
    navigateTo('product', productId);
  };

  const handleAddProductToCart = (product: Product, size: string, color: string, quantity = 1) => {
    addToCart(
      {
        id: product.id,
        name: product.name,
        brand: product.brand,
        merchant: product.merchant,
        description: product.description,
        price: product.price,
        image: product.image,
        size,
        color,
        sourceUrl: product.sourceUrl,
        availability: product.availability,
        deliveryBusinessDays: product.deliveryBusinessDays,
      },
      quantity,
    );
  };

  const handleAssistAndQueue = (result: ConciergeResult) => {
    result.items.forEach((product) => {
      handleAddProductToCart(product, product.sizes[0], product.colors[0].name, 1);
    });
    navigateTo('cart');
  };

  const handleCheckoutGuard = () => {
    if (!currentUser) {
      setAuthMode('signin');
      navigateTo('auth');
      return;
    }

    navigateTo('checkout');
  };

  const handleAuthSuccess = (user: ActiveUser) => {
    setCurrentUser(user);
    navigateTo('catalog');
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    navigateTo('auth');
  };

  const handleSubmitOrder = (customerName: string, shippingMethod: ShippingMethod) => {
    const slowestEta = items.reduce((maxDays, item) => {
      const nextDays = shippingMethod === 'expedited' ? Math.min(item.deliveryBusinessDays, 3) : item.deliveryBusinessDays;
      return Math.max(maxDays, nextDays);
    }, shippingMethod === 'expedited' ? 3 : 6);

    setSubmittedOrder({
      id: `OLN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      customerName,
      shippingMethod,
      etaLabel: formatDeliveryLabel(slowestEta),
      items,
      subtotal: totalPrice,
    });
    clearCart();
    navigateTo('success');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen overflow-x-hidden font-body" style={{background:'linear-gradient(160deg,#f7f3ec 0%,#ede7da 100%)',color:'#0f2237'}}>
        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-6 rounded-[1.5rem] border border-terracotta/20 bg-terracotta/5 px-5 py-4 text-sm text-navy/80">
            Please sign in or create an account to access catalog, concierge, and checkout features.
          </div>
          <AuthView
            authMode={authMode}
            onAuthModeChange={setAuthMode}
            onAuthSuccess={handleAuthSuccess}
            users={users}
            setUsers={setUsers}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden font-body" style={{background:'linear-gradient(160deg,#f7f3ec 0%,#ede7da 100%)',color:'#0f2237'}}>
      <Navigation
        categories={categories}
        currentUser={currentUser}
        isMenuOpen={isMenuOpen}
        onCategorySelect={(categoryId) => {
          setSelectedCategory(categoryId);
          navigateTo('catalog');
        }}
        onLogoClick={() => navigateTo('home')}
        onMenuToggle={() => setIsMenuOpen((current) => !current)}
        onSearch={runSearch}
        onSearchChange={setSearchInput}
        onAssistant={() => runAssistant(assistantInput)}
        onStock={() => navigateTo('stock')}
        onAuth={() => navigateTo('auth')}
        onSignOut={handleSignOut}
        onCart={() => navigateTo('cart')}
        searchValue={searchInput}
        totalItems={totalItems}
      />

      <main>
        {view === 'home' && (
          <HomeView
            featuredProducts={featuredProducts}
            onBrowse={() => navigateTo('catalog')}
            onOpenProduct={openProduct}
            onRunSearch={runSearch}
            onRunAssistant={runAssistant}
          />
        )}
        {view === 'catalog' && (
          <CatalogView
            filters={filters}
            products={catalogProducts}
            searchValue={searchInput}
            selectedCategory={selectedCategory}
            onFilterChange={setFilters}
            onOpenProduct={openProduct}
            onQuickAdd={handleAddProductToCart}
            onRunAssistant={runAssistant}
            onCategorySelect={setSelectedCategory}
          />
        )}
        {view === 'product' && selectedProduct && (
          <ProductView
            product={selectedProduct}
            onAddToCart={handleAddProductToCart}
            onAskAi={runAssistant}
          />
        )}
        {view === 'assistant' && (
          <AssistantView
            input={assistantInput}
            loading={assistantLoading}
            result={assistantResult}
            onInputChange={setAssistantInput}
            onRunAssistant={runAssistant}
            onAddPlanToCart={handleAssistAndQueue}
            onOpenProduct={openProduct}
            uploadedImage={uploadedImage}
            onImageUpload={(image) => {
              setUploadedImage(image);
              setStyleAnalysis(analyzeStyleFromImage(image));
            }}
            styleAnalysis={styleAnalysis}
          />
        )}
        {view === 'stock' && (
          <StockPulseView
            onRunAssistant={runAssistant}
            onBack={() => navigateTo('catalog')}
          />
        )}
        {view === 'cart' && (
          <CartView
            currentUser={currentUser}
            onContinueShopping={() => navigateTo('catalog')}
            onGoToCheckout={handleCheckoutGuard}
            onRunAssistant={() => runAssistant(buildCartPrompt(items))}
          />
        )}
        {view === 'auth' && (
          <AuthView
            authMode={authMode}
            onAuthModeChange={setAuthMode}
            onAuthSuccess={handleAuthSuccess}
            users={users}
            setUsers={setUsers}
          />
        )}
        {view === 'checkout' && (
          <CheckoutView
            currentUser={currentUser}
            onBackToCart={() => navigateTo('cart')}
            onSubmitOrder={handleSubmitOrder}
          />
        )}
        {view === 'success' && submittedOrder && (
          <SuccessView
            order={submittedOrder}
            onContinueShopping={() => navigateTo('catalog')}
          />
        )}
      </main>

      <footer className="mt-16 depth-shadow" style={{background:'rgba(255,255,255,0.7)',backdropFilter:'blur(20px)',borderTop:'1px solid rgba(15,34,55,0.08)'}}>
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-display text-2xl">OL&apos;NAVAE Concierge</p>
            <p className="mt-2 max-w-2xl text-sm text-navy/70">
              Real-product shopping prototype with official-source links, current delivery guidance, local sign-in, and an AI order-planning flow.
            </p>
          </div>
          <div className="rounded-3xl border border-terracotta/20 bg-terracotta/5 px-4 py-3 text-sm text-navy/70">
            This build creates a concierge order request from live catalog snapshots. Fully automated third-party checkout still needs merchant APIs.
          </div>
        </div>
      </footer>
    </div>
  );
}

function Navigation({
  categories: navCategories,
  currentUser,
  isMenuOpen,
  onAssistant,
  onStock,
  onAuth,
  onCart,
  onCategorySelect,
  onLogoClick,
  onMenuToggle,
  onSearch,
  onSearchChange,
  onSignOut,
  searchValue,
  totalItems,
}: {
  categories: typeof categories;
  currentUser: ActiveUser | null;
  isMenuOpen: boolean;
  onAssistant: () => void;
  onStock: () => void;
  onAuth: () => void;
  onCart: () => void;
  onCategorySelect: (categoryId: string) => void;
  onLogoClick: () => void;
  onMenuToggle: () => void;
  onSearch: (query: string) => void;
  onSearchChange: (value: string) => void;
  onSignOut: () => void;
  searchValue: string;
  totalItems: number;
}) {
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(searchValue);
  };

  return (
    <nav className="sticky top-0 z-50" style={{background:'rgba(247,243,236,0.88)',backdropFilter:'blur(24px) saturate(180%)',WebkitBackdropFilter:'blur(24px) saturate(180%)',borderBottom:'1px solid rgba(15,34,55,0.08)',boxShadow:'0 4px 12px rgba(15,34,55,0.06),0 8px 20px rgba(15,34,55,0.08)'}}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[84px] flex-wrap items-center gap-4 py-4">
          <button onClick={onLogoClick} className="font-display text-2xl tracking-[0.18em] text-navy sm:text-3xl">
            OL&apos;NAVAE
          </button>

          <div className="hidden flex-1 items-center gap-3 lg:flex">
            <form
              onSubmit={submitSearch}
              style={{background:'rgba(255,255,255,0.92)',border:'1px solid rgba(15,34,55,0.12)',boxShadow:'inset 0 2px 4px rgba(0,0,0,0.04)',borderRadius:'9999px',display:'flex',flex:1,alignItems:'center',padding:'8px 16px'}}
            >
              <Search className="h-4 w-4 text-navy/50" />
              <input
                type="search"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search live linen, denim, vacation, office..."
                className="w-full border-none bg-transparent px-3 text-sm text-navy outline-none"
              />
              <button
                type="submit"
                className="rounded-full bg-navy px-4 py-2 text-sm text-cream transition-colors hover:bg-navy/90"
              >
                Search
              </button>
            </form>
            <button
              onClick={onAssistant}
              className="inline-flex items-center gap-2 rounded-full border border-terracotta/20 bg-terracotta/10 px-4 py-2 text-sm text-navy transition-colors hover:bg-terracotta/20"
            >
              <Bot className="h-4 w-4" />
              AI Concierge
            </button>
            <button
              onClick={onStock}
              className="inline-flex items-center gap-2 rounded-full border border-navy/15 bg-white/80 px-4 py-2 text-sm text-navy transition-colors hover:bg-white"
            >
              <Store className="h-4 w-4" />
              Live Stock
            </button>
          </div>

          <div className="ml-auto hidden items-center gap-3 md:flex">
            {currentUser ? (
              <>
                <button
                  onClick={onAuth}
                  className="inline-flex items-center gap-2 rounded-full border border-navy/10 px-4 py-2 text-sm text-navy transition-colors hover:border-navy/20 hover:bg-white/80"
                >
                  <User className="h-4 w-4" />
                  {currentUser.name}
                </button>
                <button onClick={onSignOut} className="text-sm text-navy/60 transition-colors hover:text-terracotta">
                  <span className="inline-flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </span>
                </button>
              </>
            ) : (
              <button
                onClick={onAuth}
                className="inline-flex items-center gap-2 rounded-full border border-navy/10 px-4 py-2 text-sm text-navy transition-colors hover:border-navy/20 hover:bg-white/80"
              >
                <User className="h-4 w-4" />
                Sign in
              </button>
            )}

            <button
              onClick={onCart}
              className="relative inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm text-cream transition-colors hover:bg-navy/90"
            >
              <ShoppingBag className="h-4 w-4" />
              Cart
              {totalItems > 0 && (
                <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-terracotta text-xs text-white">
                  {totalItems}
                </span>
              )}
            </button>
          </div>

          <button onClick={onMenuToggle} className="md:hidden">
            <Menu className="h-6 w-6 text-navy" />
          </button>
        </div>

        <div className="hidden items-center gap-5 border-t border-navy/10 py-3 md:flex">
          {navCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategorySelect(category.id)}
              className="text-sm tracking-[0.18em] text-navy/70 transition-colors hover:text-terracotta"
            >
              {category.name.toUpperCase()}
            </button>
          ))}
        </div>

        {isMenuOpen && (
          <div className="space-y-4 border-t border-navy/10 py-4 md:hidden">
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <input
                type="search"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search live products"
                className="w-full rounded-full border border-navy/10 bg-white px-4 py-3 text-sm text-navy"
              />
              <button type="submit" className="rounded-full bg-navy px-4 py-3 text-sm text-cream">
                Go
              </button>
            </form>
            <button
              onClick={onAssistant}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-terracotta/20 bg-terracotta/10 px-4 py-3 text-sm text-navy"
            >
              <Bot className="h-4 w-4" />
              AI Concierge
            </button>
            <button
              onClick={onStock}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-navy/15 bg-white px-4 py-3 text-sm text-navy"
            >
              <Store className="h-4 w-4" />
              Live Stock
            </button>
            <div className="space-y-2">
              {navCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => onCategorySelect(category.id)}
                  className="block w-full rounded-2xl bg-white px-4 py-3 text-left text-sm text-navy"
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function HomeView({
  featuredProducts,
  onBrowse,
  onOpenProduct,
  onRunAssistant,
  onRunSearch,
}: {
  featuredProducts: Product[];
  onBrowse: () => void;
  onOpenProduct: (productId: string) => void;
  onRunAssistant: (prompt: string) => void;
  onRunSearch: (query: string) => void;
}) {
  return (
    <div>
      <style>{`
        @keyframes heroOrb1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.15)}}
        @keyframes heroOrb2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-30px,40px) scale(1.1)}}
        @keyframes heroBadgeFade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes heroH1Fade{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes heroSubFade{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes heroBtnsFade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes heroPillsFade{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes heroCardFade{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
        @keyframes floatCard{0%,100%{transform:translateY(0px)}50%{transform:translateY(-10px)}}
        @keyframes pulseDot{0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,0.5)}70%{box-shadow:0 0 0 8px rgba(201,168,76,0)}}
        @keyframes glowPulse{0%{box-shadow:0 0 20px rgba(201,168,76,0.3)}50%{box-shadow:0 0 40px rgba(201,168,76,0.5)}100%{box-shadow:0 0 20px rgba(201,168,76,0.3)}}
        @keyframes slideInLeft{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:translateX(0)}}
        @keyframes slideInRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
        @keyframes scaleIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
        @keyframes depthShadow{0%{box-shadow:0 5px 15px rgba(15,34,55,0.08)}50%{box-shadow:0 20px 60px rgba(15,34,55,0.15)}100%{box-shadow:0 5px 15px rgba(15,34,55,0.08)}}
        .h-badge{animation:heroBadgeFade .6s ease both}
        .h-h1{animation:heroH1Fade .8s .1s ease both;letter-spacing:-0.02em}
        .h-sub{animation:heroSubFade .8s .25s ease both}
        .h-btns{animation:heroBtnsFade .7s .4s ease both}
        .h-pills{animation:heroPillsFade .7s .55s ease both}
        .h-card{animation:heroCardFade .9s .3s ease both;box-shadow:0 25px 50px rgba(15,34,55,0.15),0 8px 16px rgba(0,0,0,0.08),inset 0 1px 0 rgba(255,255,255,0.2)}
        .h-float{animation:floatCard 5s ease-in-out infinite}
        .dot-pulse{animation:pulseDot 2s infinite}
        .glow-pulse{animation:glowPulse 3s ease-in-out infinite}
        .depth-shadow{box-shadow:0 2px 4px rgba(15,34,55,0.04),0 8px 16px rgba(15,34,55,0.08),0 16px 32px rgba(15,34,55,0.12),inset 0 1px 0 rgba(255,255,255,0.6)}
        .depth-shadow-lg{box-shadow:0 4px 8px rgba(15,34,55,0.06),0 12px 24px rgba(15,34,55,0.12),0 24px 48px rgba(15,34,55,0.16),inset 0 1px 0 rgba(255,255,255,0.7)}
        .depth-shadow-xl{box-shadow:0 8px 16px rgba(15,34,55,0.08),0 20px 40px rgba(15,34,55,0.16),0 32px 64px rgba(15,34,55,0.20),inset 0 1px 0 rgba(255,255,255,0.8)}
        .slide-in-left{animation:slideInLeft .7s ease-out}
        .slide-in-right{animation:slideInRight .7s ease-out}
        .scale-in{animation:scaleIn .6s ease-out}
        .card-3d{transition:transform .4s cubic-bezier(.23,1,.32,1),box-shadow .4s ease;transform-style:preserve-3d;will-change:transform}
        .card-3d:hover{transform:translateY(-12px) rotateX(3deg) rotateY(-2deg);box-shadow:0 40px 100px rgba(15,34,55,0.25),0 12px 32px rgba(0,0,0,0.12),inset 0 1px 0 rgba(255,255,255,0.98)}
      `}</style>
      <section className="relative overflow-hidden" style={{background:'radial-gradient(ellipse 80% 60% at 20% 10%,rgba(201,168,76,0.18) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 85% 80%,rgba(194,107,74,0.15) 0%,transparent 55%),linear-gradient(160deg,#0f2237 0%,#1a3a55 50%,#06111e 100%)'}}>
        <div aria-hidden style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
          <div style={{position:'absolute',top:'-10%',left:'-5%',width:'500px',height:'500px',borderRadius:'50%',background:'radial-gradient(circle,rgba(201,168,76,0.12) 0%,transparent 70%)',animation:'heroOrb1 12s ease-in-out infinite'}} />
          <div style={{position:'absolute',bottom:'-15%',right:'-5%',width:'600px',height:'600px',borderRadius:'50%',background:'radial-gradient(circle,rgba(194,107,74,0.10) 0%,transparent 70%)',animation:'heroOrb2 15s ease-in-out infinite'}} />
          <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',backgroundSize:'60px 60px'}} />
        </div>
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-28">
          <div className="relative z-10">
            <p className="mb-4 h-badge text-sm tracking-[0.35em] text-cream/80">LIVE PRODUCT CONCIERGE</p>
            <h1 className="h-h1 max-w-3xl font-display text-4xl leading-tight text-cream sm:text-5xl md:text-7xl">
              Search real fashion, sign in, and build order-ready looks with AI.
            </h1>
            <p className="h-sub mt-6 max-w-2xl text-lg text-cream/80">
              OL&apos;NAVAE now acts like a fashion concierge: it searches a live brand-backed catalog snapshot, shows where pieces come from, and estimates when they can land.
            </p>
            <div className="h-btns mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onBrowse}
                className="rounded-full bg-cream px-6 py-3 text-sm font-medium text-navy transition-all duration-300 hover:bg-white hover:shadow-lg"
              >
                Browse the catalog
              </button>
              <button
                onClick={() => onRunAssistant(DEFAULT_PROMPT)}
                className="rounded-full border border-cream/25 bg-cream/10 px-6 py-3 text-sm font-medium text-cream transition-all duration-300 hover:bg-cream/20 hover:border-cream/40"
              >
                Ask the AI concierge
              </button>
            </div>

            <div className="h-pills mt-10 grid gap-3 sm:grid-cols-3">
              <TrustPill icon={<ShieldCheck className="h-4 w-4" />} title="Official source" detail="Every product links back to the merchant." />
              <TrustPill icon={<Clock3 className="h-4 w-4" />} title="Delivery clarity" detail="U.S. shipping estimates surfaced in-app." />
              <TrustPill icon={<PackageCheck className="h-4 w-4" />} title="Order ready" detail="Build a concierge request from the cart." />
            </div>
          </div>

          <div className="h-card scale-in relative rounded-[2rem] p-5" style={{background:'rgba(255,255,255,0.07)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,0.15)',boxShadow:'0 25px 50px rgba(15,34,55,0.15),0 8px 16px rgba(0,0,0,0.08),inset 0 1px 0 rgba(255,255,255,0.2)'}}>
            <div className="rounded-[1.5rem] bg-cream p-5">
              <p className="text-xs tracking-[0.28em] text-terracotta">TRY A SEARCH</p>
              <h2 className="mt-3 font-display text-2xl text-navy sm:text-3xl">Search that actually works</h2>
              <p className="mt-2 text-sm text-navy/70">
                Use plain language like “linen top under $100” or “weekend denim shorts.”
              </p>
              <div className="mt-6 space-y-3">
                {[
                  'linen top under $100',
                  'vacation outfit that arrives fast',
                  'denim weekend look',
                ].map((example, idx) => (
                  <button
                    key={example}
                    onClick={() => onRunSearch(example)}
                    style={{animationDelay: `${100 + idx * 50}ms`}}
                    className="slide-in-left flex w-full items-center justify-between rounded-2xl border border-navy/10 bg-white px-4 py-3 text-left text-sm text-navy transition-all duration-300 hover:border-terracotta/30 hover:bg-terracotta/5"
                  >
                    <span>{example}</span>
                    <ArrowRight className="h-4 w-4 text-terracotta" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm tracking-[0.28em] text-terracotta">CURATED DROP</p>
            <h2 className="font-display text-3xl sm:text-4xl">Real products ready for discovery</h2>
          </div>
          <button onClick={onBrowse} className="text-sm text-navy/70 transition-colors hover:text-terracotta">
            View every live product
          </button>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} onOpenProduct={onOpenProduct} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-[2rem] p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr]" style={{background:'rgba(255,255,255,0.88)',backdropFilter:'blur(20px)',border:'1px solid rgba(15,34,55,0.08)',boxShadow:'0 8px 40px rgba(15,34,55,0.08),inset 0 1px 0 rgba(255,255,255,0.8)'}}>
          <div>
            <p className="text-sm tracking-[0.28em] text-terracotta">HOW IT WORKS</p>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl">From prompt to order request</h2>
            <div className="mt-8 grid gap-4">
              {[
                ['1', 'Create an account', 'Sign up or sign in locally so checkout details can persist for this prototype.'],
                ['2', 'Search or ask AI', 'Search the catalog directly or let the concierge interpret budget, vibe, and delivery needs.'],
                ['3', 'Queue the request', 'Add official-source items to the cart and submit an order-ready concierge request.'],
              ].map(([step, title, description]) => (
                <div key={step} className="rounded-3xl px-5 py-4" style={{background:'rgba(247,243,236,0.8)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.6)'}}>
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-sm text-cream">
                      {step}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">{title}</h3>
                      <p className="mt-1 text-sm text-navy/70">{description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-[linear-gradient(180deg,rgba(198,123,92,0.12),rgba(35,75,110,0.03))] p-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/20 bg-white/70 px-4 py-2 text-sm text-navy">
              <Sparkles className="h-4 w-4 text-terracotta" />
              AI concierge sample
            </div>
            <h3 className="mt-4 font-display text-2xl text-navy sm:text-3xl">“Find me a breathable weekend look under $180.”</h3>
            <p className="mt-3 text-sm leading-7 text-navy/70">
              The assistant ranks pieces, explains why they match, and shows when standard U.S. delivery is likely to land. It can then move the picks into the cart for an order request.
            </p>
            <button
              onClick={() => onRunAssistant('Find me a breathable weekend look under $180 with fast delivery.')}
              className="mt-6 rounded-full bg-navy px-5 py-3 text-sm text-cream transition-colors hover:bg-navy/90"
            >
              Open concierge
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CatalogView({
  filters,
  products: filteredProducts,
  searchValue,
  selectedCategory,
  onCategorySelect,
  onFilterChange,
  onOpenProduct,
  onQuickAdd,
  onRunAssistant,
}: {
  filters: FilterState;
  products: Product[];
  searchValue: string;
  selectedCategory: string;
  onCategorySelect: (categoryId: string) => void;
  onFilterChange: (filters: FilterState) => void;
  onOpenProduct: (productId: string) => void;
  onQuickAdd: (product: Product, size: string, color: string) => void;
  onRunAssistant: (prompt: string) => void;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-6 rounded-[2rem] p-6 depth-shadow-lg" style={{background:'rgba(255,255,255,0.88)',backdropFilter:'blur(20px)',border:'1px solid rgba(15,34,55,0.08)'}}>
          <div>
            <p className="text-sm tracking-[0.28em] text-terracotta">FILTERS</p>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl">Search the live catalog</h2>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-navy">Category</p>
            <div className="space-y-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => onCategorySelect(category.id)}
                  className={`block w-full rounded-2xl px-4 py-3 text-left text-sm transition-colors ${
                    selectedCategory === category.id ? 'bg-navy text-cream' : 'bg-cream text-navy hover:bg-cream/80'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-navy">Price</p>
            <div className="space-y-2">
              {[
                ['all', 'Any price'],
                ['under-100', 'Under $100'],
                ['under-125', 'Under $125'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => onFilterChange({ ...filters, maxPrice: value as PriceFilter })}
                  className={`block w-full rounded-2xl px-4 py-3 text-left text-sm transition-colors ${
                    filters.maxPrice === value ? 'bg-terracotta text-cream' : 'bg-cream text-navy hover:bg-cream/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-navy">Delivery</p>
            <div className="space-y-2">
              {[
                ['all', 'All options'],
                ['fast', 'Fastest delivery first'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => onFilterChange({ ...filters, delivery: value as DeliveryPreference })}
                  className={`block w-full rounded-2xl px-4 py-3 text-left text-sm transition-colors ${
                    filters.delivery === value ? 'bg-sage text-cream' : 'bg-cream text-navy hover:bg-cream/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl p-5 text-cream" style={{background:'linear-gradient(135deg,#1a3a55,#0f2237)',boxShadow:'0 8px 24px rgba(15,34,55,0.3)',border:'1px solid rgba(255,255,255,0.08)'}}>
            <p className="text-sm tracking-[0.24em] text-cream/70">AI SHORTCUT</p>
            <h3 className="mt-2 font-display text-2xl sm:text-3xl">Need help choosing?</h3>
            <p className="mt-2 text-sm text-cream/75">
              Ask the concierge to build an outfit around budget, delivery speed, and occasion.
            </p>
            <button
              onClick={() => onRunAssistant(searchValue || DEFAULT_PROMPT)}
              className="mt-4 rounded-full bg-cream px-5 py-3 text-sm text-navy"
            >
              Use this search in AI
            </button>
          </div>
        </aside>

        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm tracking-[0.28em] text-terracotta">RESULTS</p>
              <h1 className="font-display text-3xl sm:text-4xl">
                {searchValue ? `Search results for "${searchValue}"` : 'Official-source catalog'}
              </h1>
              <p className="mt-2 text-sm text-navy/70">
                {filteredProducts.length} live products with source links, availability, and U.S. delivery guidance.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenProduct={onOpenProduct}
                onQuickAdd={onQuickAdd}
              />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="mt-10 rounded-[2rem] p-10 text-center" style={{background:'rgba(255,255,255,0.7)',backdropFilter:'blur(12px)',border:'1px dashed rgba(15,34,55,0.2)'}}>
              <h2 className="font-display text-2xl sm:text-3xl">No matches yet</h2>
              <p className="mt-2 text-sm text-navy/70">
                Try a broader phrase like “linen top,” “vacation,” or “under $100,” or let the concierge interpret the request.
              </p>
              <button
                onClick={() => onRunAssistant(searchValue || DEFAULT_PROMPT)}
                className="mt-6 rounded-full bg-navy px-5 py-3 text-sm text-cream"
              >
                Ask the AI concierge instead
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  onOpenProduct,
  onQuickAdd,
}: {
  product: Product;
  onOpenProduct: (productId: string) => void;
  onQuickAdd?: (product: Product, size: string, color: string) => void;
}) {
  return (
    <article className="overflow-hidden rounded-[2rem] transition-all duration-300 hover:-translate-y-2 card-3d" style={{background:'rgba(255,255,255,0.92)',border:'1px solid rgba(15,34,55,0.08)',boxShadow:'0 4px 12px rgba(15,34,55,0.06),0 8px 24px rgba(15,34,55,0.10),inset 0 1px 0 rgba(255,255,255,0.8)'}}>
      <button onClick={() => onOpenProduct(product.id)} className="block w-full text-left">
        <div className="relative aspect-[4/5] overflow-hidden" style={{background:'linear-gradient(135deg,#ede7da,#d4c9b0)'}}>
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          {product.feature && (
            <span className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs tracking-[0.2em]" style={{background:'rgba(255,255,255,0.9)',backdropFilter:'blur(12px)',color:'#0f2237',border:'1px solid rgba(255,255,255,0.6)',boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
              {product.feature.toUpperCase()}
            </span>
          )}
        </div>
      </button>
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.25em] text-terracotta">{product.brand.toUpperCase()}</p>
            <button onClick={() => onOpenProduct(product.id)} className="mt-1 text-left">
              <h3 className="text-xl font-medium text-navy transition-colors hover:text-terracotta">{product.name}</h3>
            </button>
          </div>
          <div className="text-right">
            {product.originalPrice && (
              <p className="text-sm text-navy/40 line-through">{formatCurrency(product.originalPrice)}</p>
            )}
            <p className="text-lg font-medium text-navy">{formatCurrency(product.price)}</p>
          </div>
        </div>

        <p className="text-sm leading-6 text-navy/70">{product.description}</p>

        <div className="grid gap-2 text-sm text-navy/70">
          <InfoRow icon={<Store className="h-4 w-4" />} label={product.merchant} value={product.availability} />
          <InfoRow icon={<Clock3 className="h-4 w-4" />} label="Delivery" value={formatDeliveryLabel(product.deliveryBusinessDays)} />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onOpenProduct(product.id)}
            className="flex-1 rounded-full border border-navy/15 px-4 py-3 text-sm text-navy transition-colors hover:border-navy/25 hover:bg-cream"
          >
            View details
          </button>
          {onQuickAdd && (
            <button
              onClick={() => onQuickAdd(product, product.sizes[0], product.colors[0].name)}
              className="rounded-full bg-navy px-5 py-3 text-sm text-cream transition-colors hover:bg-navy/90"
            >
              Quick add
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function ProductView({
  product,
  onAddToCart,
  onAskAi,
}: {
  product: Product;
  onAddToCart: (product: Product, size: string, color: string, quantity?: number) => void;
  onAskAi: (prompt: string) => void;
}) {
  const [selectedSize, setSelectedSize] = useState(product.sizes[0]);
  const [selectedColor, setSelectedColor] = useState(product.colors[0].name);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    setSelectedSize(product.sizes[0]);
    setSelectedColor(product.colors[0].name);
    setQuantity(1);
  }, [product]);

  const handleAddToCart = () => {
    onAddToCart(product, selectedSize, selectedColor, quantity);
    setAddedToCart(true);
    window.setTimeout(() => setAddedToCart(false), 1600);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="overflow-hidden rounded-[2rem]" style={{boxShadow:'0 8px 32px rgba(15,34,55,0.12)',border:'1px solid rgba(15,34,55,0.06)'}}>
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" style={{transition:'transform 0.5s ease'}} onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.04)')} onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')} />
        </div>

        <div className="space-y-8">
          <div>
            <p className="text-sm tracking-[0.28em] text-terracotta">{product.brand.toUpperCase()}</p>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl">{product.name}</h1>
            <div className="mt-4 flex items-end gap-3">
              {product.originalPrice && (
                <span className="text-xl text-navy/40 line-through">{formatCurrency(product.originalPrice)}</span>
              )}
              <span className="text-2xl font-medium text-navy sm:text-3xl">{formatCurrency(product.price)}</span>
            </div>
            <p className="mt-4 max-w-2xl text-base leading-7 text-navy/75">{product.description}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoPanel title="Where it is from" value={product.merchant} detail={product.sourceLabel} icon={<Store className="h-5 w-5" />} />
            <InfoPanel title="When it can arrive" value={formatDeliveryLabel(product.deliveryBusinessDays)} detail="Standard U.S. shipping" icon={<Clock3 className="h-5 w-5" />} />
            <InfoPanel title="Material" value={product.material} detail={product.fit} icon={<Sparkles className="h-5 w-5" />} />
            <InfoPanel title="Availability" value={product.availability} detail="Source link stays attached to the order request" icon={<ShieldCheck className="h-5 w-5" />} />
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-navy">Color</p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(color.name)}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    selectedColor === color.name
                      ? 'border-navy bg-navy text-cream'
                      : 'border-navy/15 bg-white text-navy hover:border-navy/25'
                  }`}
                >
                  <span
                    className="mr-2 inline-block h-3 w-3 rounded-full align-middle"
                    style={{ backgroundColor: color.hex }}
                  />
                  {color.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-navy">Size</p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    selectedSize === size
                      ? 'border-terracotta bg-terracotta text-cream'
                      : 'border-navy/15 bg-white text-navy hover:border-navy/25'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="inline-flex items-center rounded-full border border-navy/15 bg-white">
              <button
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                className="px-4 py-3 text-navy hover:bg-cream"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-10 text-center text-sm text-navy">{quantity}</span>
              <button
                onClick={() => setQuantity((current) => current + 1)}
                className="px-4 py-3 text-navy hover:bg-cream"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm transition-colors ${
                addedToCart ? 'bg-sage text-cream' : 'bg-navy text-cream hover:bg-navy/90'
              }`}
            >
              {addedToCart ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
              {addedToCart ? 'Added to cart' : 'Add to cart'}
            </button>

            <div className="inline-flex items-center gap-2 rounded-full border border-navy/15 bg-cream px-5 py-3 text-sm text-navy/80">
              <Store className="h-4 w-4" />
              Source reference saved in request
            </div>
          </div>

          <div className="rounded-[1.75rem] p-6" style={{background:'rgba(255,255,255,0.88)',backdropFilter:'blur(16px)',border:'1px solid rgba(15,34,55,0.08)',boxShadow:'0 4px 24px rgba(15,34,55,0.07),inset 0 1px 0 rgba(255,255,255,0.8)'}}>
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-terracotta/10 p-3 text-terracotta">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm tracking-[0.24em] text-terracotta">AI ORDER FLOW</p>
                <h2 className="mt-2 font-display text-2xl sm:text-3xl">Let the concierge build around this piece</h2>
                <p className="mt-2 text-sm leading-7 text-navy/70">
                  The assistant can pull this into an outfit request and keep the official source plus delivery estimate attached to the cart.
                </p>
                <button
                  onClick={() => onAskAi(`Build an outfit around ${product.name} with fast delivery.`)}
                  className="mt-4 rounded-full bg-terracotta px-5 py-3 text-sm text-cream transition-colors hover:bg-terracotta/90"
                >
                  Ask AI to style this
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistantView({
  input,
  loading,
  result,
  onAddPlanToCart,
  onInputChange,
  onOpenProduct,
  onRunAssistant,
  uploadedImage,
  onImageUpload,
  styleAnalysis,
}: {
  input: string;
  loading: boolean;
  result: ConciergeResult;
  onAddPlanToCart: (result: ConciergeResult) => void;
  onInputChange: (value: string) => void;
  onOpenProduct: (productId: string) => void;
  onRunAssistant: (prompt: string) => void;
  uploadedImage: string | null;
  onImageUpload: (image: string) => void;
  styleAnalysis: string;
}) {
  const submitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onRunAssistant(input);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        onImageUpload(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] p-6" style={{background:'rgba(255,255,255,0.88)',backdropFilter:'blur(20px)',border:'1px solid rgba(15,34,55,0.08)',boxShadow:'0 8px 32px rgba(15,34,55,0.08),inset 0 1px 0 rgba(255,255,255,0.8)'}}>
          <p className="text-sm tracking-[0.28em] text-terracotta">AI CONCIERGE</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">Ask for a look, budget, or delivery speed</h1>
          <p className="mt-3 text-sm leading-7 text-navy/70">
            This assistant interprets what the customer wants and ranks official-source products by material, occasion, budget, and delivery fit.
          </p>

          <form onSubmit={submitPrompt} className="mt-6 space-y-4">
            <textarea
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              rows={6}
              className="w-full rounded-[1.5rem] border border-navy/10 bg-cream px-5 py-4 text-sm text-navy outline-none transition-colors focus:border-navy/30"
              placeholder="Try: I need a breezy black top under $100 for dinner, and I want it quickly."
            />
            
            <div className="rounded-[1.5rem] border border-dashed border-navy/20 p-5 text-center">
              <p className="text-xs tracking-[0.2em] text-navy/60 mb-3">📸 STYLE REFERENCE (OPTIONAL)</p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="rounded-xl bg-cream px-4 py-3 text-sm text-navy hover:bg-cream/80 transition-colors inline-block">
                  {uploadedImage ? '✅ Photo uploaded' : '📷 Upload style photo'}
                </div>
              </label>
              {uploadedImage && (
                <p className="mt-2 text-xs text-navy/60">{styleAnalysis}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="rounded-full bg-navy px-5 py-3 text-sm text-cream">
                Find matches
              </button>
              {[
                'Build me a linen vacation set under $200.',
                'Find a casual denim weekend look.',
                'Show a dressy top under $100.',
              ].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => onRunAssistant(example)}
                  className="rounded-full border border-navy/15 px-4 py-3 text-sm text-navy transition-colors hover:border-navy/25 hover:bg-cream"
                >
                  {example}
                </button>
              ))}
            </div>
          </form>

          <div className="mt-8 rounded-[1.5rem] p-6 text-cream" style={{background:'linear-gradient(135deg,#1a3a55,#0f2237)',border:'1px solid rgba(255,255,255,0.1)',boxShadow:'0 8px 24px rgba(15,34,55,0.25)'}}>
            <p className="text-sm tracking-[0.24em] text-cream/70">WHAT THIS PROTOTYPE DOES</p>
            <ul className="mt-4 space-y-3 text-sm text-cream/80">
              <li>Matches the prompt against available products and their tags.</li>
              <li>Keeps source links and delivery timelines attached to recommendations.</li>
              <li>Lets the shopper send the AI picks straight into the cart for an order request.</li>
            </ul>
          </div>
        </section>

        <section className="space-y-6">
          {uploadedImage && (
            <div className="rounded-[2rem] overflow-hidden border border-terracotta/20 bg-terracotta/5 p-4">
              <p className="text-xs tracking-[0.2em] text-terracotta mb-3">YOUR STYLE REFERENCE</p>
              <img 
                src={uploadedImage} 
                alt="Style reference" 
                className="w-full h-48 object-cover rounded-2xl"
              />
              <p className="mt-3 text-sm text-navy/70">{styleAnalysis}</p>
            </div>
          )}
          
          {loading ? (
            <div className="rounded-[2rem] p-8 text-center" style={{background:'rgba(194,107,74,0.06)',backdropFilter:'blur(16px)',border:'1px solid rgba(194,107,74,0.2)',boxShadow:'0 8px 32px rgba(194,107,74,0.08)'}}>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{background:'rgba(194,107,74,0.12)',color:'#c26b4a',boxShadow:'0 0 0 8px rgba(194,107,74,0.06)'}}>
                <Bot className="h-8 w-8 animate-pulse" />
              </div>
              <h2 className="mt-4 font-display text-2xl sm:text-3xl">Searching the web…</h2>
              <p className="mt-2 text-sm text-navy/60">
                Scanning H&amp;M, ASOS, Zara, Nordstrom, Uniqlo, Free People and more for the best matches.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                {['H&M', 'ASOS', 'Zara', 'Nordstrom', 'Uniqlo', 'Free People'].map((store) => (
                  <span key={store} className="rounded-full bg-white px-3 py-1 text-xs text-navy/60 shadow-sm">
                    {store}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[2rem] p-6" style={{background:'rgba(194,107,74,0.06)',border:'1px solid rgba(194,107,74,0.2)',backdropFilter:'blur(12px)'}}>
              <p className="text-sm tracking-[0.24em]" style={{color:'#c26b4a'}}>AI RESULT</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">{result.title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7" style={{color:'rgba(15,34,55,0.7)'}}>{result.summary}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <InfoPanel title="Items picked" value={`${result.items.length}`} detail="Ready for cart" icon={<ShoppingBag className="h-5 w-5" />} />
                <InfoPanel title="Projected total" value={formatCurrency(result.total)} detail="Before merchant checkout" icon={<PackageCheck className="h-5 w-5" />} />
                <InfoPanel title="Fastest arrival" value={formatDeliveryLabel(3)} detail="If expedited is chosen" icon={<Clock3 className="h-5 w-5" />} />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => onAddPlanToCart(result)} className="rounded-full px-5 py-3 text-sm" style={{background:'linear-gradient(135deg,#1a3a55,#0f2237)',color:'#f7f3ec',boxShadow:'0 4px 15px rgba(15,34,55,0.3)'}}>
                  Add AI picks to cart
                </button>
                <button onClick={() => onRunAssistant(DEFAULT_PROMPT)} className="rounded-full px-5 py-3 text-sm" style={{border:'1px solid rgba(15,34,55,0.15)',background:'rgba(255,255,255,0.7)',backdropFilter:'blur(8px)'}}>
                  Reset prompt
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {result.items.map((product) => (
              <ProductCard key={product.id} product={product} onOpenProduct={onOpenProduct} />
            ))}
          </div>

          <div className="rounded-[2rem] p-6" style={{background:'rgba(255,255,255,0.88)',backdropFilter:'blur(16px)',border:'1px solid rgba(15,34,55,0.08)',boxShadow:'0 4px 24px rgba(15,34,55,0.06)'}}>
            <p className="text-sm tracking-[0.24em]" style={{color:'#c26b4a'}}>WHY THE AI PICKED THESE</p>
            <div className="mt-4 space-y-3">
              {result.reasons.map((reason) => (
                <div key={reason} className="rounded-2xl px-4 py-3 text-sm" style={{background:'rgba(247,243,236,0.8)',color:'rgba(15,34,55,0.75)'}}>
                  {reason}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StockPulseView({
  onRunAssistant,
  onBack,
}: {
  onRunAssistant: (prompt: string) => void;
  onBack: () => void;
}) {
  const stockApiUrl = import.meta.env.VITE_STOCK_API_URL as string | undefined;
  const [prompt, setPrompt] = useState('black linen top under $120');
  const [budgetInput, setBudgetInput] = useState('120');
  const [brandInput, setBrandInput] = useState('');
  const [siteInput, setSiteInput] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'in-stock-only'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<StockInventoryItem[]>([]);

  const runLookup = useCallback(async () => {
    if (!stockApiUrl) {
      setError('Live stock API is not configured. Set VITE_STOCK_API_URL in your .env file.');
      return;
    }

    setLoading(true);
    setError(null);

    const parsedBudget = Number(budgetInput);
    const payload = {
      prompt,
      budget: Number.isFinite(parsedBudget) ? parsedBudget : null,
      brand: brandInput.trim() || undefined,
      site: siteInput.trim() || undefined,
    };

    try {
      const res = await fetch(`${stockApiUrl.replace(/\/$/, '')}/api/inventory/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Live stock request failed.');
      }

      const data = (await res.json()) as { ok?: boolean; items?: StockInventoryItem[] };
      if (!data.ok || !Array.isArray(data.items)) {
        throw new Error('Inventory API returned an invalid payload.');
      }

      const incoming = data.items;
      setItems(
        availabilityFilter === 'in-stock-only'
          ? incoming.filter((item) => item.availability !== 'Out of stock')
          : incoming,
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load live stock data.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [availabilityFilter, brandInput, budgetInput, prompt, siteInput, stockApiUrl]);

  useEffect(() => {
    void runLookup();
  }, [runLookup]);

  const inStockCount = items.filter((item) => item.availability === 'In stock').length;
  const limitedCount = items.filter((item) => item.availability === 'Limited stock').length;
  const outCount = items.filter((item) => item.availability === 'Out of stock').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] p-6 sm:p-8" style={{background:'rgba(255,255,255,0.9)',backdropFilter:'blur(18px)',border:'1px solid rgba(15,34,55,0.08)',boxShadow:'0 12px 36px rgba(15,34,55,0.09),inset 0 1px 0 rgba(255,255,255,0.8)'}}>
        <p className="text-sm tracking-[0.28em] text-terracotta">LIVE STOCK INTEL</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl">Cross-brand inventory pulse</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-navy/70">
          Query the stock aggregator directly from the frontend to validate live availability, delivery speed, and out-of-stock filtering before recommending products.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-navy/15 bg-white px-5 py-2 text-sm text-navy transition-colors hover:bg-cream"
          >
            Back to catalog
          </button>
          {[
            { label: 'Vacation under $150', prompt: 'vacation dress under $150', budget: '150' },
            { label: 'Office linen under $120', prompt: 'office linen top under $120', budget: '120' },
            { label: 'Fast weekend denim', prompt: 'weekend denim look fast delivery', budget: '180' },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                setPrompt(option.prompt);
                setBudgetInput(option.budget);
              }}
              className="rounded-full border border-terracotta/20 bg-terracotta/5 px-4 py-2 text-xs tracking-[0.14em] text-navy transition-colors hover:bg-terracotta/10"
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_150px_150px_170px_auto]">
          <input
            type="text"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="w-full rounded-2xl border border-navy/10 bg-cream px-4 py-3 text-sm outline-none focus:border-navy/25"
            placeholder="Try: vacation dress from zara under $150"
          />
          <input
            type="text"
            value={budgetInput}
            onChange={(event) => setBudgetInput(event.target.value)}
            className="w-full rounded-2xl border border-navy/10 bg-cream px-4 py-3 text-sm outline-none focus:border-navy/25"
            placeholder="Budget"
          />
          <input
            type="text"
            value={brandInput}
            onChange={(event) => setBrandInput(event.target.value)}
            className="w-full rounded-2xl border border-navy/10 bg-cream px-4 py-3 text-sm outline-none focus:border-navy/25"
            placeholder="Brand (optional)"
          />
          <input
            type="text"
            value={siteInput}
            onChange={(event) => setSiteInput(event.target.value)}
            className="w-full rounded-2xl border border-navy/10 bg-cream px-4 py-3 text-sm outline-none focus:border-navy/25"
            placeholder="Site like zara.com"
          />
          <button
            type="button"
            onClick={() => void runLookup()}
            disabled={loading}
            className="rounded-2xl bg-navy px-5 py-3 text-sm text-cream transition-colors hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Checking...' : 'Check live stock'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-navy/75">
          <span className="text-xs tracking-[0.2em] text-terracotta">VIEW OPTIONS</span>
          <button
            type="button"
            onClick={() => setAvailabilityFilter('all')}
            className={`rounded-full px-4 py-2 transition-colors ${availabilityFilter === 'all' ? 'bg-navy text-cream' : 'border border-navy/15 bg-white text-navy'}`}
          >
            Show all statuses
          </button>
          <button
            type="button"
            onClick={() => setAvailabilityFilter('in-stock-only')}
            className={`rounded-full px-4 py-2 transition-colors ${availabilityFilter === 'in-stock-only' ? 'bg-navy text-cream' : 'border border-navy/15 bg-white text-navy'}`}
          >
            In-stock only
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <InfoPanel title="In stock" value={`${inStockCount}`} detail="Ready to buy" icon={<PackageCheck className="h-5 w-5" />} />
          <InfoPanel title="Limited" value={`${limitedCount}`} detail="Low inventory" icon={<Clock3 className="h-5 w-5" />} />
          <InfoPanel title="Out" value={`${outCount}`} detail="Should be excluded" icon={<Minus className="h-5 w-5" />} />
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-terracotta/20 bg-terracotta/5 px-4 py-3 text-sm text-navy/80">
            {error}
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-navy/10">
          <table className="w-full bg-white text-left text-sm">
            <thead className="bg-cream text-xs tracking-[0.2em] text-navy/70">
              <tr>
                <th className="px-4 py-3">ITEM</th>
                <th className="px-4 py-3">SOURCE</th>
                <th className="px-4 py-3">PRICE</th>
                <th className="px-4 py-3">AVAILABILITY</th>
                <th className="px-4 py-3">DELIVERY</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 12).map((item) => (
                <tr key={item.id} className="border-t border-navy/10">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{item.name}</p>
                    <p className="text-xs text-navy/60">{item.brand}</p>
                  </td>
                  <td className="px-4 py-3 text-navy/70">{item.merchant} ({item.source})</td>
                  <td className="px-4 py-3 text-navy">{formatCurrency(item.price)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs ${
                      item.availability === 'In stock'
                        ? 'bg-sage/15 text-sage'
                        : item.availability === 'Limited stock'
                          ? 'bg-terracotta/15 text-terracotta'
                          : 'bg-navy/10 text-navy/65'
                    }`}>
                      {item.availability}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy/70">{formatDeliveryLabel(item.deliveryBusinessDays)}</td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-navy/60">
                    No inventory returned for this query yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => onRunAssistant(prompt)}
            className="rounded-full bg-terracotta px-5 py-3 text-sm text-white transition-colors hover:bg-terracotta/90"
          >
            Send this query to AI concierge
          </button>
          <a
            href={stockApiUrl ? `${stockApiUrl.replace(/\/$/, '')}/health` : '#'}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-navy/15 px-5 py-3 text-sm text-navy transition-colors hover:bg-white"
          >
            Open stock API health
          </a>
        </div>
      </div>
    </div>
  );
}

function CartView({
  currentUser,
  onContinueShopping,
  onGoToCheckout,
  onRunAssistant,
}: {
  currentUser: ActiveUser | null;
  onContinueShopping: () => void;
  onGoToCheckout: () => void;
  onRunAssistant: () => void;
}) {
  const { items, removeFromCart, totalPrice, updateQuantity } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-navy/10 text-navy">
          <ShoppingBag className="h-10 w-10" />
        </div>
        <h1 className="mt-6 font-display text-3xl sm:text-4xl">Your cart is empty</h1>
        <p className="mt-3 text-sm text-navy/70">
          Search the catalog or let the concierge pick pieces first, then your order request can start here.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button onClick={onContinueShopping} className="rounded-full bg-navy px-6 py-3 text-sm text-cream">
            Browse products
          </button>
          <button
            onClick={onRunAssistant}
            className="rounded-full border border-navy/15 px-6 py-3 text-sm text-navy transition-colors hover:border-navy/25 hover:bg-white"
          >
            Ask AI concierge
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-2">
        <p className="text-sm tracking-[0.28em] text-terracotta">ORDER REQUEST</p>
        <h1 className="font-display text-3xl sm:text-4xl">Cart and concierge queue</h1>
        <p className="text-sm text-navy/70">
          {currentUser
            ? `Signed in as ${currentUser.name}.`
            : 'Sign in before checkout so the request can be attached to a customer profile.'}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          {items.map((item) => (
            <article
              key={`${item.id}-${item.size}-${item.color}`}
              className="flex flex-col gap-5 rounded-[2rem] p-5 sm:flex-row"
              style={{background:'rgba(255,255,255,0.9)',border:'1px solid rgba(15,34,55,0.07)',boxShadow:'0 4px 20px rgba(15,34,55,0.07),inset 0 1px 0 rgba(255,255,255,0.8)'}}
            >
              <img src={item.image} alt={item.name} className="h-40 w-full rounded-[1.25rem] object-cover sm:w-32" />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs tracking-[0.25em] text-terracotta">{item.brand.toUpperCase()}</p>
                    <h2 className="mt-1 text-xl font-medium text-navy">{item.name}</h2>
                    <p className="mt-1 text-sm text-navy/60">
                      {item.color} · {item.size}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id, item.size, item.color)}
                    className="rounded-full border border-navy/10 p-2 text-navy/50 transition-colors hover:border-terracotta/25 hover:text-terracotta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-navy/70 sm:grid-cols-2">
                  <InfoRow icon={<Store className="h-4 w-4" />} label={item.merchant} value={item.availability} />
                  <InfoRow icon={<Clock3 className="h-4 w-4" />} label="ETA" value={formatDeliveryLabel(item.deliveryBusinessDays)} />
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="inline-flex items-center rounded-full border border-navy/15 bg-cream">
                    <button
                      onClick={() => updateQuantity(item.id, item.size, item.color, item.quantity - 1)}
                      className="px-4 py-3 text-navy hover:bg-white"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-10 text-center text-sm text-navy">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.size, item.color, item.quantity + 1)}
                      className="px-4 py-3 text-navy hover:bg-white"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs tracking-[0.2em] text-navy/40">LINE TOTAL</p>
                    <p className="text-xl font-medium text-navy">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-5 rounded-[2rem] p-6" style={{background:'rgba(255,255,255,0.88)',backdropFilter:'blur(20px)',border:'1px solid rgba(15,34,55,0.08)',boxShadow:'0 8px 32px rgba(15,34,55,0.08),inset 0 1px 0 rgba(255,255,255,0.8)'}}>
          <div>
            <p className="text-sm tracking-[0.28em] text-terracotta">SUMMARY</p>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl">Ready to place the request</h2>
          </div>

          <div className="space-y-3 rounded-[1.5rem] p-5" style={{background:'rgba(247,243,236,0.8)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.6)'}}>
            <SummaryRow label="Subtotal" value={formatCurrency(totalPrice)} />
            <SummaryRow label="Standard shipping" value="Shown per merchant" />
            <SummaryRow label="Order flow" value="AI-assisted request" />
          </div>

          <div className="rounded-[1.5rem] p-5 text-sm" style={{background:'rgba(194,107,74,0.05)',border:'1px solid rgba(194,107,74,0.18)',color:'rgba(15,34,55,0.75)',backdropFilter:'blur(8px)'}}>
            The current checkout submits a concierge order request and preserves official source links. Direct merchant automation still needs live partner APIs.
          </div>

          <button
            onClick={onGoToCheckout}
            className="w-full rounded-full bg-navy px-5 py-3 text-sm text-cream transition-colors hover:bg-navy/90"
          >
            {currentUser ? 'Continue to checkout' : 'Sign in to continue'}
          </button>
          <button
            onClick={onRunAssistant}
            className="w-full rounded-full border border-navy/15 px-5 py-3 text-sm text-navy transition-colors hover:border-navy/25 hover:bg-cream"
          >
            Re-run with AI concierge
          </button>
          <button onClick={onContinueShopping} className="w-full text-sm text-navy/60 transition-colors hover:text-terracotta">
            Keep browsing
          </button>
        </aside>
      </div>
    </div>
  );
}

function CheckoutView({
  currentUser,
  onBackToCart,
  onSubmitOrder,
}: {
  currentUser: ActiveUser | null;
  onBackToCart: () => void;
  onSubmitOrder: (customerName: string, shippingMethod: ShippingMethod) => void;
}) {
  const { items, totalPrice } = useCart();
  const [formData, setFormData] = useState({
    customerName: currentUser?.name ?? '',
    email: currentUser?.email ?? '',
    phone: '',
    address: '',
    city: '',
    notes: '',
    shippingMethod: 'standard' as ShippingMethod,
  });

  useEffect(() => {
    if (currentUser) {
      setFormData((previous) => ({
        ...previous,
        customerName: currentUser.name,
        email: currentUser.email,
      }));
    }
  }, [currentUser]);

  if (!currentUser || items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl sm:text-4xl">Checkout is waiting on sign-in or cart items</h1>
        <p className="mt-3 text-sm text-navy/70">
          The concierge request needs a signed-in customer and at least one live product in the cart.
        </p>
        <button onClick={onBackToCart} className="mt-8 rounded-full bg-navy px-6 py-3 text-sm text-cream">
          Return to cart
        </button>
      </div>
    );
  }

  const submitCheckout = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmitOrder(formData.customerName, formData.shippingMethod);
  };

  const projectedEta =
    formData.shippingMethod === 'expedited' ? formatDeliveryLabel(3) : formatDeliveryLabel(6);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm tracking-[0.28em] text-terracotta">CHECKOUT</p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl">Submit the concierge order request</h1>
        <p className="mt-2 text-sm text-navy/70">
          This keeps the customer details, delivery choice, and official source links together for fulfillment.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={submitCheckout} className="space-y-6 rounded-[2rem] p-6 depth-shadow-lg" style={{background:'rgba(255,255,255,0.88)',backdropFilter:'blur(20px)',border:'1px solid rgba(15,34,55,0.08)'}}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input
                required
                value={formData.customerName}
                onChange={(event) => setFormData({ ...formData, customerName: event.target.value })}
                className="w-full rounded-2xl border border-navy/10 px-4 py-3 text-sm text-navy"
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                className="w-full rounded-2xl border border-navy/10 px-4 py-3 text-sm text-navy"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <input
                required
                value={formData.phone}
                onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                className="w-full rounded-2xl border border-navy/10 px-4 py-3 text-sm text-navy"
              />
            </Field>
            <Field label="City">
              <input
                required
                value={formData.city}
                onChange={(event) => setFormData({ ...formData, city: event.target.value })}
                className="w-full rounded-2xl border border-navy/10 px-4 py-3 text-sm text-navy"
              />
            </Field>
          </div>

          <Field label="Delivery address">
            <input
              required
              value={formData.address}
              onChange={(event) => setFormData({ ...formData, address: event.target.value })}
              className="w-full rounded-2xl border border-navy/10 px-4 py-3 text-sm text-navy"
            />
          </Field>

          <Field label="Special order notes">
            <textarea
              value={formData.notes}
              onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
              rows={4}
              className="w-full rounded-[1.25rem] border border-navy/10 px-4 py-3 text-sm text-navy"
              placeholder="Sizing preferences, alternate color, or styling notes for the concierge."
            />
          </Field>

          <div>
            <p className="mb-3 text-sm font-medium text-navy">Delivery preference</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, shippingMethod: 'standard' })}
                className={`rounded-[1.5rem] border px-4 py-4 text-left transition-colors ${
                  formData.shippingMethod === 'standard'
                    ? 'border-navy bg-navy text-cream'
                    : 'border-navy/10 bg-cream text-navy'
                }`}
              >
                <p className="font-medium">Standard</p>
                <p className="mt-1 text-sm opacity-80">Official estimate: 6 business days.</p>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, shippingMethod: 'expedited' })}
                className={`rounded-[1.5rem] border px-4 py-4 text-left transition-colors ${
                  formData.shippingMethod === 'expedited'
                    ? 'border-terracotta bg-terracotta text-cream'
                    : 'border-navy/10 bg-cream text-navy'
                }`}
              >
                <p className="font-medium">Expedited</p>
                <p className="mt-1 text-sm opacity-80">Target window: about 3 business days.</p>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <button type="submit" className="rounded-full bg-navy px-6 py-3 text-sm text-cream">
              Submit order request
            </button>
            <button
              type="button"
              onClick={onBackToCart}
              className="rounded-full border border-navy/15 px-6 py-3 text-sm text-navy transition-colors hover:border-navy/25 hover:bg-cream"
            >
              Back to cart
            </button>
          </div>
        </form>

        <aside className="space-y-5 rounded-[2rem] p-6" style={{background:'rgba(255,255,255,0.88)',backdropFilter:'blur(20px)',border:'1px solid rgba(15,34,55,0.08)',boxShadow:'0 8px 32px rgba(15,34,55,0.08),inset 0 1px 0 rgba(255,255,255,0.8)'}}>
          <div>
            <p className="text-sm tracking-[0.24em] text-terracotta">REQUEST SNAPSHOT</p>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl">What gets submitted</h2>
          </div>

          <div className="space-y-4">
            {items.map((item) => (
              <div key={`${item.id}-${item.size}-${item.color}`} className="flex gap-3 rounded-[1.25rem] bg-cream p-3">
                <img src={item.image} alt={item.name} className="h-20 w-16 rounded-xl object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-navy">{item.name}</p>
                  <p className="mt-1 text-xs text-navy/60">
                    {item.color} · {item.size} · Qty {item.quantity}
                  </p>
                  <p className="mt-1 text-xs text-navy/60">{item.brand}</p>
                </div>
                <span className="text-sm text-navy">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-3 rounded-[1.5rem] p-5 text-sm" style={{background:'rgba(247,243,236,0.8)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.6)'}}>
            <SummaryRow label="Subtotal" value={formatCurrency(totalPrice)} />
            <SummaryRow label="Delivery target" value={projectedEta} />
            <SummaryRow label="Order type" value="Concierge request" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function SuccessView({
  order,
  onContinueShopping,
}: {
  order: SubmittedOrder;
  onContinueShopping: () => void;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] p-6 text-center sm:p-8" style={{background:'rgba(255,255,255,0.88)',backdropFilter:'blur(24px)',border:'1px solid rgba(122,158,126,0.2)',boxShadow:'0 20px 60px rgba(15,34,55,0.12),inset 0 1px 0 rgba(255,255,255,0.8)'}}>
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full" style={{background:'linear-gradient(135deg,#7a9e7e,#5a7e5e)',color:'#f7f3ec',boxShadow:'0 8px 24px rgba(122,158,126,0.4)'}}>
          <Check className="h-10 w-10" />
        </div>
        <p className="mt-6 text-sm tracking-[0.28em] text-terracotta">REQUEST CREATED</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">Order {order.id} is queued</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-navy/70">
          {order.customerName}, the concierge request has been assembled with official source references. The selected delivery target is {order.etaLabel}.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <InfoPanel title="Items" value={`${order.items.length}`} detail="Saved in the request" icon={<ShoppingBag className="h-5 w-5" />} />
          <InfoPanel title="Shipping" value={order.shippingMethod === 'expedited' ? 'Expedited' : 'Standard'} detail={order.etaLabel} icon={<Clock3 className="h-5 w-5" />} />
          <InfoPanel title="Subtotal" value={formatCurrency(order.subtotal)} detail="Before final merchant checkout" icon={<PackageCheck className="h-5 w-5" />} />
        </div>

        <div className="mt-8 rounded-[1.75rem] bg-cream p-6 text-left">
          <p className="text-sm tracking-[0.24em] text-terracotta">PRODUCT DETAILS SAVED</p>
          <div className="mt-4 space-y-3">
            {order.items.map((item) => (
              <div
                key={`${item.id}-${item.size}-${item.color}`}
                className="rounded-2xl bg-white px-4 py-3 text-sm text-navy"
              >
                <p className="font-medium">
                  {item.name} · {item.color} · {item.size}
                </p>
                <p className="mt-1 text-xs text-navy/65">{item.description ?? 'Description unavailable for this source item.'}</p>
              </div>
            ))}
          </div>
        </div>

        <button onClick={onContinueShopping} className="mt-8 rounded-full bg-navy px-6 py-3 text-sm text-cream">
          Continue shopping
        </button>
      </div>
    </div>
  );
}

function AuthView({
  authMode,
  onAuthModeChange,
  onAuthSuccess,
  setUsers,
  users,
}: {
  authMode: AuthMode;
  onAuthModeChange: (mode: AuthMode) => void;
  onAuthSuccess: (user: ActiveUser) => void;
  setUsers: (users: StoredUser[]) => void;
  users: StoredUser[];
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    styleFocus: '',
  });
  const [error, setError] = useState('');

  const submitAuth = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (authMode === 'signup') {
      if (formData.password.length < 6) {
        setError('Use at least 6 characters for the demo password.');
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      if (users.some((user) => user.email.toLowerCase() === formData.email.toLowerCase())) {
        setError('That email already has a local account on this device.');
        return;
      }

      const nextUser: StoredUser = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        styleFocus: formData.styleFocus || 'polished minimal looks',
      };

      setUsers([...users, nextUser]);
      onAuthSuccess({
        name: nextUser.name,
        email: nextUser.email,
        styleFocus: nextUser.styleFocus,
      });
      return;
    }

    const existingUser = users.find(
      (user) =>
        user.email.toLowerCase() === formData.email.toLowerCase() && user.password === formData.password,
    );

    if (!existingUser) {
      setError('No local account matched that email and password.');
      return;
    }

    onAuthSuccess({
      name: existingUser.name,
      email: existingUser.email,
      styleFocus: existingUser.styleFocus,
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[2rem] p-6 sm:p-8" style={{background:'linear-gradient(160deg,#1a3a55,#0f2237)',boxShadow:'0 20px 60px rgba(15,34,55,0.4)',border:'1px solid rgba(255,255,255,0.08)'}}>
          <p className="text-sm tracking-[0.28em] text-cream/70">ACCOUNT</p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl">Sign in or create a customer profile</h1>
          <p className="mt-4 text-sm leading-7 text-cream/75">
            Login makes the checkout request usable: customer details persist, AI prompts can stay personal, and the concierge can prepare orders with the right contact info.
          </p>

          <div className="mt-8 grid gap-4">
            <TrustPill icon={<User className="h-4 w-4" />} title="Local auth" detail="Stored in this browser for the prototype." />
            <TrustPill icon={<ShoppingBag className="h-4 w-4" />} title="Reusable checkout" detail="Customer details flow into the order request." />
            <TrustPill icon={<Bot className="h-4 w-4" />} title="Better AI context" detail="Your saved style focus can steer recommendations." />
          </div>
        </section>

        <section className="rounded-[2rem] p-6 sm:p-8" style={{background:'rgba(255,255,255,0.9)',backdropFilter:'blur(20px)',border:'1px solid rgba(15,34,55,0.08)',boxShadow:'0 8px 32px rgba(15,34,55,0.08),inset 0 1px 0 rgba(255,255,255,0.8)'}}>
          <div className="inline-flex rounded-full bg-cream p-1">
            <button
              onClick={() => onAuthModeChange('signin')}
              className={`rounded-full px-5 py-2 text-sm transition-colors ${
                authMode === 'signin' ? 'bg-navy text-cream' : 'text-navy'
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => onAuthModeChange('signup')}
              className={`rounded-full px-5 py-2 text-sm transition-colors ${
                authMode === 'signup' ? 'bg-terracotta text-cream' : 'text-navy'
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={submitAuth} className="mt-8 space-y-5">
            {authMode === 'signup' && (
              <Field label="Full name">
                <input
                  required
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  className="w-full rounded-2xl border border-navy/10 px-4 py-3 text-sm text-navy"
                />
              </Field>
            )}

            <Field label="Email">
              <input
                required
                type="email"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                className="w-full rounded-2xl border border-navy/10 px-4 py-3 text-sm text-navy"
              />
            </Field>

            <Field label="Password">
              <input
                required
                type="password"
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                className="w-full rounded-2xl border border-navy/10 px-4 py-3 text-sm text-navy"
              />
            </Field>

            {authMode === 'signup' && (
              <>
                <Field label="Confirm password">
                  <input
                    required
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
                    className="w-full rounded-2xl border border-navy/10 px-4 py-3 text-sm text-navy"
                  />
                </Field>
                <Field label="Style focus">
                  <input
                    value={formData.styleFocus}
                    onChange={(event) => setFormData({ ...formData, styleFocus: event.target.value })}
                    placeholder="Example: clean summer linen looks"
                    className="w-full rounded-2xl border border-navy/10 px-4 py-3 text-sm text-navy"
                  />
                </Field>
              </>
            )}

            {error && <div className="rounded-2xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">{error}</div>}

            <button type="submit" className="w-full rounded-full bg-navy px-6 py-3 text-sm text-cream">
              {authMode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function TrustPill({
  detail,
  icon,
  title,
}: {
  detail: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-3xl px-4 py-4" style={{background:'rgba(255,255,255,0.08)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.15)',boxShadow:'inset 0 1px 0 rgba(255,255,255,0.15)'}}>
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-white/10 p-2 text-cream">{icon}</div>
        <div>
          <h3 className="text-sm font-medium text-cream">{title}</h3>
          <p className="mt-1 text-sm text-cream/70">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function InfoPanel({
  detail,
  icon,
  title,
  value,
}: {
  detail: string;
  icon: ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.5rem] p-4 depth-shadow" style={{background:'rgba(255,255,255,0.85)',backdropFilter:'blur(12px)',border:'1px solid rgba(15,34,55,0.07)'}}>
      <div className="flex items-start gap-3">
        <div className="rounded-2xl p-3" style={{background:'rgba(247,243,236,0.9)',color:'#0f2237'}}>{icon}</div>
        <div>
          <p className="text-xs tracking-[0.2em] text-terracotta">{title.toUpperCase()}</p>
          <p className="mt-2 text-lg font-medium text-navy">{value}</p>
          <p className="mt-1 text-sm text-navy/60">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-navy/45">{icon}</span>
      <span className="text-navy/50">{label}</span>
      <span className="font-medium text-navy">{value}</span>
    </div>
  );
}

function Field({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-navy">{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-navy/60">{label}</span>
      <span className="text-right text-navy">{value}</span>
    </div>
  );
}

function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return initialValue;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function filterProducts(productList: Product[], query: string, filters: FilterState) {
  const normalizedQuery = query.trim().toLowerCase();
  const budget = extractBudget(normalizedQuery);

  return productList
    .filter((product) => {
      if (filters.availability === 'available' && product.availability === 'Out of stock') {
        return false;
      }

      if (filters.maxPrice === 'under-100' && product.price > 100) {
        return false;
      }

      if (filters.maxPrice === 'under-125' && product.price > 125) {
        return false;
      }

      if (budget && product.price > budget) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchSpace = [
        product.name,
        product.brand,
        product.category,
        product.description,
        product.material,
        product.fit,
        ...product.tags,
      ]
        .join(' ')
        .toLowerCase();

      return normalizedQuery
        .split(/\s+/)
        .filter(Boolean)
        .every((term) => searchSpace.includes(term));
    })
    .sort((left, right) => {
      if (filters.delivery === 'fast' && left.deliveryBusinessDays !== right.deliveryBusinessDays) {
        return left.deliveryBusinessDays - right.deliveryBusinessDays;
      }

      return left.price - right.price;
    });
}

function buildConciergeResultFromProducts(prompt: string, items: Product[], currentUser: ActiveUser | null = null, hasVisualStyle: boolean = false): ConciergeResult {
  const normalizedPrompt = prompt.trim().toLowerCase();
  const budget = extractBudget(normalizedPrompt);
  const wantsOutfit = /(outfit|look|set|vacation|weekend|office|build around)/.test(normalizedPrompt);

  const ranked = [...items].sort(
    (a, b) => scoreProduct(b, normalizedPrompt, budget, currentUser, hasVisualStyle) - scoreProduct(a, normalizedPrompt, budget, currentUser, hasVisualStyle),
  );
  const selectedItems = wantsOutfit ? buildSmartOutfit(ranked, normalizedPrompt) : ranked.slice(0, 3);
  const safeItems = selectedItems.length > 0 ? selectedItems : ranked.slice(0, 3);
  const total = safeItems.reduce((sum, item) => sum + item.price, 0);

  return {
    title: wantsOutfit ? '✨ AI outfit plan — web results' : '🛍️ Best web matches for your request',
    summary: buildConciergeSummary(prompt, safeItems, total),
    reasons: [
      `🌐 Searched across multiple brand websites and marketplaces for "${prompt}".`,
      ...buildConciergeReasons(normalizedPrompt, safeItems, budget),
    ],
    items: safeItems,
    total,
  };
}

function buildLocalConciergeResult(prompt: string, currentUser: ActiveUser | null = null, hasVisualStyle: boolean = false): ConciergeResult {
  const normalizedPrompt = prompt.trim().toLowerCase();
  const budget = extractBudget(normalizedPrompt);
  const wantsOutfit = /(outfit|look|set|vacation|weekend|office|build around)/.test(normalizedPrompt);
  const pool = products.filter((product) => product.availability !== 'Out of stock');

  const ranked = [...pool].sort((left, right) => scoreProduct(right, normalizedPrompt, budget, currentUser, hasVisualStyle) - scoreProduct(left, normalizedPrompt, budget, currentUser, hasVisualStyle));
  const selectedItems = wantsOutfit ? buildSmartOutfit(ranked, normalizedPrompt) : ranked.slice(0, 3);
  const safeItems = selectedItems.length > 0 ? selectedItems : ranked.slice(0, 3);
  const total = safeItems.reduce((sum, item) => sum + item.price, 0);

  return {
    title: wantsOutfit ? '✨ AI outfit plan' : '🎯 Best-matching product picks',
    summary: buildConciergeSummary(prompt, safeItems, total),
    reasons: buildConciergeReasons(normalizedPrompt, safeItems, budget),
    items: safeItems,
    total,
  };
}

function buildConciergeSummary(prompt: string, items: Product[], total: number) {
  if (items.length === 0) {
    return 'The concierge could not find a close match yet, so it is ready to broaden the search.';
  }

  const itemCount = items.length;
  const avgPrice = Math.round(total / itemCount);
  const brands = new Set(items.map(i => i.brand)).size;
  
  const firstItem = items[0];
  const secondItem = items[1];
  const thirdItem = items[2];
  
  let itemMention = firstItem.name;
  if (secondItem) {
    itemMention += ` paired with ${secondItem.name}`;
  }
  if (thirdItem) {
    itemMention += ` and ${thirdItem.name}`;
  }

  const merchantList = [...new Set(items.map(i => i.merchant))].slice(0, 3).join(', ');

  return `For "${prompt}", the concierge prioritized ${itemMention}. These ${itemCount} pieces average ${formatCurrency(avgPrice)} each, come from ${brands} brand${brands > 1 ? 's' : ''} (${merchantList}), and all include official source links. Total: ${formatCurrency(total)} ready for your order request.`;
}

function buildConciergeReasons(prompt: string, items: Product[], budget: number | null) {
  const reasons: string[] = [];
  const promptLower = prompt.toLowerCase();
  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
  const avgPrice = totalPrice / items.length;

  // SMART BUDGET REASONING
  if (budget) {
    const savings = budget - totalPrice;
    if (savings > 0) {
      reasons.push(`💰 ${savings > 50 ? 'Significant savings' : 'Smart value'}: Staying ${savings > 50 ? 'well' : ''} under your $${budget} budget with quality pieces.`);
    } else {
      reasons.push(`💰 Just ${Math.abs(savings).toFixed(0)} over budget—premium items worth the investment.`);
    }
  }

  // OCCASION-SPECIFIC REASONING
  if (/(office|work|professional|meeting|corporate)/.test(promptLower)) {
    reasons.push('👔 Office-appropriate styling: Polished pieces with professional materials and flattering fits.');
  } else if (/(dinner|event|night|formal|dress|party|gala)/.test(promptLower)) {
    reasons.push('✨ Evening elegance: Premium fabrics and elevated silhouettes for special occasions.');
  } else if (/(weekend|casual|relax|chill|easy)/.test(promptLower)) {
    reasons.push('😌 Weekend-ready comfort: Relaxed fits and durable materials for effortless styling.');
  } else if (/(vacation|travel|resort|beach)/.test(promptLower)) {
    reasons.push('🏖️ Travel-smart pieces: Lightweight, versatile items that pack well and transition easily.');
  }

  // MATERIAL INTELLIGENCE REASONING
  const materials = items.map(item => item.material.toLowerCase());
  if (materials.some(m => m.includes('linen'))) {
    reasons.push('🌬️ Temperature-friendly fabrics: Breathable linen and cotton keep you comfortable.');
  }
  if (materials.some(m => m.includes('silk') || m.includes('satin'))) {
    reasons.push('💎 Luxury finishes: Silk and satin provide premium drape and sophisticated appearance.');
  }
  if (materials.some(m => m.includes('wool') || m.includes('knit'))) {
    reasons.push('🧥 Cozy construction: Quality knits and wool provide warmth and lasting durability.');
  }

  // OUTFIT COHERENCE REASONING
  if (items.length >= 2) {
    const topColor = items.find(i => i.category === 'tops')?.colors[0]?.name || 'versatile';
    reasons.push(`🎨 Color coordination: Complementary pieces that work beautifully together—${topColor} top with coordinating bottoms.`);
  }

  // DELIVERY REASONING
  const avgDelivery = items.reduce((sum, item) => sum + item.deliveryBusinessDays, 0) / items.length;
  if (avgDelivery <= 3) {
    reasons.push('⚡ Fast delivery: Most pieces arrive within 3 business days.');
  } else if (avgDelivery <= 5) {
    reasons.push('📅 Reasonable timeline: Standard delivery in 5 business days or less.');
  }

  // BRAND STRATEGY REASONING
  const brands = new Set(items.map(i => i.brand));
  if (brands.size >= 2) {
    reasons.push(`🏬 Official sources: Curated from ${Array.from(brands).join(', ')} for authentic quality.`);
  } else if (brands.size === 1) {
    reasons.push(`🏢 Consistent quality: All pieces from ${Array.from(brands)[0]}, unified aesthetic.`);
  }

  // VERSATILITY REASONING
  const versatiePieces = items.filter(i => /(versatile|layerable|timeless|classic)/.test(i.tags.join(' ').toLowerCase()));
  if (versatiePieces.length > 0) {
    reasons.push(`♻️ Versatile pieces: These items mix-and-match beautifully for multiple outfit combinations.`);
  }

  // PRICE POSITIONING
  if (avgPrice < 75) {
    reasons.push('✅ Budget-friendly selection: Great quality without premium pricing.');
  } else if (avgPrice > 150) {
    reasons.push('👑 Investment pieces: Higher-quality items that endure seasons of wear.');
  }

  // STYLE EXPRESSION REASONING
  if (/(bold|statement|color|vibrant|pattern)/.test(promptLower)) {
    reasons.push('🎭 Fashion-forward choices: These pieces showcase personality and style confidence.');
  } else if (/(minimal|clean|simple|neutral)/.test(promptLower)) {
    reasons.push('⚪ Minimalist elegance: Clean lines and neutral tones create timeless sophistication.');
  }

  return reasons.length > 0 ? reasons : [
    '✨ Expertly curated: These pieces match your style request with quality and value.',
  ];
}

function scoreProduct(product: Product, prompt: string, budget: number | null, currentUser: ActiveUser | null = null, hasVisualStyle: boolean = false) {
  let score = 0;
  const promptLower = prompt.toLowerCase();
  const tagsJoined = product.tags.join(' ').toLowerCase();

  // AVAILABILITY (base requirement)
  if (product.availability === 'Out of stock') {
    return -1000; // Never recommend unavailable items
  }
  if (product.availability === 'In stock') {
    score += 30;
  } else {
    score += 14; // Limited stock can still be recommended
  }

  // BUDGET INTELLIGENCE (advanced price-to-value)
  if (budget) {
    const priceRatio = product.price / budget;
    if (priceRatio <= 0.6) {
      score += 35; // Excellent value - well under budget
    } else if (priceRatio <= 0.85) {
      score += 28; // Great value - under budget
    } else if (priceRatio <= 1.0) {
      score += 22; // Perfect - at budget
    } else if (priceRatio <= 1.15) {
      score += 12; // Slightly over - acceptable
    } else if (priceRatio <= 1.3) {
      score -= 5; // Moderately over
    } else {
      score -= 50; // Too expensive
    }
  } else {
    score += 8; // Neutral when no budget
  }

  // SEMANTIC TAG MATCHING (highest signal)
  const promptTerms = promptLower.split(/\s+/).map(t => t.replace(/[^a-z]/g, ''));
  const productTagsLower = product.tags.map(t => t.toLowerCase());
  const exactMatches = promptTerms.filter(term => 
    productTagsLower.some(tag => tag === term)
  ).length;
  const partialMatches = promptTerms.filter(term => 
    productTagsLower.some(tag => (tag.includes(term) || term.includes(tag)) && term.length > 2)
  ).length;
  score += exactMatches * 18 + partialMatches * 8;

  // OCCASION INTELLIGENCE (context-aware matching)
  const occasionMap = {
    'office|work|professional|meeting|corporate': { bonus: 25, materials: ['cotton', 'linen', 'polyester'], fits: ['fitted', 'straight'] },
    'dinner|event|night|formal|dress|party|gala': { bonus: 28, materials: ['silk', 'satin', 'velvet', 'chiffon'], fits: ['fitted', 'bodycon'] },
    'weekend|casual|relax|chill|easy': { bonus: 22, materials: ['cotton', 'denim', 'linen'], fits: ['relaxed', 'oversized', 'straight'] },
    'vacation|travel|getaway|resort|beach': { bonus: 24, materials: ['cotton', 'linen', 'lightweight'], fits: ['relaxed', 'comfortable'] },
    'date|romantic|intimate': { bonus: 26, materials: ['silk', 'satin', 'chiffon'], fits: ['fitted', 'A-line'] },
    'gym|sport|active|exercise': { bonus: 20, materials: ['spandex', 'athletic', 'performance'], fits: ['fitted', 'athletic'] },
    'summer|warm|hot|beach|breezy': { bonus: 23, materials: ['cotton', 'linen', 'lightweight', 'breathable'], fits: ['relaxed', 'loose'] },
    'winter|cold|warm|cozy|layer': { bonus: 22, materials: ['wool', 'knit', 'fleece', 'thermal'], fits: ['fitted', 'relaxed'] },
  };

  for (const [occasion, config] of Object.entries(occasionMap)) {
    if (new RegExp(occasion).test(promptLower)) {
      score += config.bonus;
      const productMaterialLower = product.material.toLowerCase();
      if (config.materials.some(mat => productMaterialLower.includes(mat))) {
        score += 12;
      }
      if (config.fits.some(fit => product.fit.toLowerCase().includes(fit))) {
        score += 10;
      }
    }
  }

  // MATERIAL INTELLIGENCE (season & occasion)
  const materialQuality: {[key: string]: number} = {
    'silk': 15, 'linen': 14, 'cotton': 13, 'merino': 13, 'cashmere': 16,
    'wool': 12, 'linen-blend': 11, 'polyester': 5, 'synthetic': 3
  };
  const productMatLower = product.material.toLowerCase();
  for (const [material, quality] of Object.entries(materialQuality)) {
    if (productMatLower.includes(material)) {
      score += Math.min(quality, 8);
      break;
    }
  }

  // DELIVERY OPTIMIZATION (when urgency is expressed)
  if (/(fast|quick|soon|asap|urgent|immediately|need it by|before)/.test(promptLower)) {
    const deliveryScore = Math.max(0, 25 - product.deliveryBusinessDays * 3);
    score += deliveryScore;
  }

  // COLOR STRATEGY (complements to common wardrches)
  const neutrals = ['black', 'white', 'gray', 'beige', 'navy', 'cream', 'tan', 'charcoal'];
  const userWantsNeutral = /neutral|basic|simple|minimal|monochrome/.test(promptLower);
  const isNeutral = product.colors.some(c => neutrals.includes(c.name.toLowerCase()));
  
  if (userWantsNeutral && isNeutral) {
    score += 16; // Neutrals are highly versatile
  } else if (!userWantsNeutral && !isNeutral) {
    score += 12; // Color pieces for expressive looks
  }

  // VISUAL STYLE MATCHING (from photo uploads)
  if (hasVisualStyle) {
    score += 8;
    if (product.colors.length >= 2) score += 7;
    if (['tops', 'bottoms'].includes(product.category)) score += 6;
    // Boost versatile pieces that work across multiple contexts
    if (/(everyday|versatile|layerable|classic)/.test(tagsJoined)) score += 10;
  }

  // PERSONALIZED STYLE PREFERENCE
  if (currentUser?.styleFocus) {
    const styleFocus = currentUser.styleFocus.toLowerCase();
    const styleBoosts: Array<{ pattern: RegExp; checker: (tag: string) => boolean; bonus: number }> = [
      { pattern: /minimal|clean|simple|understated/, checker: (tag) => /(minimal|simple|clean|neutral|basic)/.test(tag), bonus: 14 },
      { pattern: /bold|statement|vibrant|color/, checker: (tag) => /(statement|bold|vibrant|color|pattern)/.test(tag), bonus: 14 },
      { pattern: /edgy|modern|punk|rock|avant/, checker: (tag) => /(edgy|modern|contemporary|avant|structural)/.test(tag), bonus: 14 },
      { pattern: /romantic|feminine|delicate|soft/, checker: (tag) => /(romantic|feminine|delicate|soft|elegant)/.test(tag), bonus: 14 },
      { pattern: /classic|timeless|preppy|heritage/, checker: (tag) => /(classic|timeless|heritage|preppy|elegant)/.test(tag), bonus: 14 },
      { pattern: /bohemian|eclectic|artsy|free/, checker: (tag) => /(bohemian|eclectic|artistic|free|relaxed)/.test(tag), bonus: 14 },
    ];
    for (const { pattern, checker, bonus } of styleBoosts) {
      if (pattern.test(styleFocus)) {
        if (checker(tagsJoined)) {
          score += bonus;
        }
      }
    }
  }

  // BRAND POSITIONING (quality tiers)
  const brandTiers: {[key: string]: number} = {
    // Premium: better materials, construction
    'madewell': 10, 'jcrew': 9, 'free people': 9, 'everlane': 8,
    // Mid-range: good quality, fashion-forward
    'uniqlo': 6, 'h&m': 5, 'zara': 6, 'asos': 5,
    // Value: accessible but lower quality
    'target': 2, 'walmart': 1
  };
  const brandLower = product.brand.toLowerCase();
  for (const [brand, boost] of Object.entries(brandTiers)) {
    if (brandLower.includes(brand)) {
      score += boost;
      break;
    }
  }

  // CATEGORY APPROPRIATENESS
  const categoryBonus: {[key: string]: number} = {
    'tops': 0, // Base
    'bottoms': 0,
    'dresses': 5, // Dresses are complete looks
    'outerwear': 4,
    'shoes': 2,
    'accessories': 1, // Lower priority
  };
  score += categoryBonus[product.category] || 0;

  // SIZE RANGE INCLUSIVITY (broader availability)
  if (product.sizes.length >= 5) {
    score += 6;
  } else if (product.sizes.length >= 3) {
    score += 3;
  }

  // DESCRIPTION RELEVANCE (how detailed/professional)
  if (product.description.length > 100) {
    score += 4; // Well-documented products
  }

  return Math.max(score, 0); // Never go negative
}

function buildSmartOutfit(rankedProducts: Product[], prompt: string): Product[] {
  const outfit: Product[] = [];
  void prompt;

  // INTELLIGENT OUTFIT COMPOSITION
  // 1. Find best top match
  let bestTop = rankedProducts.find(p => p.category === 'tops');
  if (bestTop) {
    outfit.push(bestTop);
  }

  // 2. Find best bottom that complements the top
  let bestBottom: Product | undefined = rankedProducts
    .filter(p => p.category === 'bottoms' && p.id !== bestTop?.id)
    .sort((a, b) => {
      let colorHarmony = 0;
      // Simple color complementarity scoring
      if (bestTop) {
        const topColors = bestTop.colors.map(c => c.name.toLowerCase());
        const bottomColors = a.colors.map(c => c.name.toLowerCase());
        const bottomBColors = b.colors.map(c => c.name.toLowerCase());
        
        // Check if colors complement each other
        const aComplementary = bottomColors.some(bc => 
          topColors.some(tc => {
            const pairing = [tc, bc].sort().join('-');
            return [
              'black-white', 'navy-white', 'gray-white',
              'blue-white', 'navy-cream', 'black-cream',
              'gray-cream', 'navy-tan', 'black-tan'
            ].includes(pairing);
          })
        );
        
        const bComplementary = bottomBColors.some(bc =>
          topColors.some(tc => {
            const pairing = [tc, bc].sort().join('-');
            return [
              'black-white', 'navy-white', 'gray-white',
              'blue-white', 'navy-cream', 'black-cream',
              'gray-cream', 'navy-tan', 'black-tan'
            ].includes(pairing);
          })
        );
        
        if (aComplementary) colorHarmony += 20;
        if (bComplementary) colorHarmony -= 20;
      }
      return colorHarmony;
    })[0];

  if (bestBottom) {
    outfit.push(bestBottom);
  } else {
    // Fallback to first available bottom
    bestBottom = rankedProducts.find(p => p.category === 'bottoms' && p.id !== bestTop?.id);
    if (bestBottom) outfit.push(bestBottom);
  }

  // 3. Add complementary items (shoes, accessories, outerwear)
  const topAndBottomIds = new Set([bestTop?.id, bestBottom?.id]);
  const complementaryPriority = ['shoes', 'outerwear', 'accessories'];
  
  for (const category of complementaryPriority) {
    const item = rankedProducts.find(p => 
      p.category === category && 
      !topAndBottomIds.has(p.id)
    );
    if (item && outfit.length < 4) {
      outfit.push(item);
      topAndBottomIds.add(item.id);
    }
  }

  // 4. Add one more piece if we need a fuller look
  if (outfit.length < 3) {
    const filler = rankedProducts.find(p => !topAndBottomIds.has(p.id));
    if (filler) outfit.push(filler);
  }

  return outfit.filter(Boolean).slice(0, 4); // Max 4-piece outfit
}

function buildCartPrompt(items: CartItem[]) {
  if (items.length === 0) {
    return DEFAULT_PROMPT;
  }

  return `Build around ${items[0].name} and keep delivery as fast as possible.`;
}

function extractBudget(text: string) {
  const match = text.match(/\$?\s?(\d{2,4})/);
  return match ? Number(match[1]) : null;
}

function analyzeStyleFromImage(imageData: string): string {
  // Visual style analysis - deterministic based on image hash for consistent results
  // In a production app, this would use Azure Computer Vision or similar AI service
  
  const styles = [
    '✨ Minimalist aesthetic detected - Clean lines, neutral palette, understated elegance. Matching products with simple silhouettes and neutral tones.',
    '🎨 Bold & colorful style - Vibrant hues, statement pieces, confident patterns. Finding products with standout colors and distinctive designs.',
    '🌿 Bohemian vibes - Flowing silhouettes, earth tones, natural textures. Curating relaxed, nature-inspired pieces for your look.',
    '⚫ Edgy & modern - Sharp cuts, dark tones, contemporary attitude. Selecting contemporary pieces with attitude and sharp tailoring.',
    '👑 Classic elegance - Timeless pieces, refined details, sophisticated styling. Choosing timeless items with refined craftsmanship.',
    '🌸 Romantic & feminine - Soft textures, delicate details, graceful silhouettes. Finding elegant pieces with romantic and feminine details.',
    '🏔️ Casual & relaxed - Comfortable materials, effortless fit, everyday wearability. Matching comfortable, versatile basics for easy styling.',
    '💎 Luxury & refined - Premium fabrics, attention to detail, elevated styling. Selecting premium pieces with superior craftsmanship.',
    '🎭 Eclectic & artistic - Mixed patterns, creative combinations, unique expression. Finding unique pieces for creative, artistic styling.',
    '⭐ Contemporary chic - Current trends, polished aesthetic, fashion-forward choices. Curating on-trend pieces for modernfashion.',
  ];

  // Use image data hash to deterministically select a style analysis
  const hash = imageData.split('').reduce((acc: number, char) => acc + char.charCodeAt(0), 0);
  const selectedStyle = styles[hash % styles.length];

  return selectedStyle;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function addBusinessDays(baseDate: Date, businessDays: number) {
  const nextDate = new Date(baseDate);
  let remaining = businessDays;

  while (remaining > 0) {
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDay = nextDate.getDay();
    if (nextDay !== 0 && nextDay !== 6) {
      remaining -= 1;
    }
  }

  return nextDate;
}

function formatDeliveryLabel(businessDays: number) {
  const targetDate = addBusinessDays(new Date(), businessDays);
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `by ${formatter.format(targetDate)}`;
}

export default App;
