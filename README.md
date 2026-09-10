# AisleMath

**Use it here: https://thisbejim.github.io/aislemath/**

AisleMath is a free grocery unit price calculator for comparing package sizes, mixed weight/volume units, and promotions such as “2 for $5”, buy-one-get-one, percentage discounts, and coupons. It also shows what the entered number of packs would cost in the basket.

## Why this tool exists

The search intent is explicit: people look for `unit price calculator`, `price per ounce calculator`, `compare grocery prices`, and `which package is the better deal`. The task is common enough that a [University of Illinois Extension shopping guide](https://extension.illinois.edu/sites/default/files/2024-11/shopping_to_save.pdf) teaches shoppers to divide total price by package size, and a recent [r/povertyfinance discussion](https://www.reddit.com/r/povertyfinance/comments/1phkhmu/tired_of_doing_math_in_the_grocery_aisle_to/) describes doing that math for every item in the aisle.

The strongest search results we reviewed prove the need but leave practical gaps:

- [UnitPriceCalculator.com](https://unitpricecalculator.com/) is a very small, older two-option calculator.
- [ToolVaults](https://toolvaults.net/calculators/unit-price/) ranks multiple rows but asks shoppers to convert units themselves and does not model promotions.
- [Cartlyt](https://www.cartlyt.com/unit-price-calculator) presents unit pricing inside a broader product with a free trial and paid plan.

AisleMath is the focused alternative: enter the facts printed on the shelf, normalize unlike units, apply the real promotion, and see the arithmetic without an account, ads, price feed, or upload.

### Product thesis

For budget-conscious grocery shoppers, AisleMath turns shelf prices and package sizes—including multi-buy deals—into a transparent comparison and basket estimate better than mental math or single-item calculators because it handles the messy promotions and mixed units people actually encounter.

## What it does

- Compares weight, volume, and count items in separate, honest groups.
- Converts g/kg/oz/lb, ml/L/US fl oz, and item counts to a shared base.
- Applies regular prices, multi-buy bundles, buy-one-get-one, percentage-off deals, and per-pack coupons.
- Ranks options by automatic per-100 g, per-100 ml, or per-item pricing, with a per-unit display option.
- Calculates a basket total for the number of packs entered and shows promotion savings.
- Loads cereal, paper-towel, and cooking-oil examples so a first-time visitor can understand the result immediately.
- Copies a plain-language summary, copies a shareable URL, downloads a CSV, and prints the comparison.
- Remembers the draft only in local browser storage; the share link is created only when the user asks for it.

## Privacy and independence

AisleMath is a static browser application. The calculations, rendering, clipboard text, CSV generation, and share-state encoding all happen in the tab. It has no backend, API key, account, payment flow, analytics, advertising, cookies, or required third-party runtime service. Price and item data remain on the device unless a user deliberately copies a share URL or downloaded file.

The result is a transparent comparison, not a live price feed or financial recommendation. Shelf life, storage, quality, and what a shopper can afford today still matter.

## Development

Requirements: Node.js 20+ and npm.

```bash
npm install
npm test
npm run build
npm run dev
```

The Vite development server serves the app at `http://localhost:5173`. The production build is the ordinary static files in `dist/` and uses a relative base so the project works at the GitHub Pages `/aislemath/` path.

## Testing and validation

- 9 Vitest model tests cover unit conversion, ranking, bundle math, BOGO partial bundles, percentage/coupon discounts, mixed-kind grouping, invalid rows, share parsing, and CSV formula-injection escaping.
- 10 Playwright runs cover desktop and Pixel mobile first load, package comparison, multi-buy editing, share links, CSV download, and Axe accessibility scans.
- `npm audit --omit=optional` reports 0 vulnerabilities.
- The live production workflow checks HTTP/asset loading, responsive layout, the primary comparison flow, accessibility, console errors, and same-origin network requests.

## GitHub Pages deployment

GitHub Pages is configured from the repository’s `gh-pages` branch. To publish a fresh build, run `npm ci`, `npm test`, `npm run build`, copy the contents of `dist/` to the branch root, and push `gh-pages`. The site is published at the URL at the top of this README.

## License

MIT. See [`LICENSE`](LICENSE).

## Opportunity review

The final opportunity passed the hard quality gate before implementation:

| Dimension | Score | Evidence / reason |
| --- | ---: | --- |
| Consumer usefulness | 9/10 | Saves repeated aisle math and exposes misleading bulk deals. |
| Search-demand evidence | 8/10 | Exact-intent calculators exist across independent sites; community posts describe the pain. No fabricated volume is claimed. |
| Search intent | 9/10 | “Unit price calculator” and “price per ounce” are direct task queries. |
| Frequency | 9/10 | The underlying comparison happens across ordinary grocery trips. |
| Weakness of current solutions | 8/10 | Common tools are two-option, single-unit, promotion-blind, ad-heavy, or part of a paid product. |
| Magnitude of improvement | 8/10 | Mixed-unit conversion, promotion math, basket totals, and exports complete the workflow in one place. |
| Static/browser fit | 10/10 | All computation is deterministic client-side JavaScript. |
| Zero-friction usefulness | 9/10 | One blank row, three quick starts, instant recalculation, and no registration. |
| Privacy advantage | 8/10 | Shopping lists and prices never need to leave the device. |
| Mobile usefulness | 9/10 | Responsive controls and a compact comparison table are tested at Pixel width. |
| Accessibility | 9/10 | Semantic labels, keyboard-focus styles, live statuses, and Axe checks. |
| Search discoverability | 9/10 | Descriptive title, H1, meta description, canonical URL, sitemap, robots, and WebApplication metadata. |
| Correctness | 9/10 | Explicit conversion constants, visible formulas, boundary tests, and promotion regression tests. |
| Maintainability | 9/10 | Small dependency surface, plain modules, no external data feed, and a static deployment. |
| Expected public value | 9/10 | A free, private answer to a recurring purchase decision with a clear reason to exist. |

Several other researched ideas were rejected because their current local-first competitors were already unusually strong (address-label printing, audio trimming, contact sheets, invoice generation, and duplicate-photo finding) or because their best version depended on changing external data. AisleMath had the clearest remaining mismatch between task demand and a complete, promotion-aware, zero-friction workflow.
