export const STORAGE_KEY = 'spesa-facile-lista-v1';
export const MAX_QUANTITY = 999;

export function validQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? Math.min(MAX_QUANTITY, Math.max(0, Math.trunc(quantity))) : 0;
}

export function readSavedList(storage) {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
    const lines = {};
    for (const [id, line] of Object.entries(saved.lines || {})) {
      if (!line || typeof line !== 'object') continue;
      const quantity = validQuantity(line.quantity);
      if (!quantity) continue;
      const priceCents = Number.isSafeInteger(line.priceCents) && line.priceCents >= 0 && line.priceCents <= 10000000 ? line.priceCents : null;
      lines[id] = { quantity, priceCents };
    }
    return { title: typeof saved.title === 'string' ? saved.title.slice(0, 100) : 'La mia spesa', lines };
  } catch {
    return { title: 'La mia spesa', lines: {} };
  }
}

export function selectedLines(products, savedLines) {
  return products.filter(product => validQuantity(savedLines[product.id]?.quantity) > 0).map(product => {
    const saved = savedLines[product.id];
    const priceCents = saved.priceCents ?? product.priceCents;
    return { ...product, quantity: validQuantity(saved.quantity), priceCents, customPrice: saved.priceCents != null, totalCents: priceCents == null ? null : priceCents * validQuantity(saved.quantity) };
  });
}

export function listTotals(lines) {
  return {
    count: lines.length,
    quantity: lines.reduce((total, line) => total + line.quantity, 0),
    totalCents: lines.reduce((total, line) => total + (line.totalCents ?? 0), 0),
    missing: lines.filter(line => line.priceCents == null).length
  };
}

export function groupByDepartment(lines) {
  const groups = new Map();
  for (const line of lines) {
    if (!groups.has(line.department)) groups.set(line.department, []);
    groups.get(line.department).push(line);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, 'it')).map(([name, items]) => ({
    name,
    items: items.sort((a, b) => a.name.localeCompare(b.name, 'it')),
    totalCents: items.reduce((total, line) => total + (line.totalCents ?? 0), 0)
  }));
}

export function parsePrice(input) {
  const value = String(input).trim().replace(',', '.');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents <= 10000000 ? cents : null;
}

export function money(cents) {
  return cents == null ? 'Da indicare' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function listCountLabel({ count, quantity }) {
  const products = count === 1 ? '1 prodotto' : count + ' prodotti';
  const packages = quantity === 1 ? '1 confezione' : quantity + ' confezioni';
  return products + ' · ' + packages;
}

export function searchText(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it');
}
