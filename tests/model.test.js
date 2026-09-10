import { describe, expect, it } from 'vitest';
import {
  basketCost,
  compareItems,
  comparisonCsv,
  createItem,
  dealDetails,
  itemResult,
  normalizedAmount,
  parseState,
} from '../src/model.js';

describe('AisleMath unit-price model', () => {
  it('normalizes mixed weight units to grams', () => {
    expect(normalizedAmount(createItem({ amount: 1, unit: 'kg' }))).toBe(1000);
    expect(normalizedAmount(createItem({ amount: 16, unit: 'oz' }))).toBeCloseTo(453.59237, 5);
  });

  it('ranks a mid-size cereal box when it is the best value', () => {
    const comparison = compareItems([
      createItem({ name: 'Large', price: 8.99, amount: 24, unit: 'oz' }),
      createItem({ name: 'Mid', price: 5.49, amount: 18, unit: 'oz' }),
      createItem({ name: 'Small', price: 3.99, amount: 12, unit: 'oz' }),
    ]);
    expect(comparison.ready).toBe(true);
    expect(comparison.bestOverall.name).toBe('Mid');
    expect(comparison.bestOverall.unitPrice).toBeCloseTo(1.0759, 3);
  });

  it('applies a multi-buy to unit price and only applies it to full bundles in the basket', () => {
    const item = createItem({ price: 3.5, amount: 500, unit: 'g', deal: 'multi', dealQty: 2, dealPrice: 5, buy: 3 });
    expect(dealDetails(item).effectivePackPrice).toBe(2.5);
    expect(basketCost(item)).toMatchObject({ total: 8.5, regular: 10.5, savings: 2 });
    expect(itemResult(item, 0).unitPrice).toBeCloseTo(0.5, 5);
  });

  it('handles buy-one-get-one without making a partial bundle free', () => {
    const item = createItem({ price: 10, amount: 1, unit: 'each', deal: 'bogo', bogoBuy: 1, bogoFree: 1, buy: 3 });
    expect(dealDetails(item).effectivePackPrice).toBe(5);
    expect(basketCost(item).total).toBe(20);
    expect(basketCost(item).savings).toBe(10);
  });

  it('supports percentage and per-pack coupon promotions', () => {
    expect(dealDetails(createItem({ price: 20, deal: 'percent', percentOff: 15 })).effectivePackPrice).toBe(17);
    expect(dealDetails(createItem({ price: 4, deal: 'coupon', couponOff: 1.25 })).effectivePackPrice).toBe(2.75);
  });

  it('keeps weight, volume, and count in separate comparison groups', () => {
    const comparison = compareItems([
      createItem({ name: 'Flour', price: 4, amount: 1, unit: 'kg' }),
      createItem({ name: 'Milk', price: 3, amount: 2, unit: 'l' }),
      createItem({ name: 'Eggs', price: 5, amount: 12, unit: 'each' }),
    ]);
    expect(comparison.hasMixedKinds).toBe(true);
    expect(comparison.groups.map((group) => group.kind)).toEqual(['mass', 'volume', 'count']);
    expect(comparison.winners).toHaveLength(3);
  });

  it('marks incomplete rows invalid while retaining valid rows', () => {
    const comparison = compareItems([
      createItem({ name: 'Ready', price: 3, amount: 500, unit: 'g' }),
      createItem({ name: 'Missing size', price: 4, amount: '', unit: 'g' }),
      createItem({ name: 'Missing price', price: '', amount: 1, unit: 'l' }),
    ]);
    expect(comparison.valid).toHaveLength(1);
    expect(comparison.invalid).toHaveLength(2);
    expect(comparison.ready).toBe(false);
  });

  it('parses a bounded share state and falls back safely for unknown units', () => {
    const parsed = parseState(JSON.stringify({ currency: 'EUR', basis: 'per1', items: [{ name: 'A', price: 2, amount: 4, unit: 'unknown' }] }));
    expect(parsed.currency).toBe('EUR');
    expect(parsed.basis).toBe('per1');
    expect(parsed.items[0].unit).toBe('g');
    expect(parseState('{bad json')).toBeNull();
  });

  it('escapes formula-like names in CSV output', () => {
    const comparison = compareItems([createItem({ name: '=IMPORTDATA("secret")', price: 2, amount: 1, unit: 'each' }), createItem({ name: 'Safe', price: 3, amount: 1, unit: 'each' })]);
    const csv = comparisonCsv(comparison, 'AUD');
    expect(csv).toContain("'=IMPORTDATA(\"\"secret\"\")");
    expect(csv).toContain('Currency,"AUD"');
  });
});
