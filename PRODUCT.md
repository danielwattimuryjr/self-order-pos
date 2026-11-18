# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Customers:** Diners at a single Jakarta restaurant who scan a table QR code on their phone to browse, order, and pay without creating an account. Each customer can access only their own order and receipt.
- **Admin:** Restaurant operators who manage the catalog, tables, vouchers, staff, operating hours, transactions, reports, and audit history.
- **Staff:** Restaurant staff who use the kitchen queue and order history for operations. Their app access is read-only and does not include sales analytics or administrative actions.

## Product Purpose

QR Restaurant Ordering System V1 lets diners place and pay for their own table orders from a phone. It reduces manual order entry and cashier interaction, sends confirmed paid orders to the kitchen, and gives the restaurant consistent, auditable transaction records. The product serves one restaurant outlet in Jakarta.

## Positioning

The system connects table QR ordering to QRIS payment verification: only provider-verified paid orders enter the kitchen queue. Each order keeps an immutable snapshot of its items and prices so later catalog changes do not rewrite transaction history.

## Operating Context

- Customers use a permanent QR code at a physical restaurant table; multiple devices can join the same table session while each checkout creates an independent order.
- The customer journey is mobile-first and does not require login. A unique per-order token grants access to that order's confirmation and receipt.
- Admin work is primarily done through a desktop-friendly management interface. Staff use a queue-first interface during restaurant operations.
- The restaurant operates in Jakarta time (`Asia/Jakarta`). The same daily opening and closing schedule determines ordering availability and operational dates.
- Product language is Bahasa Indonesia. Currency is Indonesian rupiah, shown without decimal places.

## Capabilities and Constraints

- Customers browse an ordered catalog, configure variants and add-ons, add notes, use a voucher, and check out from a device-local cart.
- QRIS payments use Midtrans. Payment state is verified through the trusted server-side provider flow; processing is idempotent. Realtime updates refresh interfaces but do not establish payment or authorization.
- Order creation, prices, totals, voucher eligibility and quotas, order state, and payment state are controlled by the server and database. Financial and concurrency-sensitive operations must be atomic.
- Order records retain snapshots of purchased items and prices. Customer access is limited to the customer's own order token.
- Admin manages menu and categories, tables and permanent QR codes, vouchers, staff, operating hours and temporary closures, unpaid-order cancellation, transactions, sales reports, and audit history.
- Staff can view the kitchen queue, ticket details, transaction/order details, order history, and their account profile. Kitchen tickets are read-only; V1 has no preparing, ready, or completed workflow.
- Only successfully paid orders create kitchen tickets. V1 does not include cash payment in the app, automatic refunds, inventory counts, customer accounts, multiple outlets, or native mobile apps.
- The app is a web project using Next.js and Supabase. Local development uses Docker Desktop and Supabase CLI; production uses hosted Supabase and Vercel.

## Brand Commitments

- Product name in the approved documentation: **QR Restaurant Ordering System V1**.
- User-facing language is Bahasa Indonesia.

## Evidence on Hand

- Approved product requirements and business behavior: `docs/00-product/PRD.md` and `docs/00-product/BUSINESS_RULES.md`.
- Approved customer, Admin, and Staff journeys: `docs/00-product/USER_FLOWS.md` and `docs/00-product/UI_UX_SPEC.md`.
- The repository contains the web application and its operational flows. No customer testimonials, external performance benchmarks, or press evidence are established in the product documentation; future work must not invent them.

## Product Principles

- Keep customer ordering short and account-free.
- Treat the server and database as the authority for money, quotas, order state, and payment state.
- Send only verified paid orders to kitchen operations.
- Preserve an auditable, immutable record of each transaction.
- Limit each role to the information and actions required for its work.

## Accessibility & Inclusion

Meet WCAG 2.1 AA. The product is responsive and uses Bahasa Indonesia.
