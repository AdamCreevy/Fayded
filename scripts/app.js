/* ═══════════════════════════════════════════════════════════════
   Fayded Dresses — app.js
   Filtering, sorting, and rendering logic
   ═══════════════════════════════════════════════════════════════ */

// ─── Valid height bounds: 4′5″ (135cm) – 6′5″ (196cm) ────────────
const DATA_HEIGHT_MIN = 135;
const DATA_HEIGHT_MAX = 196;

// ─── UK size extraction from the colours/variants field ──────────
function extractUkSizes(colours) {
  const result = new Set();
  for (const c of colours) {
    const ukMatch = c.match(/UK\s*(\d+)/i);
    if (ukMatch) { result.add(parseInt(ukMatch[1], 10)); continue; }
    const trimmed = c.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (n >= 4 && n <= 30 && n % 2 === 0) result.add(n);
    }
  }
  return result;
}

const dressSizeMap = new Map(dresses.map(d => [d.id, extractUkSizes(d.sizes || [])]));


const PAGE_SIZE = 100;

// ─── Exclude dresses without a height or outside the valid range ──
const activeDresses = dresses.filter(d =>
  d.modelHeight != null &&
  d.modelHeight >= DATA_HEIGHT_MIN &&
  d.modelHeight <= DATA_HEIGHT_MAX
);

// ─── Price range derived from data ────────────────────────────────
const validPrices = activeDresses.map(d => d.price).filter(p => p != null && p > 0);
const DATA_PRICE_MIN = Math.floor(Math.min(...validPrices));
const DATA_PRICE_MAX = Math.ceil(Math.max(...validPrices));

// ─── Non-linear price steps for the slider ────────────────────────
const PRICE_POINTS = [
  10, 15, 20, 25, 30, 35, 40, 45, 50,
  60, 70, 80, 90, 100,
  120, 140, 160, 180, 200,
  250, 300, 350, 400, 450, 500,
  600, 700, 800, 900, 1000
];

// ─── State ────────────────────────────────────────────────────────
const state = {
  minHeight: DATA_HEIGHT_MIN,
  maxHeight: DATA_HEIGHT_MAX,
  minPrice:  0,
  maxPrice:  PRICE_POINTS[PRICE_POINTS.length - 1],
  retailer:  'all',
  dressType: 'all',
  sizes:     new Set(),
  saleOnly:  false,
  sort:      'default',
  unit:      'ft',
  query:     '',
  page:      1,
};

// ─── DOM refs ─────────────────────────────────────────────────────
const heightMinInput    = document.getElementById('heightMin');
const heightMaxInput    = document.getElementById('heightMax');
const heightMinLabel    = document.getElementById('heightMinLabel');
const heightMaxLabel    = document.getElementById('heightMaxLabel');
const heightFtLabel     = document.getElementById('heightFtLabel');
const sliderExtremeMin  = document.getElementById('sliderExtremeMin');
const sliderExtremeMax  = document.getElementById('sliderExtremeMax');
const rangeFill         = document.getElementById('rangeFill');
const unitToggle        = document.getElementById('unitToggle');
const priceMinInput     = document.getElementById('priceMin');
const priceMaxInput     = document.getElementById('priceMax');
const priceLabel        = document.getElementById('priceLabel');
const priceFill         = document.getElementById('priceFill');
const salePills         = document.getElementById('salePills');
const retailerPills     = document.getElementById('retailerPills');
const typePills         = document.getElementById('typePills');
const sizePills         = document.getElementById('sizePills');
const sortSelect        = document.getElementById('sortSelect');
const resultCount       = document.getElementById('resultCount');
const dressGrid         = document.getElementById('dressGrid');
const emptyState        = document.getElementById('emptyState');
const searchInput       = document.getElementById('searchInput');
const searchClear       = document.getElementById('searchClear');
const pagination        = document.getElementById('pagination');
const pagePrev          = document.getElementById('pagePrev');
const pageNext          = document.getElementById('pageNext');
const pageInfo          = document.getElementById('pageInfo');
const filterSidebar     = document.getElementById('filterSidebar');
const filterToggleBar   = document.getElementById('filterToggleBar');
const filterActiveBadge = document.getElementById('filterActiveBadge');

// ─── Initialise height slider bounds from data ────────────────────
heightMinInput.min   = DATA_HEIGHT_MIN;
heightMinInput.max   = DATA_HEIGHT_MAX;
heightMinInput.value = DATA_HEIGHT_MIN;
heightMaxInput.min   = DATA_HEIGHT_MIN;
heightMaxInput.max   = DATA_HEIGHT_MAX;
heightMaxInput.value = DATA_HEIGHT_MAX;

// ─── Initialise price slider ──────────────────────────────────────
priceMinInput.min   = 0;
priceMinInput.max   = PRICE_POINTS.length - 1;
priceMinInput.value = 0;
priceMaxInput.min   = 0;
priceMaxInput.max   = PRICE_POINTS.length - 1;
priceMaxInput.value = PRICE_POINTS.length - 1;

// ─── Utilities ────────────────────────────────────────────────────
function cmToFtIn(cm) {
  const totalInches = cm / 2.54;
  const feet        = Math.floor(totalInches / 12);
  const inches      = Math.round(totalInches % 12);
  return `${feet}′${inches}″`;
}

function formatPrice(price) {
  return price == null ? 'Price unavailable' : `£${price.toFixed(2)}`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

// ─── Slider fill track ────────────────────────────────────────────
function updateSliderFill() {
  const range  = DATA_HEIGHT_MAX - DATA_HEIGHT_MIN;
  const minPct = ((state.minHeight - DATA_HEIGHT_MIN) / range) * 100;
  const maxPct = ((state.maxHeight - DATA_HEIGHT_MIN) / range) * 100;
  rangeFill.style.left  = `${minPct}%`;
  rangeFill.style.width = `${maxPct - minPct}%`;
}

function updatePriceFill() {
  const last   = PRICE_POINTS.length - 1;
  const minPct = (parseInt(priceMinInput.value, 10) / last) * 100;
  const maxPct = (parseInt(priceMaxInput.value, 10) / last) * 100;
  priceFill.style.left  = `${minPct}%`;
  priceFill.style.width = `${maxPct - minPct}%`;
}

function updatePriceLabels() {
  const isFullRange = parseInt(priceMinInput.value, 10) === 0 &&
                      parseInt(priceMaxInput.value, 10) === PRICE_POINTS.length - 1;
  if (isFullRange) {
    priceLabel.textContent = 'Any price';
  } else {
    priceLabel.textContent = `£${state.minPrice} – £${state.maxPrice}`;
  }
}

// ─── Slider labels ────────────────────────────────────────────────
function updateHeightLabels() {
  const isCm        = state.unit === 'cm';
  const isFullRange = state.minHeight === DATA_HEIGHT_MIN && state.maxHeight === DATA_HEIGHT_MAX;

  if (isCm) {
    heightMinLabel.textContent = `${state.minHeight}cm`;
    heightMaxLabel.textContent = `${state.maxHeight}cm`;
    heightFtLabel.textContent  = isFullRange
      ? ' (any)'
      : ` (${cmToFtIn(state.minHeight)} – ${cmToFtIn(state.maxHeight)})`;
    sliderExtremeMin.textContent = `${DATA_HEIGHT_MIN}cm`;
    sliderExtremeMax.textContent = `${DATA_HEIGHT_MAX}cm`;
  } else {
    heightMinLabel.textContent = cmToFtIn(state.minHeight);
    heightMaxLabel.textContent = cmToFtIn(state.maxHeight);
    heightFtLabel.textContent  = isFullRange
      ? ' (any)'
      : ` (${state.minHeight}cm – ${state.maxHeight}cm)`;
    sliderExtremeMin.textContent = cmToFtIn(DATA_HEIGHT_MIN);
    sliderExtremeMax.textContent = cmToFtIn(DATA_HEIGHT_MAX);
  }
}

// ─── Filter + sort ────────────────────────────────────────────────
function getFilteredSorted() {
  const q            = state.query.toLowerCase().trim();
  const selectedSizes = [...state.sizes];

  let items = activeDresses.filter(d => {
    const inHeightRange = d.modelHeight >= state.minHeight && d.modelHeight <= state.maxHeight;
    const inPriceRange  = d.price == null || (d.price >= state.minPrice && d.price <= state.maxPrice);
    const inRetailer    = state.retailer  === 'all' || d.retailer  === state.retailer;
    const inType        = state.dressType === 'all' || d.dressType === state.dressType;
    const inSearch      = !q || d.name.toLowerCase().includes(q) || d.retailer.toLowerCase().includes(q);
    const inSize        = selectedSizes.length === 0 ||
                          selectedSizes.some(s => (dressSizeMap.get(d.id) || new Set()).has(s));
    const inSale        = !state.saleOnly || d.originalPrice != null;
    return inHeightRange && inPriceRange && inRetailer && inType && inSearch && inSize && inSale;
  });

  switch (state.sort) {
    case 'price-asc':   items.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));  break;
    case 'price-desc':  items.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)); break;
    case 'height-asc':  items.sort((a, b) => a.modelHeight - b.modelHeight);  break;
    case 'height-desc': items.sort((a, b) => b.modelHeight - a.modelHeight);  break;
  }

  return items;
}

// ─── Card template ────────────────────────────────────────────────
function cardHTML(d) {
  const name     = escapeHtml(d.name);
  const retailer = escapeHtml(d.retailer);
  const ftIn     = cmToFtIn(d.modelHeight);
  const imgSrc   = escapeHtml(d.imageUrl);
  const url      = escapeHtml(d.productUrl);
  const fallback = `https://picsum.photos/seed/fallback${d.id}/600/800`;

  const onSale = d.originalPrice != null;
  const priceHtml = onSale
    ? `<p class="card-price"><span class="card-price-original">${formatPrice(d.originalPrice)}</span><span class="card-price-sale">${formatPrice(d.price)}</span></p>`
    : `<p class="card-price">${formatPrice(d.price)}</p>`;
  const priceAriaLabel = onSale
    ? `${formatPrice(d.price)}, was ${formatPrice(d.originalPrice)}`
    : formatPrice(d.price);

  return `
    <article class="dress-card">
      <a class="card-link"
         href="${url}"
         target="_blank"
         rel="noopener noreferrer"
         aria-label="${name} — ${retailer} — ${priceAriaLabel} — model height ${d.modelHeight}cm">
        <div class="card-image-wrap">
          <img class="card-img"
               src="${imgSrc}"
               alt="${name}"
               loading="lazy"
               onerror="this.onerror=null;this.src='${fallback}'">
          <div class="card-retailer" aria-hidden="true">${retailer}</div>
          <div class="card-height" aria-hidden="true">
            <span class="card-height-cm">${d.modelHeight}cm</span>
            <span class="card-height-ft">${ftIn}</span>
          </div>
          <div class="card-cta" aria-hidden="true">Shop at ${retailer} &rarr;</div>
        </div>
        <div class="card-info">
          <h3 class="card-name">${name}</h3>
          ${priceHtml}
        </div>
      </a>
    </article>
  `;
}

// ─── Render ───────────────────────────────────────────────────────
function render() {
  const items      = getFilteredSorted();
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1)          state.page = 1;

  resultCount.textContent = items.length;

  if (items.length === 0) {
    dressGrid.innerHTML = '';
    emptyState.hidden   = false;
    pagination.hidden   = true;
    return;
  }

  const start     = (state.page - 1) * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  emptyState.hidden   = true;
  dressGrid.innerHTML = pageItems.map(cardHTML).join('');

  if (totalPages <= 1) {
    pagination.hidden = true;
  } else {
    pagination.hidden        = false;
    pageInfo.textContent     = `Page ${state.page} of ${totalPages}`;
    pagePrev.disabled        = state.page === 1;
    pageNext.disabled        = state.page === totalPages;
  }
}

// ─── Active filter count (for mobile badge) ───────────────────────
function getActiveFilterCount() {
  let n = 0;
  if (state.minHeight !== DATA_HEIGHT_MIN || state.maxHeight !== DATA_HEIGHT_MAX) n++;
  if (parseInt(priceMinInput.value, 10) !== 0 || parseInt(priceMaxInput.value, 10) !== PRICE_POINTS.length - 1) n++;
  if (state.saleOnly)            n++;
  if (state.retailer  !== 'all') n++;
  if (state.dressType !== 'all') n++;
  if (state.sizes.size > 0)      n++;
  if (state.query)               n++;
  return n;
}

function updateFilterBadge() {
  const n = getActiveFilterCount();
  filterActiveBadge.hidden      = n === 0;
  filterActiveBadge.textContent = n;
}

// ─── Apply all state changes ──────────────────────────────────────
let renderTimer = null;

function applyFilters() {
  state.page = 1;
  // Immediate: cheap label/badge updates so controls feel responsive
  updateHeightLabels();
  updateSliderFill();
  updatePriceLabels();
  updatePriceFill();
  updateFilterBadge();
  // Dim grid to signal a pending update
  dressGrid.classList.add('is-loading');
  // Debounce the expensive DOM update — rapid switching skips renders
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    dressGrid.classList.remove('is-loading');
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 80);
}

// ─── Mobile filter panel toggle ──────────────────────────────────
const filterSidebarContent = document.getElementById('filterSidebarContent');
let savedScrollY = 0;

function openFilterPanel() {
  const panelTop = filterToggleBar.getBoundingClientRect().bottom;
  filterSidebarContent.style.top = `${panelTop}px`;
  savedScrollY = window.scrollY;
  document.body.style.top = `-${savedScrollY}px`;
  document.body.classList.add('filter-open');
  filterSidebar.classList.add('is-open');
  filterToggleBar.setAttribute('aria-expanded', 'true');
}

function closeFilterPanel() {
  filterSidebar.classList.remove('is-open');
  filterToggleBar.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('filter-open');
  document.body.style.top = '';
  window.scrollTo(0, savedScrollY);
}

filterToggleBar.addEventListener('click', () => {
  filterSidebar.classList.contains('is-open') ? closeFilterPanel() : openFilterPanel();
});

document.addEventListener('click', e => {
  if (filterSidebar.classList.contains('is-open') && !filterSidebar.contains(e.target)) {
    closeFilterPanel();
  }
});

// ─── Height slider events ─────────────────────────────────────────
const SLIDER_MIN_GAP = 2;

heightMinInput.addEventListener('input', () => {
  let val = Math.round(parseFloat(heightMinInput.value));
  if (val > state.maxHeight - SLIDER_MIN_GAP) {
    val = state.maxHeight - SLIDER_MIN_GAP;
    heightMinInput.value = val;
  }
  state.minHeight = val;
  applyFilters();
});

heightMaxInput.addEventListener('input', () => {
  let val = Math.round(parseFloat(heightMaxInput.value));
  if (val < state.minHeight + SLIDER_MIN_GAP) {
    val = state.minHeight + SLIDER_MIN_GAP;
    heightMaxInput.value = val;
  }
  state.maxHeight = val;
  applyFilters();
});

// ─── Price slider events ──────────────────────────────────────────
const PRICE_SLIDER_MIN_GAP = 1;

priceMinInput.addEventListener('input', () => {
  let idx = parseInt(priceMinInput.value, 10);
  const maxIdx = parseInt(priceMaxInput.value, 10);
  if (idx > maxIdx - PRICE_SLIDER_MIN_GAP) {
    idx = maxIdx - PRICE_SLIDER_MIN_GAP;
    priceMinInput.value = idx;
  }
  state.minPrice = idx === 0 ? 0 : PRICE_POINTS[idx];
  applyFilters();
});

priceMaxInput.addEventListener('input', () => {
  let idx = parseInt(priceMaxInput.value, 10);
  const minIdx = parseInt(priceMinInput.value, 10);
  if (idx < minIdx + PRICE_SLIDER_MIN_GAP) {
    idx = minIdx + PRICE_SLIDER_MIN_GAP;
    priceMaxInput.value = idx;
  }
  state.maxPrice = PRICE_POINTS[idx];
  applyFilters();
});

// ─── Unit toggle ──────────────────────────────────────────────────
unitToggle.addEventListener('click', e => {
  const btn = e.target.closest('.unit-btn');
  if (!btn) return;

  state.unit = btn.dataset.unit;

  unitToggle.querySelectorAll('.unit-btn').forEach(b => {
    b.classList.toggle('unit-btn--active', b.dataset.unit === state.unit);
  });

  document.body.classList.toggle('unit-ft', state.unit === 'ft');

  const step = state.unit === 'ft' ? '2.54' : '1';
  heightMinInput.step = step;
  heightMaxInput.step = step;

  updateHeightLabels();
});

// ─── Sale pills ───────────────────────────────────────────────────
salePills.addEventListener('click', e => {
  const pill = e.target.closest('.pill');
  if (!pill) return;

  salePills.querySelectorAll('.pill').forEach(p => {
    p.classList.remove('pill--active');
    p.removeAttribute('aria-pressed');
  });
  pill.classList.add('pill--active');
  pill.setAttribute('aria-pressed', 'true');

  state.saleOnly = pill.dataset.sale === 'sale';
  applyFilters();
});

// ─── Retailer pills ───────────────────────────────────────────────
retailerPills.addEventListener('click', e => {
  const pill = e.target.closest('.pill');
  if (!pill) return;

  retailerPills.querySelectorAll('.pill').forEach(p => {
    p.classList.remove('pill--active');
    p.removeAttribute('aria-pressed');
  });
  pill.classList.add('pill--active');
  pill.setAttribute('aria-pressed', 'true');

  state.retailer = pill.dataset.retailer;
  applyFilters();
});

// ─── Dress type pills ─────────────────────────────────────────────
typePills.addEventListener('click', e => {
  const pill = e.target.closest('.pill');
  if (!pill) return;

  typePills.querySelectorAll('.pill').forEach(p => {
    p.classList.remove('pill--active');
    p.removeAttribute('aria-pressed');
  });
  pill.classList.add('pill--active');
  pill.setAttribute('aria-pressed', 'true');

  state.dressType = pill.dataset.type;
  applyFilters();
});

// ─── Size pills (multi-select) ────────────────────────────────────
sizePills.addEventListener('click', e => {
  const pill = e.target.closest('.pill');
  if (!pill) return;

  const sizeVal = pill.dataset.size;
  const allPill = sizePills.querySelector('[data-size="all"]');

  if (sizeVal === 'all') {
    state.sizes.clear();
    sizePills.querySelectorAll('.pill').forEach(p => {
      p.classList.remove('pill--active');
      p.removeAttribute('aria-pressed');
    });
    allPill.classList.add('pill--active');
  } else {
    allPill.classList.remove('pill--active');
    allPill.removeAttribute('aria-pressed');
    const n = parseInt(sizeVal, 10);
    if (state.sizes.has(n)) {
      state.sizes.delete(n);
      pill.classList.remove('pill--active');
      pill.removeAttribute('aria-pressed');
      if (state.sizes.size === 0) {
        allPill.classList.add('pill--active');
      }
    } else {
      state.sizes.add(n);
      pill.classList.add('pill--active');
      pill.setAttribute('aria-pressed', 'true');
    }
  }

  applyFilters();
});

// ─── Search ───────────────────────────────────────────────────────
let searchDebounce = null;

searchInput.addEventListener('input', () => {
  const val = searchInput.value;
  searchClear.classList.toggle('visible', val.length > 0);
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.query = val;
    applyFilters();
  }, 180);
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.classList.remove('visible');
  state.query = '';
  applyFilters();
  searchInput.focus();
});

// ─── Sort ─────────────────────────────────────────────────────────
sortSelect.addEventListener('change', e => {
  state.sort = e.target.value;
  applyFilters();
});

// ─── Pagination ───────────────────────────────────────────────────
pagePrev.addEventListener('click', () => {
  if (state.page > 1) {
    state.page--;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

pageNext.addEventListener('click', () => {
  const totalPages = Math.ceil(getFilteredSorted().length / PAGE_SIZE);
  if (state.page < totalPages) {
    state.page++;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

// ─── Reset ────────────────────────────────────────────────────────
function resetFilters() {
  state.minHeight = DATA_HEIGHT_MIN;
  state.maxHeight = DATA_HEIGHT_MAX;
  state.minPrice  = 0;
  state.maxPrice  = PRICE_POINTS[PRICE_POINTS.length - 1];
  state.saleOnly  = false;
  state.retailer  = 'all';
  state.dressType = 'all';
  state.sizes     = new Set();
  state.sort      = 'default';
  state.unit      = 'ft';
  state.query     = '';
  state.page      = 1;

  heightMinInput.value = DATA_HEIGHT_MIN;
  heightMaxInput.value = DATA_HEIGHT_MAX;
  heightMinInput.step  = '2.54';
  heightMaxInput.step  = '2.54';
  priceMinInput.value  = 0;
  priceMaxInput.value  = PRICE_POINTS.length - 1;
  sortSelect.value     = 'default';
  searchInput.value    = '';
  searchClear.classList.remove('visible');

  document.body.classList.add('unit-ft');
  unitToggle.querySelectorAll('.unit-btn').forEach(b => {
    b.classList.toggle('unit-btn--active', b.dataset.unit === 'ft');
  });

  [salePills, retailerPills, typePills, sizePills].forEach(group => {
    group.querySelectorAll('.pill').forEach(p => {
      p.classList.remove('pill--active');
      p.removeAttribute('aria-pressed');
    });
    const allPill = group.querySelector('[data-sale="all"], [data-retailer="all"], [data-type="all"], [data-size="all"]');
    if (allPill) {
      allPill.classList.add('pill--active');
      allPill.setAttribute('aria-pressed', 'true');
    }
  });

  applyFilters();
}

// ─── Mobile swipe-up to close filter panel ───────────────────────
let touchStartY = 0;

filterSidebar.addEventListener('touchstart', e => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

filterSidebar.addEventListener('touchend', e => {
  const delta = e.changedTouches[0].clientY - touchStartY;
  if (delta < -40 && filterSidebar.classList.contains('is-open')) {
    closeFilterPanel();
  }
}, { passive: true });

// ─── Init ─────────────────────────────────────────────────────────
document.body.classList.add('unit-ft');
heightMinInput.step = '2.54';
heightMaxInput.step = '2.54';
applyFilters();
