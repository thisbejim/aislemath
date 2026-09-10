export const UNIT_DEFS = {
  g: { kind: 'mass', factor: 1, label: 'g', baseLabel: 'g' },
  kg: { kind: 'mass', factor: 1000, label: 'kg', baseLabel: 'g' },
  oz: { kind: 'mass', factor: 28.349523125, label: 'oz', baseLabel: 'g' },
  lb: { kind: 'mass', factor: 453.59237, label: 'lb', baseLabel: 'g' },
  ml: { kind: 'volume', factor: 1, label: 'ml', baseLabel: 'ml' },
  l: { kind: 'volume', factor: 1000, label: 'L', baseLabel: 'ml' },
  floz: { kind: 'volume', factor: 29.5735295625, label: 'US fl oz', baseLabel: 'ml' },
  each: { kind: 'count', factor: 1, label: 'item', baseLabel: 'item' },
};

export const EXAMPLES = {
  cereal: [
    { name: 'Family box', price: 8.99, amount: 24, unit: 'oz', buy: 1, deal: 'none' },
    { name: 'Mid-size box', price: 5.49, amount: 18, unit: 'oz', buy: 1, deal: 'none' },
    { name: 'Store brand', price: 3.99, amount: 12, unit: 'oz', buy: 1, deal: 'none' },
  ],
  paper: [
    { name: 'SoftTouch 12-roll', price: 19.99, amount: 12, unit: 'each', buy: 1, deal: 'none' },
    { name: 'Value 18-roll', price: 24.99, amount: 18, unit: 'each', buy: 1, deal: 'multi', dealQty: 2, dealPrice: 42 },
    { name: 'Everyday 6-roll', price: 11.49, amount: 6, unit: 'each', buy: 1, deal: 'none' },
  ],
  oil: [
    { name: 'Olive oil 1 L', price: 14.99, amount: 1, unit: 'l', buy: 1, deal: 'none' },
    { name: 'Olive oil 750 ml', price: 11.49, amount: 750, unit: 'ml', buy: 1, deal: 'percent', percentOff: 10 },
    { name: 'Olive oil 500 ml', price: 8.49, amount: 500, unit: 'ml', buy: 1, deal: 'none' },
  ],
};

export const DEFAULT_ITEM = {
  name: '',
  price: '',
  amount: '',
  unit: 'g',
  buy: 1,
  deal: 'none',
  dealQty: 2,
  dealPrice: '',
  bogoBuy: 1,
  bogoFree: 1,
  percentOff: 10,
  couponOff: '',
};

const DEAL_LABELS = {
  none: 'Regular price',
  multi: 'Multi-buy',
  bogo: 'Buy one, get one',
  percent: 'Percent off',
  coupon: 'Coupon per pack',
};

export function createItem(overrides = {}) {
  return { ...DEFAULT_ITEM, ...overrides, id: overrides.id ?? makeId() };
}

function makeId() {
  return `item-${Math.random().toString(36).slice(2, 9)}`;
}

export function numberValue(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Number.parseFloat(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function positiveValue(value, fallback = 0) {
  const parsed = numberValue(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

export function unitDefinition(unit) {
  return UNIT_DEFS[unit] ?? UNIT_DEFS.g;
}

export function unitKind(item) {
  return unitDefinition(item?.unit).kind;
}

export function normalizedAmount(item) {
  const amount = positiveValue(item?.amount);
  return amount * unitDefinition(item?.unit).factor;
}

export function displayBasis(itemOrKind, basis = 'auto') {
  const kind = typeof itemOrKind === 'string' ? itemOrKind : unitKind(itemOrKind);
  if (kind === 'count') return { amount: 1, label: 'item' };
  if (basis === 'per1') return { amount: 1, label: kind === 'mass' ? 'g' : 'ml' };
  return { amount: 100, label: kind === 'mass' ? '100 g' : '100 ml' };
}

export function dealDetails(item) {
  const regularPrice = positiveValue(item?.price);
  const deal = item?.deal ?? 'none';
  let effectivePackPrice = regularPrice;
  let dealLabel = DEAL_LABELS[deal] ?? DEAL_LABELS.none;
  let valid = true;

  if (deal === 'multi') {
    const quantity = Math.max(2, Math.floor(positiveValue(item?.dealQty, 2)));
    const bundlePrice = positiveValue(item?.dealPrice);
    valid = bundlePrice > 0;
    if (valid) effectivePackPrice = bundlePrice / quantity;
    dealLabel = `${quantity} for ${bundlePrice || '—'}`;
  } else if (deal === 'bogo') {
    const paid = Math.max(1, Math.floor(positiveValue(item?.bogoBuy, 1)));
    const free = Math.max(1, Math.floor(positiveValue(item?.bogoFree, 1)));
    effectivePackPrice = regularPrice * paid / (paid + free);
    dealLabel = `Buy ${paid}, get ${free} free`;
  } else if (deal === 'percent') {
    const percent = Math.min(100, Math.max(0, numberValue(item?.percentOff, 0)));
    effectivePackPrice = regularPrice * (1 - percent / 100);
    dealLabel = `${formatNumber(percent)}% off`;
  } else if (deal === 'coupon') {
    const coupon = Math.min(regularPrice, Math.max(0, numberValue(item?.couponOff, 0)));
    effectivePackPrice = regularPrice - coupon;
    dealLabel = `${formatNumber(coupon)} off each`;
  }

  if (!Number.isFinite(effectivePackPrice) || effectivePackPrice < 0) {
    effectivePackPrice = regularPrice;
    valid = false;
  }

  return {
    type: deal,
    label: dealLabel,
    regularPrice,
    effectivePackPrice,
    savingsPerPack: Math.max(0, regularPrice - effectivePackPrice),
    savingsRate: regularPrice > 0 ? Math.max(0, (regularPrice - effectivePackPrice) / regularPrice) : 0,
    valid,
  };
}

export function basketCost(item, packs = item?.buy) {
  const quantity = Math.max(0, Math.floor(positiveValue(packs, 1)));
  const regular = positiveValue(item?.price) * quantity;
  const deal = item?.deal ?? 'none';
  let total = regular;
  let bundleSize = 1;

  if (deal === 'multi') {
    bundleSize = Math.max(2, Math.floor(positiveValue(item?.dealQty, 2)));
    const bundlePrice = positiveValue(item?.dealPrice);
    if (bundlePrice > 0) {
      total = Math.floor(quantity / bundleSize) * bundlePrice + (quantity % bundleSize) * positiveValue(item?.price);
    }
  } else if (deal === 'bogo') {
    const paid = Math.max(1, Math.floor(positiveValue(item?.bogoBuy, 1)));
    const free = Math.max(1, Math.floor(positiveValue(item?.bogoFree, 1)));
    bundleSize = paid + free;
    total = Math.floor(quantity / bundleSize) * paid * positiveValue(item?.price) + (quantity % bundleSize) * positiveValue(item?.price);
  } else if (deal === 'percent') {
    total = quantity * dealDetails(item).effectivePackPrice;
  } else if (deal === 'coupon') {
    total = quantity * dealDetails(item).effectivePackPrice;
  }

  return {
    quantity,
    total,
    regular,
    savings: Math.max(0, regular - total),
    bundleSize,
  };
}

export function itemResult(item, index, basis = 'auto') {
  const kind = unitKind(item);
  const definition = unitDefinition(item?.unit);
  const amount = normalizedAmount(item);
  const price = dealDetails(item);
  const basket = basketCost(item);
  const display = displayBasis(kind, basis);
  const unitPrice = amount > 0 ? price.effectivePackPrice / amount * display.amount : 0;
  const regularUnitPrice = amount > 0 ? price.regularPrice / amount * display.amount : 0;

  return {
    item,
    index,
    name: String(item?.name ?? '').trim() || `Option ${index + 1}`,
    kind,
    unit: definition.label,
    amount,
    display,
    deal: price,
    basket,
    unitPrice,
    regularUnitPrice,
    valid: price.regularPrice > 0 && amount > 0 && price.valid,
  };
}

export function compareItems(items, basis = 'auto') {
  const results = items.map((item, index) => itemResult(item, index, basis));
  const valid = results.filter((result) => result.valid);
  const invalid = results.filter((result) => !result.valid);
  const groups = [...new Set(valid.map((result) => result.kind))].map((kind) => {
    const rows = valid.filter((result) => result.kind === kind).sort((a, b) => a.unitPrice - b.unitPrice || a.index - b.index);
    const winner = rows[0] ?? null;
    return { kind, rows, winner };
  });
  const winners = groups.filter((group) => group.winner).map((group) => group.winner);
  const allBasketTotal = valid.reduce((sum, result) => sum + result.basket.total, 0);
  const allRegularTotal = valid.reduce((sum, result) => sum + result.basket.regular, 0);
  const hasMixedKinds = groups.length > 1;
  const bestOverall = hasMixedKinds ? null : winners[0] ?? null;
  const savings = bestOverall && valid.length > 1
    ? Math.max(0, valid.slice(1).reduce((sum, result) => sum + Math.max(0, result.basket.regular - bestOverall.basket.regular), 0))
    : 0;

  return {
    results,
    valid,
    invalid,
    groups,
    winners,
    bestOverall,
    hasMixedKinds,
    allBasketTotal,
    allRegularTotal,
    basketSavings: Math.max(0, allRegularTotal - allBasketTotal),
    savings,
    ready: valid.length >= 2,
  };
}

export function formatNumber(value, maxDecimals = 2) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: maxDecimals }).format(value);
}

export function formatUnitAmount(result) {
  const definition = unitDefinition(result.item?.unit);
  const original = positiveValue(result.item?.amount);
  return `${formatNumber(original, 3)} ${definition.label}`;
}

export function serializeState(state) {
  return {
    v: 1,
    currency: state.currency,
    basis: state.basis,
    items: state.items.map((item) => {
      const copy = { ...item };
      delete copy.id;
      return copy;
    }),
  };
}

export function parseState(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 20000) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return null;
    const items = parsed.items.slice(0, 20).map((item) => createItem({
      ...DEFAULT_ITEM,
      ...item,
      name: String(item?.name ?? '').slice(0, 80),
      unit: UNIT_DEFS[item?.unit] ? item.unit : 'g',
      deal: ['none', 'multi', 'bogo', 'percent', 'coupon'].includes(item?.deal) ? item.deal : 'none',
    }));
    return {
      currency: ['AUD', 'USD', 'CAD', 'GBP', 'EUR', 'NZD', 'INR', 'JPY'].includes(parsed.currency) ? parsed.currency : 'AUD',
      basis: ['auto', 'per100', 'per1'].includes(parsed.basis) ? parsed.basis : 'auto',
      items: items.length ? items : [createItem()],
    };
  } catch {
    return null;
  }
}

export function csvEscape(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function comparisonCsv(comparison, currency) {
  const header = ['Option', 'Original size', 'Deal', 'Effective pack price', 'Unit price', 'Unit basis', 'Buy packs', 'Basket total', 'Basket savings'];
  const rows = comparison.results.filter((result) => result.valid).map((result) => [
    result.name,
    formatUnitAmount(result),
    result.deal.label,
    result.deal.effectivePackPrice.toFixed(2),
    result.unitPrice.toFixed(4),
    `per ${result.display.label}`,
    result.basket.quantity,
    result.basket.total.toFixed(2),
    result.basket.savings.toFixed(2),
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n') + `\n\nCurrency,${csvEscape(currency)}`;
}
