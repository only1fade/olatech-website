async function fetchProducts(category) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (typeof window !== 'undefined' && window.__FURN_SUB__) params.set('subCategory', window.__FURN_SUB__);
    params.set('t', new Date().getTime());
    const qs = params.toString();
    const url = `/api/products?${qs}`;
    const res = await fetch(url);
    return res.json();
}

function formatCurrency(amount) {
    try {
        return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
    } catch {
        return `₦${amount}`;
    }
}

function productCard(product) {
    const div = document.createElement('div');
    div.className = 'card';
    div.setAttribute('data-animate', 'reveal');
    div.innerHTML = `
        <img src="${product.imageUrl || 'https://via.placeholder.com/400x300?text=Olatech'}" alt="${product.title}">
        <div class="content">
            <div><strong>${product.title}</strong></div>
            <div class="price">${formatCurrency(product.price)}</div>
            <div style="min-height: 42px; color: #94a3b8">${product.description || ''}</div>
            <button class="btn" data-add="${product.id}">Add to cart</button>
        </div>
    `;
    div.querySelector('[data-add]').addEventListener('click', () => addToCart(product.id));
    return div;
}

async function renderSections() {
    const categories = ['land', 'properties', 'furnitures', 'auto'];
    for (const cat of categories) {
        const grid = document.getElementById(`grid-${cat}`);
        if (!grid) continue;
        grid.innerHTML = '<div style="color:#94a3b8">Loading...</div>';
        const items = await fetchProducts(cat);
        grid.innerHTML = '';
        if (!items.length) {
            grid.innerHTML = '<div style="color:#94a3b8">No items yet.</div>';
            continue;
        }
        const frag = document.createDocumentFragment();
        items.forEach((p) => frag.appendChild(productCard(p)));
        grid.appendChild(frag);
        triggerReveal(grid);
    }
}

async function getCart() {
    const res = await fetch('/api/cart');
    return res.json();
}

async function addToCart(productId) {
    await fetch('/api/cart/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, quantity: 1 }) });
    await renderCart();
    document.location.hash = '#cart';
}

async function updateCart(productId, quantity) {
    await fetch('/api/cart/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, quantity }) });
    await renderCart();
}

async function clearCart() {
    await fetch('/api/cart/clear', { method: 'POST' });
    await renderCart();
}

async function renderCart() {
    const container = document.getElementById('cart-items');
    const totalDiv = document.getElementById('cart-total');
    const cartCount = document.getElementById('cart-count');
    const payAmount = document.getElementById('pay-amount');
    const paymentInfo = document.getElementById('payment-info');
    if (!container) {
        // Update header badge only
        try {
            const items = await getCart();
            const count = (items || []).reduce((n, it) => n + (it.quantity || 0), 0);
            if (cartCount) cartCount.textContent = String(count);
        } catch {}
        return;
    }
    const items = await getCart();
    container.innerHTML = '';
    let total = 0;
    let count = 0;
    if (!items.length) {
        container.innerHTML = '<div style="color:#94a3b8">Your cart is empty.</div>';
        totalDiv.textContent = 'Total: ₦0';
        paymentInfo.hidden = true;
        if (cartCount) cartCount.textContent = '0';
        return;
    }
    for (const item of items) {
        const row = document.createElement('div');
        row.className = 'cart-item';
        const subTotal = item.product.price * item.quantity;
        total += subTotal;
        count += item.quantity;
        row.innerHTML = `
            <img src="${item.product.imageUrl || 'https://via.placeholder.com/80'}" alt="${item.product.title}">
            <div>
                <div><strong>${item.product.title}</strong></div>
                <div style="color:#94a3b8">${formatCurrency(item.product.price)} × 
                    <input type="number" min="0" value="${item.quantity}" style="width:72px"> = ${formatCurrency(subTotal)}
                </div>
            </div>
            <div>
                <button class="btn btn-danger">Remove</button>
            </div>
        `;
        const qtyInput = row.querySelector('input');
        qtyInput.addEventListener('change', () => updateCart(item.product.id, Number(qtyInput.value)));
        row.querySelector('.btn-danger').addEventListener('click', () => updateCart(item.product.id, 0));
        container.appendChild(row);
    }
    totalDiv.textContent = `Total: ${formatCurrency(total)}`;
    payAmount.textContent = formatCurrency(total);
    if (cartCount) cartCount.textContent = String(count);
    if (cartCount) {
        cartCount.classList.remove('pulse');
        // trigger reflow to restart animation
        void cartCount.offsetWidth;
        cartCount.classList.add('pulse');
        setTimeout(() => cartCount.classList.remove('pulse'), 400);
    }
}

function setupAdminForm() {
    const form = document.getElementById('admin-form');
    const status = document.getElementById('admin-status');
    if (!form) return;
    const categorySelect = document.getElementById('admin-category');
    const subcatRow = document.getElementById('admin-subcat-row');
    if (categorySelect && subcatRow) {
        const toggleSubcat = () => {
            if (categorySelect.value === 'furnitures') {
                subcatRow.classList.remove('hidden');
            } else {
                subcatRow.classList.add('hidden');
            }
        };
        categorySelect.addEventListener('change', toggleSubcat);
        toggleSubcat();
    }
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAdminFormSubmit(form, status);
    });
}

let adminProductsExpanded = false;
async function renderAdminProducts(searchTerm = '') {
    const productList = document.getElementById('product-list');
    const showMoreBtn = document.getElementById('show-more-btn');
    if (!productList) return;

    const products = await fetchProducts();
    productList.innerHTML = '';

    const filteredProducts = products.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!filteredProducts.length) {
        productList.innerHTML = '<tr><td colspan="5">No products found.</td></tr>';
        showMoreBtn.style.display = 'none';
        return;
    }

    const productsToShow = adminProductsExpanded ? filteredProducts : filteredProducts.slice(0, 5);

    productsToShow.forEach(product => {
        const row = document.createElement('tr');
        row.dataset.productId = product.id;
        row.innerHTML = `
            <td>${product.title}</td>
            <td>${formatCurrency(product.price)}</td>
            <td>${product.category}</td>
            <td>${product.status || 'available'}</td>
            <td>
                <button class="btn btn-sm" data-action="edit">Edit</button>
                <button class="btn btn-sm btn-danger" data-action="delete">Delete</button>
                <button class="btn btn-sm" data-action="sold">Mark as Sold</button>
            </td>
        `;
        productList.appendChild(row);
    });

    if (filteredProducts.length > 5) {
        showMoreBtn.style.display = 'block';
        showMoreBtn.textContent = adminProductsExpanded ? 'Show Less' : 'Show More';
    } else {
        showMoreBtn.style.display = 'none';
    }
}

function setupAdminProductSearch() {
    const searchInput = document.getElementById('product-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        renderAdminProducts(e.target.value);
    });
}

function setupShowMoreButton() {
    const showMoreBtn = document.getElementById('show-more-btn');
    if (!showMoreBtn) return;

    showMoreBtn.addEventListener('click', () => {
        adminProductsExpanded = !adminProductsExpanded;
        const searchInput = document.getElementById('product-search');
        renderAdminProducts(searchInput.value);
    });
}

async function handleAdminProductAction(action, productId, form) {
    const password = prompt('Enter admin password:');
    if (!password) return;

    if (action === 'delete') {
        const res = await fetch(`/api/admin/products/${productId}?password=${password}`, { method: 'DELETE' });
        if (res.ok) {
            await renderAdminProducts();
        } else {
            alert('Failed to delete product');
        }
    } else if (action === 'sold') {
        const res = await fetch(`/api/admin/products/${productId}/sold`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        if (res.ok) {
            await renderAdminProducts();
        } else {
            alert('Failed to mark as sold');
        }
    } else if (action === 'edit') {
        const products = await fetchProducts();
        const product = products.find(p => p.id === productId);
        if (product) {
            form.title.value = product.title;
            form.description.value = product.description;
            form.price.value = product.price;
            form.category.value = product.category;
            form.subCategory.value = product.subCategory;
            form.querySelector('button[type="submit"]').textContent = 'Update Product';
            form.dataset.editingProductId = product.id;
        }
    }
}

function setupAdminProductActions() {
    const productList = document.getElementById('product-list');
    const form = document.getElementById('admin-form');
    if (!productList || !form) return;

    productList.addEventListener('click', (e) => {
        const target = e.target;
        const action = target.dataset.action;
        const productId = target.closest('tr').dataset.productId;

        if (action && productId) {
            handleAdminProductAction(action, productId, form);
        }
    });
}


function setupCartButtons() {
    const checkoutBtn = document.getElementById('checkout-btn');
    const clearCartBtn = document.getElementById('clear-cart-btn');
    const paymentInfo = document.getElementById('payment-info');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', async () => {
            await renderCart();
            if (paymentInfo) {
                paymentInfo.hidden = false;
                paymentInfo.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', async () => {
            await clearCart();
        });
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    await injectHeaderFooterIfMissing();
    ensureWhatsAppFab();
    await renderSections();
    await renderCart();
    setupAdminForm();
    setupCartButtons();
    setupParallax();
    setupRevealObserver();
    setupSearch();
    setupSlider();
    updateFeaturedCounts();
    setupShowroomSlider();
    renderAdminProducts();
    setupAdminProductActions();
    setupAdminProductSearch();
    setupShowMoreButton();

    // Hamburger toggle for mobile nav
    const nav = document.querySelector('.nav');
    const hamburger = document.getElementById('mobile-menu-btn');
    if (nav && hamburger) {
      const toggleMenu = () => {
        nav.classList.toggle('mobile-active');
        hamburger.classList.toggle('active');
      };
      hamburger.addEventListener('click', toggleMenu);
      hamburger.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') toggleMenu(); });
      // Close menu if clicking outside on small screens
      document.addEventListener('click', (e) => {
        if (!nav.contains(e.target) && !hamburger.contains(e.target) && nav.classList.contains('mobile-active')) {
          nav.classList.remove('mobile-active');
          hamburger.classList.remove('active');
        }
      });
      // Ensure hamburger is always shown after nav click and on every resize/scroll
      document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
          nav.classList.remove('mobile-active');
          hamburger.classList.remove('active');
          hamburger.style.display = 'flex';
          hamburger.style.visibility = 'visible';
        });
      });
      window.addEventListener('resize', () => {
        hamburger.style.display = 'flex';
        hamburger.style.visibility = 'visible';
      });
      window.addEventListener('scroll', () => {
        hamburger.style.display = 'flex';
        hamburger.style.visibility = 'visible';
      });
      // Defensive: on nav menu close from outside click
      document.addEventListener('click', (e) => {
        if (!nav.contains(e.target) && !hamburger.contains(e.target)) {
          hamburger.style.display = 'flex';
          hamburger.style.visibility = 'visible';
        }
      });
    }
});

// Showroom product slider logic
async function setupShowroomSlider() {
    const track = document.getElementById('showroom-track');
    const slider = document.getElementById('showroom-slider');
    const btnPrev = document.getElementById('showroom-prev');
    const btnNext = document.getElementById('showroom-next');
    const btnToStart = document.getElementById('showroom-back-to-start');
    if (!track || !slider || !btnPrev || !btnNext || !btnToStart) return;
    track.innerHTML = '<div style="color:#94a3b8;padding:20px;">Loading...</div>';
    // Fetch showroom products
    let products = await fetchProducts('showroom');
    if (!products.length) {
        track.innerHTML = '<div style="color:#94a3b8;padding:20px;">No showroom products yet.</div>';
        return;
    }
    // Render as horizontally scrollable cards
    track.innerHTML = '';
    products.forEach(p => track.appendChild(productCard(p)));
    // Style: make cards appear in a row
    track.style.display = 'flex';
    track.style.gap = '20px';
    track.style.overflow = 'hidden';
    track.style.scrollBehavior = 'smooth';
    // Infinite slider logic
    let index = 0;
    function updateSlider() {
        const cardWidth = track.firstElementChild.offsetWidth + 20; // 20px gap
        track.style.transform = `translateX(-${index * cardWidth}px)`;
    }
    function goToStart() {
        index = 0;
        updateSlider();
    }
    function goNext() {
        if (products.length === 0) return;
        index = (index + 1) % products.length;
        updateSlider();
    }
    function goPrev() {
        if (products.length === 0) return;
        index = (index - 1 + products.length) % products.length;
        updateSlider();
    }
    btnNext.addEventListener('click', goNext);
    btnPrev.addEventListener('click', goPrev);
    btnToStart.addEventListener('click', goToStart);
    // On resize, update to avoid broken transform
    window.addEventListener('resize', updateSlider);
    // Initial setup
    setTimeout(updateSlider, 50); // wait for rendering
}

function setupParallax() {
    const layers = Array.from(document.querySelectorAll('.parallax-layer'));
    if (!layers.length) return;
    const speedFromDepth = (depth) => {
        const d = Number(depth || 0);
        return Math.min(0.6, Math.max(0.05, d));
    };
    const onScroll = () => {
        const y = window.scrollY;
        for (const layer of layers) {
            const depth = Number(layer.getAttribute('data-depth') || 0.2);
            const speed = speedFromDepth(depth);
            layer.style.transform = `translate3d(0, ${y * speed * -0.3}px, 0)`;
        }
    };
    const onMove = (e) => {
        const { innerWidth: w, innerHeight: h } = window;
        const rx = (e.clientX / w) - 0.5;
        const ry = (e.clientY / h) - 0.5;
        for (const layer of layers) {
            const depth = Number(layer.getAttribute('data-depth') || 0.2);
            const dx = rx * depth * 10;
            const dy = ry * depth * 10;
            layer.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });
    onScroll();
}

let revealObserver;
function setupRevealObserver() {
    if ('IntersectionObserver' in window) {
        revealObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    revealObserver.unobserve(entry.target);
                }
            }
        }, { threshold: 0.15 });
        document.querySelectorAll('[data-animate="reveal"]').forEach((el) => revealObserver.observe(el));
    } else {
        document.querySelectorAll('[data-animate="reveal"]').forEach((el) => el.classList.add('in-view'));
    }
}

function ensureWhatsAppFab() {
    if (document.querySelector('.whatsapp-fab')) return;
    const a = document.createElement('a');
    a.className = 'whatsapp-fab';
    a.href = 'https://wa.me/2348036122868?text=Hi%20Olatech%20Properties%20%26%20Assets%2C%20I%20need%20help.';
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Need help? Chat on WhatsApp');
    a.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5A11 11 0 006.5 3.5 10.9 10.9 0 001 12l-1 4 4-1A10.9 10.9 0 0012 23a11 11 0 008.5-19.5z" fill="currentColor" stroke="none"/><path d="M16.5 13.5c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.7.9-.1.1-.3.1-.5 0-.2-.1-.9-.3-1.7-1-.6-.5-1-1.2-1.1-1.4-.1-.2 0-.3.1-.5.1-.2.2-.3.3-.4.1-.1.1-.2.2-.3.1-.1.1-.2.2-.3 0-.1 0-.2 0-.3 0-.1-.1-.3-.2-.4-.1-.1-.5-1.2-.7-1.6-.2-.4-.4-.3-.5-.3h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.9 2.2 1 2.4c.1.2 1.8 2.8 4.3 3.9.6.2 1 .3 1.3.4.5.2 1 .2 1.4.1.4-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.2-1.2-.1-.2-.2-.2-.4-.3z" fill="#001d0e" stroke="none"/></svg><span class="label">Need help?</span>';
    document.body.appendChild(a);
}

function setupSlider() {
    const slider = document.getElementById('hero-slider');
    if (!slider) return;
    const track = slider.querySelector('.slides');
    const slides = Array.from(slider.querySelectorAll('.slide'));
    const dotsEl = slider.querySelector('[data-dots]');
    let idx = 0;
    let timer;
    const setIndex = (i) => {
        idx = (i + slides.length) % slides.length;
        track.style.transform = `translateX(-${idx * 100}%)`;
        dotsEl.querySelectorAll('.dot').forEach((d, di) => d.classList.toggle('active', di === idx));
    };
    const next = () => setIndex(idx + 1);
    const prev = () => setIndex(idx - 1);
    // dots
    slides.forEach((_s, i) => {
        const d = document.createElement('button');
        d.className = 'dot' + (i === 0 ? ' active' : '');
        d.addEventListener('click', () => setIndex(i));
        dotsEl.appendChild(d);
    });
    slider.querySelector('[data-next]').addEventListener('click', next);
    slider.querySelector('[data-prev]').addEventListener('click', prev);
    const start = () => { timer = setInterval(next, 4500); };
    const stop = () => { clearInterval(timer); };
    slider.addEventListener('mouseenter', stop);
    slider.addEventListener('mouseleave', start);
    start();
}

function triggerReveal(scope) {
    if (!revealObserver) return;
    scope.querySelectorAll('[data-animate="reveal"]').forEach((el) => revealObserver.observe(el));
}

async function injectHeaderFooterIfMissing() {
    const hasHeader = document.querySelector('.site-header');
    const hasFooter = document.querySelector('.site-footer');
    const needsHeader = !hasHeader;
    const needsFooter = !hasFooter;
    if (!needsHeader && !needsFooter) return;
    try {
        if (needsHeader) {
            const h = await fetch('/partials/header.html');
            const html = await h.text();
            const wrapper = document.createElement('div');
            wrapper.innerHTML = html.trim();
            document.body.insertBefore(wrapper.firstElementChild, document.body.firstChild);
        }
        if (needsFooter) {
            const f = await fetch('/partials/footer.html');
            const html = await f.text();
            const wrapper = document.createElement('div');
            wrapper.innerHTML = html.trim();
            document.body.appendChild(wrapper.firstElementChild);
        }
        setupSearch();
        await renderCart();
    } catch (e) {
        // ignore if offline
    }
}


let allProductsCache = [];
async function loadAllProducts() {
    const res = await fetch('/api/products');
    allProductsCache = await res.json();
    return allProductsCache;
}

function setupSearch() {
    const input = document.getElementById('search');
    if (!input) return;
    let last = '';
    const handler = async () => {
        const q = (input.value || '').trim().toLowerCase();
        if (q === last) return; last = q;
        const data = await (allProductsCache.length ? Promise.resolve(allProductsCache) : loadAllProducts());
        const categories = ['land', 'properties', 'furnitures', 'auto'];
        const grouped = { land: [], properties: [], furnitures: [], auto: [] };
        const matches = q ? data.filter(p => `${p.title} ${p.description}`.toLowerCase().includes(q)) : null;
        (matches || data).forEach(p => grouped[p.category]?.push(p));
        for (const cat of categories) {
            const grid = document.getElementById(`grid-${cat}`);
            if (!grid) continue;
            grid.innerHTML = '';
            const frag = document.createDocumentFragment();
            (grouped[cat] || []).forEach(p => frag.appendChild(productCard(p)));
            grid.appendChild(frag);
            triggerReveal(grid);
        }
    };
    input.addEventListener('input', handler);
}

async function updateFeaturedCounts() {
    const propsEl = document.getElementById('feat-properties');
    const homeEl = document.getElementById('feat-home');
    const officeEl = document.getElementById('feat-office');
    const landEl = document.getElementById('feat-land');
    const autoEl = document.getElementById('feat-auto');
    if (!propsEl && !homeEl && !officeEl && !landEl && !autoEl) return;
    try {
        const all = await fetchProducts();
        const byCat = all.reduce((acc, p) => { acc[p.category] = (acc[p.category]||0)+1; return acc; }, {});
        const furn = all.filter(p => p.category === 'furnitures');
        const home = furn.filter(p => (p.subCategory||'') === 'home').length;
        const office = furn.filter(p => (p.subCategory||'') === 'office').length;
        if (propsEl) propsEl.textContent = `${byCat['properties']||0} products`;
        if (homeEl) homeEl.textContent = `${home} products`;
        if (officeEl) officeEl.textContent = `${office} products`;
        if (landEl) landEl.textContent = `${byCat['land']||0} products`;
        if (autoEl) autoEl.textContent = `${byCat['auto']||0} products`;
    } catch {}
}

async function handleAdminFormSubmit(form, status) {
    const editingProductId = form.dataset.editingProductId;
    status.textContent = editingProductId ? 'Updating...' : 'Uploading...';
    const fd = new FormData(form);
    const imageInput = form.querySelector('input[type="file"]');
    const imageFile = imageInput.files[0];

    const data = {
        title: fd.get('title'),
        description: fd.get('description'),
        price: fd.get('price'),
        category: fd.get('category'),
        subCategory: fd.get('subCategory'),
        password: fd.get('password'),
        image: null
    };

    const sendRequest = async (body) => {
        try {
            const url = editingProductId ? `/api/admin/products/${editingProductId}` : '/api/admin/products';
            const method = editingProductId ? 'PUT' : 'POST';

            const res = await fetch(url, { 
                method: method, 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body) 
            });
            if (!res.ok) throw new Error(editingProductId ? 'Update failed' : 'Upload failed');
            status.textContent = editingProductId ? 'Updated!' : 'Uploaded!';
            form.reset();
            delete form.dataset.editingProductId;
            form.querySelector('button[type="submit"]').textContent = 'Upload';
            allProductsCache = []; // Invalidate the cache
            await renderAdminProducts();
            await renderSections();
            await updateFeaturedCounts();
        } catch (err) {
            status.textContent = 'Error: ' + err.message;
        }
    };

    if (imageFile) {
        const reader = new FileReader();
        reader.onload = () => {
            data.image = reader.result;
            sendRequest(data);
        };
        reader.readAsDataURL(imageFile);
    } else {
        sendRequest(data);
    }
}