# BizLink — HTML-first frontend

UI lives in **HTML files**. JavaScript only handles behaviour (auth, session, cart, OTP).

## Structure

```
frontend/
├── index.html              Landing — Get Started → signup
├── signup.html             Create account (name → initials)
├── signin.html             Sign in
├── forgot-password.html    Reset password (OTP)
├── browse.html             Shop (protected)
├── orders.html             Customer orders (customer only)
├── profile.html            Profile + initials avatar (all roles, role-specific nav)
├── business.html           Business dashboard      (business only — layer 2, built)
├── business-orders.html    Business orders         (layer 2, built)
├── business-products.html  Business products       (layer 2, built)
├── driver.html             Driver dashboard        (delivery only — layer 3, built)
├── driver-active.html      Active delivery         (layer 3, built)
├── driver-earnings.html    Driver earnings         (layer 3, built)
├── styles.css
├── js/
│   ├── config.js           EmailJS settings
│   ├── auth.js             Accounts (PBKDF2)
│   ├── session.js          Logged-in user + initials
│   ├── icons.js            Line-icon sprite (shared)
│   ├── nav.js              Cart + Orders badges in the bottom nav (shared)
│   ├── products-store.js   Shared products + shop open/closed (seeded with the 12 starter products)
│   ├── orders-store.js     ONE shared order list + shop/driver state machine + simulated tracking
│   ├── biz-ui.js           Business helpers: stats from real data, order cards, sheets, toast
│   ├── business.js         Dashboard
│   ├── business-orders.js  Orders tabs + actions
│   ├── business-products.js Product list, add/edit/delete, in/out switch
│   ├── driver-ui.js        Driver helpers: vehicle, commission stats
│   ├── driver.js           Driver dashboard
│   ├── driver-active.js    Active delivery + chat with customer
│   ├── driver-earnings.js  Commission history
│   ├── role-page.js        (no longer used by any page)
│   ├── orders.js           Orders list, tracking sheet, cancel, order again
│   ├── signup.js
│   ├── signin.js
│   ├── otp.js
│   ├── browse.js
│   └── profile.js
└── README.md
```

## Flow

1. **Get Started** on `index.html` → `signup.html` (create account first).
2. On sign-up, full name, phone and address are saved (and can be edited on the Profile page); **initials** (e.g. Mpho Ramarumo → **MR**) are stored in the session and shown on browse, orders, and profile.
3. **Log In** → `signin.html` → same session + initials.
4. Protected pages redirect to sign-in if there is no session.

## Run

```bash
npx serve frontend
```

Open the URL shown. Demo account (seeded once): `you@example.com` / `password123` (initials **MR**).

Edit EmailJS keys in `js/config.js` for password-reset emails.

## Orders

Checkout saves a real order (per account). Orders.html shows Active / Past, a tracking timeline, cancel (while Placed/Confirmed) and Order again.
Status, driver position, minutes left, delays and driver chat replies are all SIMULATED from elapsed time (no backend yet).
- `DEMO` in `js/orders-store.js`: `true` = whole delivery ~3 min, `false` = realistic (~31 min).
- Every 3rd order number (e.g. BL-1044, BL-1047) is delayed, so you can see the "Running late" banner.
- Phone numbers are placeholders: `SUPPORT_PHONE` and the `DRIVERS` list in `js/orders-store.js`.
- Live tracker: "Out for delivery" shows a drawn map with the driver moving along the route, minutes left and km away.
- Driver card: Call (dials on a phone, shows the number on desktop) and Message (in-app chat with quick replies).
- Help: call support or report a problem (reason + note) → complaint reference like CMP-2031.

## Roles (layer 1)

Sign-up asks "I am a…" first. Extra fields: **Business name** (businesses), **Vehicle type + number plate** (drivers; no plate for Bicycle).

| Role | Lands on | Own pages | Bottom nav |
|------|----------|-----------|-----------|
| Customer | `browse.html` | browse, orders | Home, Browse, Orders, Cart, Profile |
| Business | `business.html` | business, business-orders, business-products | Dashboard, Orders, Products, Profile |
| Delivery | `driver.html` | driver, driver-active, driver-earnings | Jobs, Active, Earnings, Profile |

`BizSession.requireRole(role)` guards each page: a driver who opens `browse.html` is sent to `driver.html`. Profile is shared.

Demo accounts (all password `password123`):
- Customer `you@example.com`
- Driver `driver@example.com`
- Shops (own the 12 starter products): `shop@example.com` (Kasi Essentials), `ubuntu@`, `mamsi@`, `freshstop@`, `homecare@`, `edustation@` + `example.com`

## Connected data

- `BizProducts` is the single product list. Browse renders from it, so products a business adds show up for customers; stock is taken at checkout and put back on decline/cancel.
- `BizShops` holds each shop's Open/Closed. A closed shop's products show "Shop closed" and cannot be ordered.
- Checkout creates **one order per shop** (each shop packs its own). The cart tells the customer when that happens.
- `BizOrders` keeps one shared list. Order `state` flow: placed → accepted → preparing → ready → at_shop → picked_up → on_trip → arrived → delivered (or declined / cancelled). Shop and driver actions: `shopAccept`, `shopStartPreparing`, `shopReady`, `shopDecline`, `driverAccept`, `driverAdvance`, plus `forShop`, `forDriver`, `openJobs`, `activeFor`.
- `AUTOPILOT = true` in `orders-store.js` keeps the customer's live tracker on the old timer simulation until the business and driver screens exist. Layer 3 turns it off so the tracker follows the real driver.
- To test as three roles, sign in as each in separate tabs of the same browser (they share localStorage). Signing out in one tab signs out all tabs.

## Business side (layer 2)

- **Dashboard**: Open/Closed switch by the shop name; cards for Sales today, Orders today, Waiting for you, Low stock; "Sales, last 7 days" chart (last 7 days ending today, best day in amber, total in green); New orders with Accept / Decline; top 3 sellers; low-stock alert. Bell dot shows when orders are waiting.
- **Orders**: New / Preparing / Ready / Completed. One big button per order: Accept (or Decline) → Start preparing → Mark as ready. Ready orders wait for a driver (layer 3). Declining puts stock back.
- **Products**: add, edit, delete, in/out switch, All / Low stock / Out filters. Low = `BizProducts.LOW` (6) or fewer.
- Money counts once an order is **accepted**; declined and cancelled orders never count. No supplier section and no auto-cancel (orders wait until the shop acts).
- Customer rating and average delivery time are not shown because nothing records them yet.
- To try it: as `you@example.com` order from a shop, then sign in as that shop (e.g. `mamsi@example.com`) in another tab.

## Driver side (layer 3)

- **Dashboard** (`driver.html`): Online/Offline switch, vehicle card (type + number plate from sign-up), commission today / this week / deliveries / total, 7-day commission chart, and available deliveries (orders the shop marked Ready). Accept takes you to Active delivery. One delivery at a time.
- **Active delivery**: pickup + drop-off details with Call buttons, items to collect, one big button per step (Arrived at shop → Picked up → Start trip → Arrived → Delivered), progress, and chat with the customer.
- **Earnings**: total commission, today, this week, 7-day chart and every completed delivery.
- **Commission** = R20 per delivery + R5 per km (`PAY` in `orders-store.js`). It counts when the order is marked Delivered.
- `AUTOPILOT` is now `false`: the customer's tracker follows the real shop and driver steps (Placed → Confirmed → Being prepared → Out for delivery → Delivered). Declined orders show as Declined. Chat with a real driver is live (no simulated replies). Set `AUTOPILOT = true` to bring back the old timer demo.
- Test all three roles in separate tabs: customer `you@example.com`, shop `mamsi@example.com`, driver `driver@example.com` (password `password123`). Sessions share one browser, so use separate browser profiles or sign in/out per tab.
