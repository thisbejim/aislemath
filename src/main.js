import './style.css';
import {
  UNIT_DEFS,
  EXAMPLES,
  compareItems,
  comparisonCsv,
  createItem,
  formatNumber,
  formatUnitAmount,
  parseState,
  serializeState,
} from './model.js';

window.__consoleErrors = [];
window.addEventListener('error', (event) => window.__consoleErrors.push(String(event.error?.message || event.message || 'Unknown error')));
window.addEventListener('unhandledrejection', (event) => window.__consoleErrors.push(String(event.reason?.message || event.reason || 'Unhandled promise rejection')));

const STORAGE_KEY = 'aislemath-state-v1';
const CURRENCY_SYMBOLS = { AUD: 'A$', USD: '$', CAD: 'C$', GBP: '£', EUR: '€', NZD: 'NZ$', INR: '₹', JPY: '¥' };
const KIND_LABELS = { mass: 'weight', volume: 'volume', count: 'count' };

const refs = {
  items: document.querySelector('#items'),
  itemCount: document.querySelector('#item-count'),
  formStatus: document.querySelector('#form-status'),
  currency: document.querySelector('#currency'),
  basis: document.querySelector('#basis'),
  resultKind: document.querySelector('#result-kind'),
  resultSummary: document.querySelector('#result-summary'),
  comparisonWrap: document.querySelector('#comparison-wrap'),
  comparisonNote: document.querySelector('#comparison-note'),
  comparisonBody: document.querySelector('#comparison-body'),
  insight: document.querySelector('#insight'),
  copyResult: document.querySelector('#copy-result'),
  shareResult: document.querySelector('#share-result'),
  downloadCsv: document.querySelector('#download-csv'),
  printResult: document.querySelector('#print-result'),
  addItem: document.querySelector('#add-item'),
  clearItems: document.querySelector('#clear-items'),
  toast: document.querySelector('#toast'),
};

let state = loadInitialState();
let latestComparison = compareItems(state.items, state.basis);
let toastTimer;

refs.currency.value = state.currency;
refs.basis.value = state.basis;

renderItems();
renderResults();

document.querySelectorAll('[data-example]').forEach((button) => {
  button.addEventListener('click', () => {
    const example = EXAMPLES[button.dataset.example];
    if (!example) return;
    state.items = example.map((item) => createItem(item));
    persistState();
    renderItems();
    renderResults();
    showToast(`${button.textContent.trim()} loaded — edit any value to make it yours.`);
    document.querySelector('#items')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
});

refs.currency.addEventListener('change', () => {
  state.currency = refs.currency.value;
  persistState();
  renderResults();
});

refs.basis.addEventListener('change', () => {
  state.basis = refs.basis.value;
  persistState();
  renderResults();
});

refs.items.addEventListener('input', handleItemFieldEvent);
refs.items.addEventListener('change', handleItemFieldEvent);

refs.addItem.addEventListener('click', () => {
  state.items.push(createItem());
  persistState();
  renderItems();
  renderResults();
  const lastName = refs.items.querySelector(`[data-index="${state.items.length - 1}"][data-field="name"]`);
  lastName?.focus();
});

refs.clearItems.addEventListener('click', () => {
  state.items = [createItem()];
  persistState();
  renderItems();
  renderResults();
  showToast('Comparison cleared.');
});

refs.copyResult.addEventListener('click', async () => {
  if (!latestComparison.ready) return;
  await copyText(buildSummaryText(latestComparison));
  showToast('Summary copied to your clipboard.');
});

refs.shareResult.addEventListener('click', async () => {
  const encoded = encodeState(serializeState(state));
  const url = `${window.location.href.split('#')[0]}#s=${encoded}`;
  history.replaceState(null, '', `#s=${encoded}`);
  await copyText(url);
  showToast('Share link copied. It contains only this comparison.');
});

refs.downloadCsv.addEventListener('click', () => {
  if (!latestComparison.ready) return;
  const csv = comparisonCsv(latestComparison, state.currency);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'aislemath-comparison.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast('CSV downloaded.');
});

refs.printResult.addEventListener('click', () => window.print());

function handleItemFieldEvent(event) {
  const field = event.target.closest('[data-field]');
  if (!field) return;
  const index = Number(field.dataset.index);
  const key = field.dataset.field;
  if (!Number.isInteger(index) || !state.items[index] || !(key in state.items[index])) return;
  state.items[index][key] = field.value;
  persistState();
  if (event.type === 'change' && key === 'deal') {
    renderItems();
    const replacement = refs.items.querySelector(`[data-index="${index}"][data-field="${key}"]`);
    replacement?.focus();
  }
  renderResults();
}

function loadInitialState() {
  const shared = readSharedState();
  if (shared) return shared;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? parseState(saved) : null;
    if (parsed) return parsed;
  } catch {
    // Private browsing can disable storage. The tool remains fully usable.
  }
  return { currency: 'AUD', basis: 'auto', items: [createItem()] };
}

function readSharedState() {
  const hash = window.location.hash;
  if (!hash.startsWith('#s=')) return null;
  const parsed = parseState(decodeState(hash.slice(3)));
  return parsed;
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState(state)));
  } catch {
    // Keep typing and calculating even when storage is unavailable.
  }
}

function renderItems() {
  refs.items.replaceChildren();
  state.items.forEach((item, index) => {
    const row = document.createElement('article');
    row.className = 'item-row';
    row.dataset.index = String(index);

    const topline = document.createElement('div');
    topline.className = 'item-topline';
    const number = document.createElement('span');
    number.className = 'item-number';
    number.dataset.number = String(index + 1).padStart(2, '0');
    number.textContent = item.name?.trim() ? item.name.trim() : `Option ${index + 1}`;
    topline.append(number);

    const remove = document.createElement('button');
    remove.className = 'remove-item';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove option ${index + 1}`);
    remove.addEventListener('click', () => {
      if (state.items.length === 1) {
        state.items = [createItem()];
        showToast('The last row was reset.');
      } else {
        state.items.splice(index, 1);
        showToast('Option removed.');
      }
      persistState();
      renderItems();
      renderResults();
    });
    topline.append(remove);
    row.append(topline);

    const fields = document.createElement('div');
    fields.className = 'item-fields';
    fields.append(
      makeField('Item name', 'name', item.name, { type: 'text', placeholder: 'e.g. Family cereal', className: 'name-field', index }),
      makeField('Price per pack', 'price', item.price, { type: 'number', prefix: CURRENCY_SYMBOLS[state.currency], min: '0', step: '0.01', placeholder: '0.00', index }),
      makeField('Package size', 'amount', item.amount, { type: 'number', min: '0', step: '0.001', placeholder: 'e.g. 500', index }),
      makeUnitField(item.unit, index),
      makeField('Buy packs', 'buy', item.buy, { type: 'number', min: '1', step: '1', placeholder: '1', className: 'buy-field', index }),
    );
    row.append(fields);
    row.append(makeDealRow(item, index));
    refs.items.append(row);
  });
  updateItemCount();
}

function makeField(labelText, key, value, options = {}) {
  const wrapper = document.createElement('label');
  wrapper.className = `field ${options.className || ''}`.trim();
  const label = document.createElement('span');
  label.textContent = labelText;
  wrapper.append(label);

  const controlWrap = document.createElement('span');
  controlWrap.className = 'control-wrap';
  if (options.prefix) {
    const prefix = document.createElement('span');
    prefix.className = 'input-prefix';
    prefix.textContent = options.prefix;
    controlWrap.append(prefix);
  }

  const input = document.createElement('input');
  input.type = options.type || 'text';
  input.value = value ?? '';
  input.dataset.field = key;
  input.dataset.index = String(options.index ?? 0);
  input.placeholder = options.placeholder || '';
  if (options.min !== undefined) input.min = options.min;
  if (options.step !== undefined) input.step = options.step;
  input.setAttribute('aria-label', `${labelText}, option ${(options.index ?? 0) + 1}`);
  controlWrap.append(input);
  wrapper.append(controlWrap);
  return wrapper;
}

function makeUnitField(unit, index) {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  const label = document.createElement('span');
  label.textContent = 'Unit';
  wrapper.append(label);
  const select = document.createElement('select');
  select.dataset.field = 'unit';
  select.dataset.index = String(index);
  select.setAttribute('aria-label', `Unit, option ${index + 1}`);
  const groups = [
    ['Weight', ['g', 'kg', 'oz', 'lb']],
    ['Volume', ['ml', 'l', 'floz']],
    ['Count', ['each']],
  ];
  groups.forEach(([groupName, keys]) => {
    const group = document.createElement('optgroup');
    group.label = groupName;
    keys.forEach((key) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = UNIT_DEFS[key].label;
      option.selected = key === unit;
      group.append(option);
    });
    select.append(group);
  });
  wrapper.append(select);
  return wrapper;
}

function makeDealRow(item, index) {
  const row = document.createElement('div');
  row.className = `deal-row ${item.deal === 'none' ? 'is-simple' : ''}`;
  const dealField = document.createElement('label');
  dealField.className = 'deal-field';
  const dealLabel = document.createElement('span');
  dealLabel.textContent = 'Promotion (optional)';
  dealField.append(dealLabel);
  const dealSelect = document.createElement('select');
  dealSelect.dataset.field = 'deal';
  dealSelect.dataset.index = String(index);
  dealSelect.setAttribute('aria-label', `Promotion, option ${index + 1}`);
  [['none', 'No promotion'], ['multi', 'Multi-buy (e.g. 2 for $5)'], ['bogo', 'Buy one, get one'], ['percent', 'Percent off'], ['coupon', 'Coupon off each pack']].forEach(([value, text]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    option.selected = item.deal === value;
    dealSelect.append(option);
  });
  dealField.append(dealSelect);
  row.append(dealField);

  if (item.deal === 'multi') {
    row.append(makeDealInput('Packs in deal', 'dealQty', item.dealQty, index, '2', '1'));
    row.append(makeDealInput('Deal price', 'dealPrice', item.dealPrice, index, 'e.g. 5.00', '0.01', CURRENCY_SYMBOLS[state.currency]));
    row.append(makeHelp('The total price for the bundle. Example: 2 for $5.'));
  } else if (item.deal === 'bogo') {
    row.append(makeDealInput('Pay for', 'bogoBuy', item.bogoBuy, index, '1', '1'));
    row.append(makeDealInput('Get free', 'bogoFree', item.bogoFree, index, '1', '1'));
    row.append(makeHelp('The average pack price includes the free packs.'));
  } else if (item.deal === 'percent') {
    row.append(makeDealInput('Discount', 'percentOff', item.percentOff, index, '10', '0.1', '%'));
    row.append(makeHelp('Applies to every pack in the basket.'));
  } else if (item.deal === 'coupon') {
    row.append(makeDealInput('Coupon off each', 'couponOff', item.couponOff, index, 'e.g. 1.00', '0.01', CURRENCY_SYMBOLS[state.currency]));
    row.append(makeHelp('Enter the saving on one pack, not the final price.'));
  } else {
    row.append(makeHelp('Add a promotion to see the real shelf deal.'));
  }
  return row;
}

function makeDealInput(labelText, key, value, index, placeholder, step, prefix = '') {
  const field = document.createElement('label');
  field.className = 'deal-field';
  const label = document.createElement('span');
  label.textContent = labelText;
  field.append(label);
  const wrap = document.createElement('span');
  wrap.className = 'control-wrap';
  if (prefix) {
    const prefixNode = document.createElement('span');
    prefixNode.className = 'input-prefix';
    prefixNode.textContent = prefix;
    wrap.append(prefixNode);
  }
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = step;
  input.placeholder = placeholder;
  input.value = value ?? '';
  input.dataset.field = key;
  input.dataset.index = String(index);
  input.setAttribute('aria-label', `${labelText}, option ${index + 1}`);
  wrap.append(input);
  field.append(wrap);
  return field;
}

function makeHelp(text) {
  const help = document.createElement('p');
  help.className = 'deal-help';
  help.textContent = text;
  return help;
}

function updateItemCount() {
  const count = state.items.length;
  refs.itemCount.textContent = `${count} ${count === 1 ? 'option' : 'options'}`;
}

function renderResults() {
  latestComparison = compareItems(state.items, state.basis);
  const comparison = latestComparison;
  const validCount = comparison.valid.length;
  refs.resultKind.classList.toggle('is-ready', comparison.ready);
  refs.resultKind.textContent = comparison.ready ? `${validCount} options compared` : validCount ? 'Add one more valid option' : 'Waiting for prices';
  refs.comparisonWrap.classList.toggle('is-hidden', !comparison.ready);
  refs.insight.classList.toggle('is-hidden', !comparison.ready && comparison.invalid.length === 0);
  refs.copyResult.disabled = !comparison.ready;
  refs.downloadCsv.disabled = !comparison.ready;
  renderSummary(comparison);
  if (comparison.ready) {
    renderTable(comparison);
    renderInsight(comparison);
  } else {
    refs.comparisonBody.replaceChildren();
    refs.insight.replaceChildren();
    refs.insight.classList.toggle('is-hidden', comparison.invalid.length === 0);
    if (comparison.invalid.length) {
      refs.insight.append(textNode('Complete a positive price and package size for each option you want to compare.'));
    }
  }
  updateFormStatus(comparison);
}

function renderSummary(comparison) {
  refs.resultSummary.replaceChildren();
  if (!comparison.ready) {
    const empty = document.createElement('div');
    empty.className = 'empty-result';
    const icon = document.createElement('div');
    icon.className = 'empty-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '÷';
    empty.append(icon);
    const strong = document.createElement('strong');
    strong.textContent = 'Add two options to see the better value.';
    empty.append(strong);
    const p = document.createElement('p');
    p.textContent = 'Use a quick start above if you want to see how deal math works.';
    empty.append(p);
    refs.resultSummary.append(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'summary-grid';
  if (comparison.hasMixedKinds) {
    grid.append(summaryTile('Best value', 'Within each type', `${comparison.winners.length} winners`, true));
  } else {
    const winner = comparison.bestOverall;
    grid.append(summaryTile('Best value', winner?.name || '—', winner ? formatUnitPrice(winner) : '—', true));
  }
  const packCount = comparison.valid.reduce((sum, result) => sum + result.basket.quantity, 0);
  grid.append(summaryTile('Plan total', formatMoney(comparison.allBasketTotal), `${packCount} pack${packCount === 1 ? '' : 's'} if every row is bought`));
  const dealSavings = comparison.basketSavings;
  grid.append(summaryTile(dealSavings > 0 ? 'Deal savings' : 'Promotion savings', dealSavings > 0 ? formatMoney(dealSavings) : '—', dealSavings > 0 ? 'vs regular shelf prices' : 'No active promotion', false));
  refs.resultSummary.append(grid);
}

function summaryTile(labelText, valueText, detailText, highlight = false) {
  const tile = document.createElement('div');
  tile.className = `summary-tile${highlight ? ' is-highlight' : ''}`;
  const label = document.createElement('span');
  label.className = 'summary-label';
  label.textContent = labelText;
  tile.append(label);
  const value = document.createElement('span');
  value.className = 'summary-value';
  value.textContent = valueText;
  tile.append(value);
  const detail = document.createElement('span');
  detail.className = 'summary-detail';
  detail.textContent = detailText;
  tile.append(detail);
  return tile;
}

function renderTable(comparison) {
  refs.comparisonBody.replaceChildren();
  refs.comparisonNote.textContent = comparison.hasMixedKinds
    ? 'Weight, volume, and count are ranked separately.'
    : 'Lower is better · prices use the selected display basis.';
  const rows = comparison.groups.flatMap((group) => group.rows);
  rows.forEach((result) => {
    const tr = document.createElement('tr');
    const isWinner = comparison.winners.some((winner) => winner.index === result.index);
    if (isWinner) tr.className = 'winner';
    tr.append(tableCellOption(result, isWinner));
    tr.append(tableCell(formatMoney(result.deal.effectivePackPrice), result.deal.savingsRate > 0 ? `from ${formatMoney(result.deal.regularPrice)}` : 'regular price'));
    tr.append(tableCell(formatUnitPrice(result), `per ${KIND_LABELS[result.kind]}` , 'unit-price-cell'));

    const buyCell = document.createElement('td');
    const buy = document.createElement('input');
    buy.className = 'buy-input';
    buy.type = 'number';
    buy.min = '1';
    buy.step = '1';
    buy.value = result.item.buy ?? 1;
    buy.dataset.field = 'buy';
    buy.dataset.index = String(result.index);
    buy.setAttribute('aria-label', `Buy packs for ${result.name}`);
    buyCell.append(buy);
    tr.append(buyCell);

    const basket = document.createElement('td');
    basket.className = 'basket-cell';
    basket.textContent = formatMoney(result.basket.total);
    if (result.basket.savings > 0) {
      const saving = document.createElement('span');
      saving.className = 'summary-detail';
      saving.textContent = `save ${formatMoney(result.basket.savings)}`;
      basket.append(saving);
    }
    tr.append(basket);
    refs.comparisonBody.append(tr);
  });
}

function tableCellOption(result, isWinner) {
  const cell = document.createElement('td');
  cell.className = 'option-cell';
  cell.append(textNode(result.name));
  const detail = document.createElement('span');
  detail.textContent = `${formatUnitAmount(result)} · ${KIND_LABELS[result.kind]}`;
  cell.append(detail);
  if (isWinner) {
    const tag = document.createElement('span');
    tag.className = 'winner-tag';
    tag.textContent = 'Best value';
    cell.append(tag);
  }
  return cell;
}

function tableCell(value, detailText = '', className = '') {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.append(textNode(value));
  if (detailText) {
    const detail = document.createElement('span');
    detail.className = 'summary-detail';
    detail.textContent = detailText;
    cell.append(detail);
  }
  return cell;
}

function renderInsight(comparison) {
  refs.insight.replaceChildren();
  if (comparison.hasMixedKinds) {
    const lead = document.createElement('strong');
    lead.textContent = 'Separate comparisons: ';
    refs.insight.append(lead);
    refs.insight.append(textNode(comparison.winners.map((winner) => `${KIND_LABELS[winner.kind]} → ${winner.name} at ${formatUnitPrice(winner)}`).join(' · ')));
    return;
  }
  const winner = comparison.bestOverall;
  const alternatives = comparison.groups[0]?.rows.slice(1) || [];
  if (!winner || alternatives.length === 0) return;
  const next = alternatives[0];
  const difference = Math.max(0, next.unitPrice - winner.unitPrice);
  const percent = next.unitPrice > 0 ? Math.round((difference / next.unitPrice) * 100) : 0;
  const lead = document.createElement('strong');
  lead.textContent = `${winner.name} is the best value. `;
  refs.insight.append(lead);
  refs.insight.append(textNode(`It is ${formatMoney(difference)} cheaper per ${winner.display.label} than ${next.name}${percent ? ` (${percent}% lower)` : ''}. Check the basket total too—buying more is not automatically saving more.`));
}

function updateFormStatus(comparison) {
  if (comparison.ready) {
    refs.formStatus.textContent = comparison.invalid.length ? `${comparison.invalid.length} option${comparison.invalid.length === 1 ? '' : 's'} still need a price and size.` : '';
  } else if (comparison.valid.length === 1) {
    refs.formStatus.textContent = 'Add one more option with a positive price and package size.';
  } else {
    refs.formStatus.textContent = 'Prices and sizes calculate as you type.';
  }
}

function formatMoney(value) {
  const currency = state.currency;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(value || 0);
  } catch {
    return `${CURRENCY_SYMBOLS[currency] || currency}${Number(value || 0).toFixed(2)}`;
  }
}

function formatUnitPrice(result) {
  return `${formatMoney(result.unitPrice)} / ${result.display.label}`;
}

function buildSummaryText(comparison) {
  const lines = ['AisleMath grocery comparison', ''];
  if (comparison.hasMixedKinds) {
    lines.push('Best value by type:');
    comparison.winners.forEach((winner) => lines.push(`- ${KIND_LABELS[winner.kind]}: ${winner.name} — ${formatUnitPrice(winner)}`));
  } else if (comparison.bestOverall) {
    lines.push(`Best value: ${comparison.bestOverall.name} — ${formatUnitPrice(comparison.bestOverall)}`);
  }
  lines.push(`Plan total (all entered rows): ${formatMoney(comparison.allBasketTotal)}`);
  if (comparison.basketSavings > 0) lines.push(`Promotion savings: ${formatMoney(comparison.basketSavings)}`);
  lines.push('', 'Prices and calculations supplied by the shopper. AisleMath is not a live price feed.');
  return lines.join('\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  refs.toast.textContent = message;
  refs.toast.classList.add('is-visible');
  toastTimer = setTimeout(() => refs.toast.classList.remove('is-visible'), 3200);
}

function textNode(text) {
  return document.createTextNode(String(text));
}

function encodeState(value) {
  const json = typeof value === 'string' ? value : JSON.stringify(value);
  try {
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  } catch {
    return btoa(unescape(encodeURIComponent(json))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  }
}

function decodeState(value) {
  try {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    try {
      return decodeURIComponent(escape(atob(value)));
    } catch {
      return '';
    }
  }
}
