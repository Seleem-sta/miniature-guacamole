import { useState } from 'react';
import { CartProvider, useCart } from './context/CartContext';
import { categories, getProductById, getNewArrivals, getFeaturedProducts, getProductsByCategory, type Product } from './data/products';
import { ShoppingBag, Plus, Minus, Search, Menu, User, Star, ArrowRight, Check, Trash2 } from 'lucide-react';
import './App.css';

type View = 'home' | 'products' | 'product' | 'cart' | 'checkout' | 'success';

function App() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}

function AppContent() {
  const [view, setView] = useState<View>('home');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { totalItems } = useCart();

  const navigateTo = (newView: View, productId?: string) => {
    setView(newView);
    if (productId) setSelectedProductId(productId);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-cream font-body">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-cream/95 backdrop-blur-md border-b border-navy/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button 
              onClick={() => navigateTo('home')}
              className="font-display text-2xl text-navy tracking-wider"
            >
              OL'NAVAE
            </button>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    navigateTo('products');
                  }}
                  className="text-sm text-navy hover:text-terracotta transition-colors tracking-wider"
                >
                  {cat.name.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              <button className="text-navy hover:text-terracotta transition-colors">
                <Search className="w-5 h-5" />
              </button>
              <button className="text-navy hover:text-terracotta transition-colors">
                <User className="w-5 h-5" />
              </button>
              <button 
                onClick={() => navigateTo('cart')}
                className="relative text-navy hover:text-terracotta transition-colors"
              >
                <ShoppingBag className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-terracotta text-white text-xs rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </button>
              <button 
                className="md:hidden text-navy"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-cream border-t border-navy/10">
            <div className="px-4 py-4 space-y-3">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    navigateTo('products');
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left text-navy py-2"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main>
        {view === 'home' && <HomeView navigateTo={navigateTo} />}
        {view === 'products' && <ProductsView category={selectedCategory} navigateTo={navigateTo} />}
        {view === 'product' && selectedProductId && <ProductView productId={selectedProductId} navigateTo={navigateTo} />}
        {view === 'cart' && <CartView navigateTo={navigateTo} />}
        {view === 'checkout' && <CheckoutView navigateTo={navigateTo} />}
        {view === 'success' && <SuccessView navigateTo={navigateTo} />}
      </main>

      {/* Footer */}
      <footer className="bg-navy text-cream mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-display text-xl mb-4">OL'NAVAE</h3>
              <p className="text-sm text-cream/70">Mediterranean elegance meets sustainable luxury.</p>
            </div>
            <div>
              <h4 className="font-medium mb-4">Shop</h4>
              <ul className="space-y-2 text-sm text-cream/70">
                <li><button onClick={() => navigateTo('products')} className="hover:text-cream">Women</button></li>
                <li><button onClick={() => navigateTo('products')} className="hover:text-cream">Men</button></li>
                <li><button onClick={() => navigateTo('products')} className="hover:text-cream">Accessories</button></li>
                <li><button onClick={() => navigateTo('products')} className="hover:text-cream">New Arrivals</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Help</h4>
              <ul className="space-y-2 text-sm text-cream/70">
                <li><button className="hover:text-cream">Shipping</button></li>
                <li><button className="hover:text-cream">Returns</button></li>
                <li><button className="hover:text-cream">Size Guide</button></li>
                <li><button className="hover:text-cream">Contact</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Newsletter</h4>
              <p className="text-sm text-cream/70 mb-4">Subscribe for exclusive offers.</p>
              <div className="flex">
                <input 
                  type="email" 
                  placeholder="Your email"
                  className="flex-1 px-4 py-2 bg-cream/10 border border-cream/20 rounded-l text-sm text-cream placeholder-cream/50"
                />
                <button className="px-4 py-2 bg-terracotta rounded-r text-sm">Subscribe</button>
              </div>
            </div>
          </div>
          <div className="border-t border-cream/10 mt-8 pt-8 text-center text-sm text-cream/50">
            © 2024 OL'Navae. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

// Home View
function HomeView({ navigateTo }: { navigateTo: (view: View, productId?: string) => void }) {
  const newArrivals = getNewArrivals();
  const featured = getFeaturedProducts();

  return (
    <div>
      {/* Hero */}
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/mood-hero.jpg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-cream/40 via-cream/20 to-cream/60" />
        <div className="relative z-10 text-center px-4">
          <p className="text-sm tracking-[0.3em] text-navy mb-4">MEDITERRANEAN ELEGANCE</p>
          <h1 className="font-display text-5xl md:text-7xl text-navy mb-6">Where Olive Groves<br />Meet the Sea</h1>
          <p className="text-navy/80 max-w-xl mx-auto mb-8">Sustainable luxury fashion inspired by the timeless beauty of coastal living.</p>
          <button 
            onClick={() => navigateTo('products')}
            className="px-8 py-4 bg-navy text-cream rounded hover:bg-navy/90 transition-colors"
          >
            Shop Collection
          </button>
        </div>
      </section>

      {/* Featured Categories */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: 'Women', image: '/products/w-dress-01.jpg' },
            { name: 'Men', image: '/products/m-shirt-01.jpg' },
            { name: 'Accessories', image: '/products/acc-bag-01.jpg' },
          ].map(cat => (
            <button 
              key={cat.name}
              onClick={() => navigateTo('products')}
              className="relative h-96 overflow-hidden group"
            >
              <img 
                src={cat.image} 
                alt={cat.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-navy/30 group-hover:bg-navy/40 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center">
                <h3 className="font-display text-3xl text-cream">{cat.name}</h3>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* New Arrivals */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-3xl text-navy">New Arrivals</h2>
          <button 
            onClick={() => navigateTo('products')}
            className="text-sm text-navy hover:text-terracotta flex items-center gap-2"
          >
            View All <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {newArrivals.map(product => (
            <ProductCard key={product.id} product={product} navigateTo={navigateTo} />
          ))}
        </div>
      </section>

      {/* Sale Banner */}
      <section className="bg-navy text-cream py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm tracking-[0.3em] mb-4">LIMITED TIME</p>
          <h2 className="font-display text-4xl md:text-5xl mb-4">Summer Sale</h2>
          <p className="text-cream/70 mb-8">Up to 30% off selected items</p>
          <button 
            onClick={() => navigateTo('products')}
            className="px-8 py-4 bg-terracotta text-cream rounded hover:bg-terracotta/90 transition-colors"
          >
            Shop Sale
          </button>
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="font-display text-3xl text-navy mb-8">Customer Favorites</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {featured.map(product => (
            <ProductCard key={product.id} product={product} navigateTo={navigateTo} />
          ))}
        </div>
      </section>
    </div>
  );
}

// Product Card Component
function ProductCard({ product, navigateTo }: { product: Product, navigateTo: (view: View, productId?: string) => void }) {
  return (
    <div 
      className="group cursor-pointer"
      onClick={() => navigateTo('product', product.id)}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-sand/30 mb-4">
        <img 
          src={product.image} 
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.isNew && (
          <span className="absolute top-2 left-2 px-3 py-1 bg-navy text-cream text-xs">NEW</span>
        )}
        {product.isSale && (
          <span className="absolute top-2 left-2 px-3 py-1 bg-terracotta text-cream text-xs">SALE</span>
        )}
      </div>
      <h3 className="text-sm text-navy group-hover:text-terracotta transition-colors">{product.name}</h3>
      <div className="flex items-center gap-2 mt-1">
        {product.isSale && product.originalPrice && (
          <span className="text-sm text-navy/50 line-through">${product.originalPrice}</span>
        )}
        <span className="text-sm font-medium text-navy">${product.price}</span>
      </div>
    </div>
  );
}

// Products View
function ProductsView({ category, navigateTo }: { category: string, navigateTo: (view: View, productId?: string) => void }) {
  const [selectedSubcategory, setSelectedSubcategory] = useState('all');
  const filteredProducts = getProductsByCategory(category);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-navy/60 mb-8">
        <button onClick={() => navigateTo('home')}>Home</button>
        <span>/</span>
        <span className="text-navy">{categories.find(c => c.id === category)?.name || 'All'}</span>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <h2 className="font-display text-xl text-navy mb-4">Categories</h2>
          <div className="space-y-2">
            <button
              onClick={() => setSelectedSubcategory('all')}
              className={`block w-full text-left py-2 text-sm ${selectedSubcategory === 'all' ? 'text-terracotta' : 'text-navy/70'}`}
            >
              All {categories.find(c => c.id === category)?.name}
            </button>
          </div>
        </aside>

        {/* Products Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-navy/60">{filteredProducts.length} products</p>
            <select className="px-4 py-2 border border-navy/20 rounded text-sm bg-transparent">
              <option>Sort by: Featured</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Newest</option>
            </select>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} navigateTo={navigateTo} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Product Detail View
function ProductView({ productId, navigateTo }: { productId: string, navigateTo: (view: View, productId?: string) => void }) {
  const product = getProductById(productId);
  const { addToCart } = useCart();
  const [selectedSize, setSelectedSize] = useState(product?.sizes[0] || '');
  const [selectedColor, setSelectedColor] = useState(product?.colors[0].name || '');
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  if (!product) return <div>Product not found</div>;

  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      size: selectedSize,
      color: selectedColor,
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-navy/60 mb-8">
        <button onClick={() => navigateTo('home')}>Home</button>
        <span>/</span>
        <button onClick={() => navigateTo('products')}>{categories.find(c => c.id === product.category)?.name}</button>
        <span>/</span>
        <span className="text-navy">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Product Images */}
        <div className="space-y-4">
          <div className="aspect-[3/4] bg-sand/30">
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Product Info */}
        <div>
          <h1 className="font-display text-3xl text-navy mb-2">{product.name}</h1>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.rating) ? 'fill-terracotta text-terracotta' : 'text-navy/20'}`} />
              ))}
            </div>
            <span className="text-sm text-navy/60">{product.reviews} reviews</span>
          </div>
          
          <div className="flex items-center gap-3 mb-6">
            {product.isSale && product.originalPrice && (
              <span className="text-xl text-navy/50 line-through">${product.originalPrice}</span>
            )}
            <span className="text-2xl font-medium text-navy">${product.price}</span>
          </div>

          <p className="text-navy/70 mb-6">{product.description}</p>

          <div className="mb-6">
            <p className="text-sm text-navy mb-2">Material: <span className="text-navy/70">{product.material}</span></p>
          </div>

          {/* Color Selection */}
          <div className="mb-6">
            <p className="text-sm text-navy mb-2">Color: {selectedColor}</p>
            <div className="flex gap-2">
              {product.colors.map(color => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(color.name)}
                  className={`w-8 h-8 rounded-full border-2 ${selectedColor === color.name ? 'border-navy' : 'border-transparent'}`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Size Selection */}
          <div className="mb-6">
            <p className="text-sm text-navy mb-2">Size</p>
            <div className="flex gap-2">
              {product.sizes.map(size => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`px-4 py-2 border rounded text-sm ${selectedSize === size ? 'border-navy bg-navy text-cream' : 'border-navy/20 text-navy'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="mb-6">
            <p className="text-sm text-navy mb-2">Quantity</p>
            <div className="flex items-center border border-navy/20 rounded w-fit">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-2 text-navy hover:bg-navy/5"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-4 py-2 text-navy">{quantity}</span>
              <button 
                onClick={() => setQuantity(quantity + 1)}
                className="px-3 py-2 text-navy hover:bg-navy/5"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Add to Cart */}
          <div className="flex gap-4">
            <button
              onClick={handleAddToCart}
              className={`flex-1 py-4 rounded transition-colors flex items-center justify-center gap-2 ${
                addedToCart ? 'bg-sage text-cream' : 'bg-navy text-cream hover:bg-navy/90'
              }`}
            >
              {addedToCart ? (
                <><Check className="w-5 h-5" /> Added to Cart</>
              ) : (
                <><ShoppingBag className="w-5 h-5" /> Add to Cart</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Cart View
function CartView({ navigateTo }: { navigateTo: (view: View, productId?: string) => void }) {
  const { items, updateQuantity, removeFromCart, totalPrice } = useCart();

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <ShoppingBag className="w-16 h-16 text-navy/30 mx-auto mb-4" />
        <h2 className="font-display text-2xl text-navy mb-2">Your cart is empty</h2>
        <p className="text-navy/60 mb-6">Add some items to get started</p>
        <button 
          onClick={() => navigateTo('products')}
          className="px-8 py-3 bg-navy text-cream rounded hover:bg-navy/90"
        >
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-navy mb-8">Shopping Cart</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={`${item.id}-${item.size}-${item.color}`} className="flex gap-4 p-4 bg-white rounded-lg border border-navy/10">
              <img src={item.image} alt={item.name} className="w-24 h-32 object-cover rounded" />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-navy">{item.name}</h3>
                    <p className="text-sm text-navy/60">{item.color} / {item.size}</p>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.id, item.size, item.color)}
                    className="text-navy/40 hover:text-terracotta"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center border border-navy/20 rounded">
                    <button 
                      onClick={() => updateQuantity(item.id, item.size, item.color, item.quantity - 1)}
                      className="px-3 py-1 text-navy hover:bg-navy/5"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 text-navy">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.size, item.color, item.quantity + 1)}
                      className="px-3 py-1 text-navy hover:bg-navy/5"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="font-medium text-navy">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="bg-white p-6 rounded-lg border border-navy/10 h-fit">
          <h2 className="font-display text-xl text-navy mb-4">Order Summary</h2>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-navy/60">Subtotal</span>
              <span className="text-navy">${totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-navy/60">Shipping</span>
              <span className="text-navy">Free</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-navy/60">Tax</span>
              <span className="text-navy">${(totalPrice * 0.08).toFixed(2)}</span>
            </div>
          </div>
          <div className="border-t border-navy/10 pt-4 mb-6">
            <div className="flex justify-between">
              <span className="font-medium text-navy">Total</span>
              <span className="font-display text-xl text-navy">${(totalPrice * 1.08).toFixed(2)}</span>
            </div>
          </div>
          <button 
            onClick={() => navigateTo('checkout')}
            className="w-full py-4 bg-navy text-cream rounded hover:bg-navy/90 transition-colors"
          >
            Proceed to Checkout
          </button>
          <button 
            onClick={() => navigateTo('products')}
            className="w-full py-3 mt-2 text-navy hover:text-terracotta transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}

// Checkout View
function CheckoutView({ navigateTo }: { navigateTo: (view: View, productId?: string) => void }) {
  const { items, totalPrice, clearCart } = useCart();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    zip: '',
    country: 'US',
    cardNumber: '',
    cardName: '',
    expiry: '',
    cvv: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
    } else {
      clearCart();
      navigateTo('success');
    }
  };

  if (items.length === 0) {
    navigateTo('cart');
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-navy mb-8">Checkout</h1>

      {/* Progress */}
      <div className="flex items-center justify-center mb-8">
        {['Information', 'Shipping', 'Payment'].map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
              step > i + 1 ? 'bg-sage text-cream' : step === i + 1 ? 'bg-navy text-cream' : 'bg-navy/10 text-navy/40'
            }`}>
              {step > i + 1 ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`ml-2 text-sm ${step === i + 1 ? 'text-navy' : 'text-navy/40'}`}>{s}</span>
            {i < 2 && <div className="w-12 h-px bg-navy/20 mx-4" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm text-navy mb-1">Email</label>
                <input 
                  type="email"
                  required
                  className="w-full px-4 py-3 border border-navy/20 rounded text-navy"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-navy mb-1">First Name</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-4 py-3 border border-navy/20 rounded text-navy"
                    value={formData.firstName}
                    onChange={e => setFormData({...formData, firstName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm text-navy mb-1">Last Name</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-4 py-3 border border-navy/20 rounded text-navy"
                    value={formData.lastName}
                    onChange={e => setFormData({...formData, lastName: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-navy mb-1">Address</label>
                <input 
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-navy/20 rounded text-navy"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-navy mb-1">City</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-4 py-3 border border-navy/20 rounded text-navy"
                    value={formData.city}
                    onChange={e => setFormData({...formData, city: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm text-navy mb-1">ZIP Code</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-4 py-3 border border-navy/20 rounded text-navy"
                    value={formData.zip}
                    onChange={e => setFormData({...formData, zip: e.target.value})}
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="bg-sand/30 p-6 rounded-lg">
              <h3 className="font-medium text-navy mb-4">Shipping Method</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 bg-white rounded border border-navy/20 cursor-pointer">
                  <input type="radio" name="shipping" defaultChecked className="text-navy" />
                  <div className="flex-1">
                    <p className="text-navy font-medium">Standard Shipping</p>
                    <p className="text-sm text-navy/60">5-7 business days</p>
                  </div>
                  <span className="text-navy">Free</span>
                </label>
                <label className="flex items-center gap-3 p-4 bg-white rounded border border-navy/20 cursor-pointer">
                  <input type="radio" name="shipping" className="text-navy" />
                  <div className="flex-1">
                    <p className="text-navy font-medium">Express Shipping</p>
                    <p className="text-sm text-navy/60">2-3 business days</p>
                  </div>
                  <span className="text-navy">$15.00</span>
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="block text-sm text-navy mb-1">Card Number</label>
                <input 
                  type="text"
                  required
                  placeholder="1234 5678 9012 3456"
                  className="w-full px-4 py-3 border border-navy/20 rounded text-navy"
                  value={formData.cardNumber}
                  onChange={e => setFormData({...formData, cardNumber: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-navy mb-1">Cardholder Name</label>
                <input 
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-navy/20 rounded text-navy"
                  value={formData.cardName}
                  onChange={e => setFormData({...formData, cardName: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-navy mb-1">Expiry Date</label>
                  <input 
                    type="text"
                    required
                    placeholder="MM/YY"
                    className="w-full px-4 py-3 border border-navy/20 rounded text-navy"
                    value={formData.expiry}
                    onChange={e => setFormData({...formData, expiry: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm text-navy mb-1">CVV</label>
                  <input 
                    type="text"
                    required
                    placeholder="123"
                    className="w-full px-4 py-3 border border-navy/20 rounded text-navy"
                    value={formData.cvv}
                    onChange={e => setFormData({...formData, cvv: e.target.value})}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-4 pt-4">
            {step > 1 && (
              <button 
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-6 py-3 border border-navy/20 text-navy rounded hover:bg-navy/5"
              >
                Back
              </button>
            )}
            <button 
              type="submit"
              className="flex-1 py-3 bg-navy text-cream rounded hover:bg-navy/90"
            >
              {step === 3 ? 'Complete Order' : 'Continue'}
            </button>
          </div>
        </form>

        {/* Order Summary */}
        <div className="bg-white p-6 rounded-lg border border-navy/10 h-fit">
          <h2 className="font-display text-xl text-navy mb-4">Order Summary</h2>
          <div className="space-y-3 mb-4 max-h-64 overflow-auto">
            {items.map(item => (
              <div key={`${item.id}-${item.size}-${item.color}`} className="flex gap-3">
                <img src={item.image} alt={item.name} className="w-16 h-20 object-cover rounded" />
                <div className="flex-1">
                  <p className="text-sm text-navy font-medium">{item.name}</p>
                  <p className="text-xs text-navy/60">{item.color} / {item.size} / Qty: {item.quantity}</p>
                </div>
                <span className="text-sm text-navy">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-navy/10 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-navy/60">Subtotal</span>
              <span className="text-navy">${totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-navy/60">Shipping</span>
              <span className="text-navy">Free</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-navy/60">Tax</span>
              <span className="text-navy">${(totalPrice * 0.08).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-navy/10">
              <span className="font-medium text-navy">Total</span>
              <span className="font-display text-xl text-navy">${(totalPrice * 1.08).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Success View
function SuccessView({ navigateTo }: { navigateTo: (view: View, productId?: string) => void }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 bg-sage rounded-full flex items-center justify-center mx-auto mb-6">
        <Check className="w-10 h-10 text-cream" />
      </div>
      <h1 className="font-display text-3xl text-navy mb-2">Order Confirmed!</h1>
      <p className="text-navy/60 mb-8">Thank you for your purchase. You will receive a confirmation email shortly.</p>
      <button 
        onClick={() => navigateTo('home')}
        className="px-8 py-3 bg-navy text-cream rounded hover:bg-navy/90"
      >
        Continue Shopping
      </button>
    </div>
  );
}

export default App;
