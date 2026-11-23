import { STORAGE_KEY, MAX_QUANTITY, readSavedList, selectedLines, listTotals, groupByDepartment, parsePrice, money, searchText, validQuantity, listCountLabel } from './core.js';
import { createShoppingPdf } from './pdf.js';

const $ = id => document.getElementById(id);
const state = { products: [], catalog: null, department: '', query: '', page: 1, sort: 'name', saved: loadSavedList() };
function loadSavedList() {
  try { return readSavedList(localStorage); }
  catch { return { title: 'La mia spesa', lines: {} }; }
}

const PAGE_SIZE = 48;
let filteredProducts = [];
let toastTimer;
let listOpener;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const dateLabel = date => new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Rome' }).format(new Date(date));

function notify(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved));
    $('save-state').textContent = 'Salvata automaticamente su questo dispositivo';
  } catch {
    $('save-state').textContent = 'Salvataggio sul dispositivo non disponibile. Scarica il PDF per conservare la lista.';
  }
}

function stepper(product, quantity) {
  const id = escapeHTML(product.id);
  const name = escapeHTML(product.name);
  return '<div class="stepper"><button data-action="minus" data-id="' + id + '" aria-label="Diminuisci ' + name + '"' + (quantity === 0 ? ' disabled' : '') + '>−</button><input type="number" min="0" max="' + MAX_QUANTITY + '" step="1" inputmode="numeric" data-quantity="' + id + '" aria-label="Quantità ' + name + '" value="' + quantity + '"><button data-action="plus" data-id="' + id + '" aria-label="Aumenta ' + name + '"' + (quantity >= MAX_QUANTITY ? ' disabled' : '') + '>+</button></div>';
}

function productCard(product) {
  const quantity = state.saved.lines[product.id]?.quantity || 0;
  const price = state.saved.lines[product.id]?.priceCents ?? product.priceCents;
  const image = /^https:\/\/spesaonline\.conad\.it\/assets\//.test(product.image || '') ? product.image : '';
  const href = /^\/p\//.test(product.url || '') ? 'https://spesaonline.conad.it' + product.url : 'https://spesaonline.conad.it/tutti-i-prodotti';
  return '<article class="product-card' + (quantity ? ' selected' : '') + '" data-product-id="' + escapeHTML(product.id) + '">' +
    (image ? '<img class="product-image" src="' + escapeHTML(image) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') +
    '<p class="product-category">' + escapeHTML(product.category || product.department) + '</p><h3><a href="' + escapeHTML(href) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(product.name) + '</a></h3>' +
    '<p class="product-format">' + escapeHTML(product.format || '1 confezione') + '</p><div class="product-price-row"><span class="product-price" data-card-price="' + escapeHTML(product.id) + '">' + money(price) + '</span><span class="price-unit">/ conf.</span></div>' +
    (product.offer ? '<p class="product-note">Promo quantità su Conad</p>' : '') +
    (product.estimated ? '<p class="product-note">Costo stimato · peso variabile</p>' : '') +
    stepper(product, quantity) + '</article>';
}

function renderCatalog() {
  const terms = searchText(state.query).trim().split(/\s+/).filter(Boolean);
  filteredProducts = state.products.filter(product =>
    (!state.department || product.department === state.department) &&
    terms.every(term => product.search.includes(term))
  );
  filteredProducts.sort((a, b) => {
    if (state.sort === 'name') return a.name.localeCompare(b.name, 'it');
    const priceA = state.saved.lines[a.id]?.priceCents ?? a.priceCents;
    const priceB = state.saved.lines[b.id]?.priceCents ?? b.priceCents;
    if (priceA == null) return priceB == null ? a.name.localeCompare(b.name, 'it') : 1;
    if (priceB == null) return -1;
    return (state.sort === 'price-asc' ? priceA - priceB : priceB - priceA) || a.name.localeCompare(b.name, 'it');
  });
  const pages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  state.page = Math.min(Math.max(1, state.page), pages);
  $('department-title').textContent = state.department || 'Tutti i prodotti';
  $('results-count').textContent = filteredProducts.length.toLocaleString('it-IT') + ' prodotti' + (state.query ? ' per “' + state.query + '”' : '');
  $('product-grid').innerHTML = filteredProducts.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE).map(productCard).join('') ||
    '<div class="no-results"><strong>Nessun prodotto trovato</strong>Prova un altro nome o scegli Tutti i reparti.</div>';
  $('pagination').hidden = pages <= 1;
  $('previous-page').disabled = state.page <= 1;
  $('next-page').disabled = state.page >= pages;
  $('page-label').textContent = state.page + ' di ' + pages;
  $('clear-search').hidden = !state.query;
  for (const button of $('department-nav').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.department === state.department));
  $('department-select').value = state.department;
}

function renderDepartments() {
  const counts = new Map();
  for (const product of state.products) counts.set(product.department, (counts.get(product.department) || 0) + 1);
  const departments = [...counts].sort(([a], [b]) => a.localeCompare(b, 'it'));
  $('department-nav').innerHTML = [['', state.products.length], ...departments].map(([name, count]) =>
    '<button class="department" data-department="' + escapeHTML(name) + '" aria-pressed="' + String(name === state.department) + '"><span>' + escapeHTML(name || 'Tutti i reparti') + '</span><small>' + count + '</small></button>'
  ).join('');
  $('department-select').innerHTML = '<option value="">Tutti i reparti (' + state.products.length + ')</option>' + departments.map(([name, count]) =>
    '<option value="' + escapeHTML(name) + '">' + escapeHTML(name) + ' (' + count + ')</option>'
  ).join('');
}

function listLine(product) {
  const id = escapeHTML(product.id);
  return '<div class="list-line"><div class="list-product-top"><p>' + escapeHTML(product.name) + '</p><button class="remove-item" data-action="remove" data-id="' + id + '" aria-label="Rimuovi ' + escapeHTML(product.name) + '">×</button></div>' +
    '<p class="format">' + escapeHTML(product.format || '1 confezione') + (product.estimated ? ' · costo stimato' : '') + '</p><div class="list-line-controls">' + stepper(product, product.quantity) +
    '<span class="line-total">' + money(product.totalCents) + '</span></div><label class="line-price-label">Prezzo unitario €<input type="text" inputmode="decimal" data-price="' + id + '" aria-label="Prezzo unitario ' + escapeHTML(product.name) + '" value="' + (product.priceCents == null ? '' : (product.priceCents / 100).toFixed(2).replace('.', ',')) + '" placeholder="Da indicare">' +
    (product.customPrice ? '<span class="custom-price">modificato</span>' : '') + '</label></div>';
}

function renderList() {
  const focused = document.activeElement;
  const focusId = focused?.dataset.id || focused?.dataset.quantity || focused?.dataset.price;
  const focusKind = focused?.dataset.action ? '[data-action="' + focused.dataset.action + '"][data-id="' + focusId + '"]' :
    focused?.dataset.quantity ? '[data-quantity="' + focusId + '"]' : focused?.dataset.price ? '[data-price="' + focusId + '"]' : null;
  const restoreFocus = $('list-lines').contains(focused);
  const lines = selectedLines(state.products, state.saved.lines);
  const totals = listTotals(lines);
  $('list-lines').innerHTML = lines.length ? groupByDepartment(lines).map(group =>
    '<section class="list-group"><h3><span>' + escapeHTML(group.name) + '</span><span>' + money(group.totalCents) + '</span></h3>' + group.items.map(listLine).join('') + '</section>'
  ).join('') : '<div class="empty-list"><span class="empty-symbol" aria-hidden="true">＋</span><strong>La spesa comincia da qui.</strong>Aggiungi i prodotti con il pulsante +.<br>Li ritroverai divisi per reparto.</div>';
  $('total-label').textContent = totals.missing ? 'Totale parziale' : 'Totale';
  for (const id of ['grand-total', 'mobile-total']) $(id).textContent = money(totals.totalCents);
  for (const id of ['header-count', 'mobile-count']) $(id).textContent = totals.count;
  $('list-count').textContent = listCountLabel(totals);
  $('missing-prices').hidden = !totals.missing;
  $('missing-prices').textContent = totals.missing + ' prodotti con prezzo da indicare, esclusi dal totale.';
  $('download-pdf').disabled = !lines.length;
  $('clear-list').disabled = !lines.length;
  if (restoreFocus && focusKind) $('list-lines').querySelector(focusKind)?.focus({ preventScroll: true });
}

function updateProduct(id) {
  const quantity = state.saved.lines[id]?.quantity || 0;
  for (const input of document.querySelectorAll('[data-quantity="' + id + '"]')) input.value = quantity;
  for (const button of document.querySelectorAll('[data-id="' + id + '"][data-action="minus"]')) button.disabled = quantity === 0;
  for (const button of document.querySelectorAll('[data-id="' + id + '"][data-action="plus"]')) button.disabled = quantity >= MAX_QUANTITY;
  document.querySelector('[data-product-id="' + id + '"]')?.classList.toggle('selected', quantity > 0);
  const product = state.products.find(item => item.id === id);
  const label = document.querySelector('[data-card-price="' + id + '"]');
  if (label) label.textContent = money(state.saved.lines[id]?.priceCents ?? product.priceCents);
}

function setQuantity(id, value) {
  if (!state.products.some(product => product.id === id)) return;
  const quantity = validQuantity(value);
  if (quantity) state.saved.lines[id] = { quantity, priceCents: state.saved.lines[id]?.priceCents ?? null };
  else delete state.saved.lines[id];
  save();
  renderList();
  updateProduct(id);
}

function setDepartment(name) {
  state.department = name;
  state.page = 1;
  renderCatalog();
}

function openList(event) {
  listOpener = event.currentTarget;
  $('shopping-list').classList.add('is-open');
  if (window.matchMedia('(max-width: 980px)').matches) {
    $('list-backdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    $('shopping-list').setAttribute('role', 'dialog');
    $('shopping-list').setAttribute('aria-modal', 'true');
    $('shopping-list').focus();
  } else {
    $('shopping-list').focus();
  }
}

function closeList() {
  $('shopping-list').classList.remove('is-open');
  $('list-backdrop').hidden = true;
  document.body.style.overflow = '';
  $('shopping-list').removeAttribute('role');
  $('shopping-list').removeAttribute('aria-modal');
  listOpener?.focus();
}

function downloadPdf() {
  try {
    const lines = selectedLines(state.products, state.saved.lines);
    const file = createShoppingPdf({ title: state.saved.title || 'La mia spesa', lines, catalogDate: state.catalog.capturedAt, context: state.catalog.context });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
    link.href = url;
    link.download = 'Lista-spesa-' + today + '.pdf';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    notify('PDF creato. Puoi salvarlo sul tuo dispositivo.');
  } catch (error) {
    notify(error.message || 'Il PDF non è stato creato. Riprova.');
  }
}

async function loadCatalog() {
  $('catalog-error').hidden = true;
  $('results-count').textContent = 'Caricamento del catalogo…';
  try {
    const response = await fetch('data/catalog.json');
    if (!response.ok) throw new Error('Catalogo non disponibile');
    const catalog = await response.json();
    if (!Array.isArray(catalog.products) || !catalog.products.length) throw new Error('Catalogo vuoto');
    state.catalog = catalog;
    state.products = catalog.products.map(product => ({ ...product, search: searchText([product.name, product.brand, product.department, product.category].join(' ')) }));
    $('catalog-date').textContent = catalog.products.length.toLocaleString('it-IT') + ' prodotti · prezzi del ' + dateLabel(catalog.capturedAt);
    $('price-description').textContent = 'Prezzi rilevati da Conad Spesa Online il ' + dateLabel(catalog.capturedAt) + ', per l’assortimento visibile nella zona di Adria. Prezzi e disponibilità possono cambiare in base al negozio e alla data.';
    renderDepartments();
    renderCatalog();
    renderList();
    const missingIds = Object.keys(state.saved.lines).filter(id => !state.products.some(product => product.id === id));
    if (missingIds.length) notify(missingIds.length + ' prodotti della lista salvata non sono presenti nel catalogo attuale.');
  } catch {
    $('catalog-error').hidden = false;
    $('results-count').textContent = 'Caricamento non riuscito';
    $('catalog-date').textContent = 'Catalogo non disponibile';
  }
}

$('list-title').value = state.saved.title;
$('list-title').addEventListener('input', event => { state.saved.title = event.target.value.slice(0, 100); save(); });
$('search').addEventListener('input', event => { state.query = event.target.value; state.page = 1; renderCatalog(); });
$('clear-search').addEventListener('click', () => { $('search').value = ''; state.query = ''; state.page = 1; renderCatalog(); $('search').focus(); });
$('sort').addEventListener('change', event => { state.sort = event.target.value; state.page = 1; renderCatalog(); });
$('department-select').addEventListener('change', event => setDepartment(event.target.value));
$('department-nav').addEventListener('click', event => { const button = event.target.closest('[data-department]'); if (button) setDepartment(button.dataset.department); });
for (const [id, offset] of [['previous-page', -1], ['next-page', 1]]) $(id).addEventListener('click', () => {
  state.page += offset;
  renderCatalog();
  $('catalogo').scrollIntoView({ block: 'start' });
  $('catalogo').focus({ preventScroll: true });
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const id = button.dataset.id;
  const current = state.saved.lines[id]?.quantity || 0;
  setQuantity(id, button.dataset.action === 'remove' ? 0 : current + (button.dataset.action === 'plus' ? 1 : -1));
});
function commitField(event) {
  const quantityId = event.target.dataset.quantity;
  if (quantityId && validQuantity(event.target.value) !== (state.saved.lines[quantityId]?.quantity || 0)) setQuantity(quantityId, event.target.value);
  const priceId = event.target.dataset.price;
  if (!priceId || !state.saved.lines[priceId]) return;
  const price = event.target.value.trim() === '' ? null : parsePrice(event.target.value);
  if (price == null && event.target.value.trim() !== '') {
    notify('Inserisci un prezzo valido, per esempio 2,49.');
    renderList();
    return;
  }
  if (price === (state.saved.lines[priceId].priceCents ?? state.products.find(product => product.id === priceId)?.priceCents)) return;
  state.saved.lines[priceId].priceCents = price;
  save();
  renderList();
  updateProduct(priceId);
  if (state.sort !== 'name') renderCatalog();
}
document.addEventListener('change', commitField);
document.addEventListener('focusout', commitField);
for (const id of ['open-list', 'mobile-open-list']) $(id).addEventListener('click', openList);
for (const id of ['close-list', 'list-backdrop']) $(id).addEventListener('click', closeList);
window.matchMedia('(max-width: 980px)').addEventListener('change', closeList);
document.addEventListener('keydown', event => {
  if (!$('shopping-list').classList.contains('is-open') || !window.matchMedia('(max-width: 980px)').matches || document.querySelector('dialog[open]')) return;
  if (event.key === 'Escape') closeList();
  if (event.key === 'Tab') {
    const controls = [...$('shopping-list').querySelectorAll('button:not(:disabled),input,a')].filter(element => element.offsetParent !== null);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === $('shopping-list'))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
$('download-pdf').addEventListener('click', downloadPdf);
$('show-prices').addEventListener('click', () => $('price-dialog').showModal());
$('close-prices').addEventListener('click', () => $('price-dialog').close());
$('clear-list').addEventListener('click', () => $('clear-dialog').showModal());
$('cancel-clear').addEventListener('click', () => $('clear-dialog').close());
$('confirm-clear').addEventListener('click', () => {
  state.saved.lines = {};
  save();
  renderList();
  renderCatalog();
  $('clear-dialog').close();
});
$('retry-load').addEventListener('click', loadCatalog);
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  state.saved = loadSavedList();
  $('list-title').value = state.saved.title;
  renderList();
  renderCatalog();
});
renderList();
loadCatalog();
