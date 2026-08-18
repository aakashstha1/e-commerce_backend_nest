# E-Shop — Project Overview

A full-stack e-commerce application: a NestJS + MongoDB API and a Next.js
storefront + admin panel. Covers browsing/search, cart, wishlist, checkout
with COD and eSewa payment, order tracking, reviews, notifications, and an
admin back office.

---

## Tech Stack

**Backend**
- NestJS 11 (TypeScript) + MongoDB via Mongoose 8
- Auth: `@nestjs/jwt` + `passport-jwt` (access/refresh token pair), `bcrypt` for password hashing
- Validation: `class-validator` / `class-transformer`
- File storage: Cloudinary (product images, avatars)
- API docs: Swagger (`@nestjs/swagger`)
- Payments: eSewa (real v2 test/dummy merchant flow)

**Frontend**
- Next.js 16 (App Router) + React 19, TypeScript
- Data fetching/cache: TanStack Query
- Auth/client state: Zustand (persisted to localStorage)
- UI: Tailwind CSS 4 + Radix UI primitives (shadcn-style components), lucide-react icons
- Toasts: Sonner

---

## Backend — Modules & API

Global prefix: `/api/v1`. Base URL in dev: `http://localhost:3001/api/v1` (`PORT` in `.env`).

| Module | Purpose | Key endpoints |
|---|---|---|
| `auth` | Signup/login/refresh/logout, JWT issuing | `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| `users` | Profile management, admin user list | `GET /users/me`, `PATCH /users/me`, `GET /users`, `GET/PATCH/DELETE /users/:id` (admin) |
| `address` | Saved delivery addresses | `POST/GET /addresses`, `GET/PATCH/DELETE /addresses/:id` |
| `category` | Product categories (admin-managed) | `GET /categories`, `GET /categories/:id`, `POST/PATCH/DELETE /categories/:id` (admin) |
| `product` | Product catalog, stock, images | `GET /products`, `GET /products/slug/:slug`, `GET /products/:id`, `POST/PATCH/DELETE /products/:id` (admin), `PATCH /products/:id/stock`, `PATCH /products/:id/thumbnail` |
| `cart` | Per-user cart | `GET /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:itemId`, `DELETE /cart` |
| `wishlist` | Per-user wishlist | `GET /wishlist`, `POST /wishlist/items`, `DELETE /wishlist/items/:productId` |
| `order` | Checkout, order history, status | `POST /orders` (COD checkout), `GET /orders` (mine), `GET /orders/admin/all`, `GET /orders/:id`, `PATCH /orders/:id/cancel`, `PATCH /orders/:id/status` (admin) |
| `payment` | Payment records, eSewa flow, COD confirmation | `POST /payments` (COD), `POST /payments/esewa/initiate`, `GET /payments/esewa/success` \| `/failure` (public, eSewa redirect targets), `POST /payments/confirm` (admin), `PATCH /payments/:id/fail` \| `/mark-cod-paid` (admin), `PATCH /payments/order/:orderId/mark-cod-paid` (admin), `GET /payments/order/:orderId` |
| `review` | Product ratings/reviews | `POST /reviews`, `GET /reviews/product/:productId`, `GET /reviews/product/:productId/summary`, `PATCH/DELETE /reviews/:id` |
| `notification` | In-app notifications (order placed, payment received, etc.) | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |

### Checkout & payment flow

- **Cash on Delivery** — `POST /orders` creates the order immediately (`paymentStatus: pending`); a `Payment` record (`method: cod`) is created alongside it. An admin later confirms cash was collected via the mark-cod-paid endpoints, which flips both the `Payment` and the `Order.paymentStatus` to `paid`.
- **eSewa** — `POST /payments/esewa/initiate` prices the current cart and returns signed form fields; the frontend submits a real form POST to eSewa's payment page (eSewa's actual public test/dummy sandbox, using its published `EPAYTEST` test credentials). No order exists yet at this point — only a `PendingCheckout` "intent" record. eSewa redirects the browser back to `GET /payments/esewa/success` (or `/failure`); on success, the signature is verified and **only then** is the real order created (stock decremented, cart cleared) and marked paid.
- Stripe/Khalti are defined as `PaymentMethod` enum values but have no gateway integration wired up yet — `POST /payments` (the generic initiate endpoint) currently only accepts COD.

### Data model (Mongo collections)

`User`, `Address`, `Category`, `Product`, `Cart` + `CartItem`, `Wishlist` + `WishlistItem`, `Order` + `OrderItem`, `Payment`, `PendingCheckout`, `Review`, `Notification`.

### Auth model

Access + refresh JWT pair, issued on login/signup. The frontend's axios client auto-attaches the access token and transparently refreshes it on a 401 (see `api/client.ts`). Role-based guard (`RolesGuard` + `@Roles(UserRole.ADMIN)`) protects admin-only endpoints.

### Requirements to run

- Node.js 18+
- MongoDB running as a **replica set** — required because checkout uses a Mongo transaction (`mongod --replSet rs0`, then `rs.initiate()`; see `backend_src/README.md` for the full local-dev / Docker instructions)
- Cloudinary account (image uploads)
- eSewa test credentials (already filled into `.env.example` — eSewa's own published sandbox values)

```bash
cd backend_src
npm install
cp .env.example .env   # fill in Mongo URI, JWT secrets, Cloudinary keys
npm run start:dev
```

---

## Frontend — Pages

| Route | Purpose |
|---|---|
| `/` | Home |
| `/products`, `/products/[slug]` | Catalog browsing, filters/search, product detail |
| `/cart` | Cart |
| `/wishlist` | Wishlist |
| `/checkout` | Address + payment method selection, places COD orders or redirects to eSewa |
| `/checkout/success`, `/checkout/failed` | Post-payment landing pages |
| `/orders`, `/orders/[id]` | Order history and detail (status, payment status/method, cancel) |
| `/account`, `/account/addresses` | Profile and saved addresses |
| `/notifications` | In-app notifications |
| `/login`, `/register` | Auth |
| `/admin` | Admin dashboard |
| `/admin/products`, `/admin/products/new`, `/admin/products/[id]/edit` | Product management |
| `/admin/categories` | Category management |
| `/admin/orders` | Order list — status updates, payment status, "Mark Paid" for COD |
| `/admin/users` | User management |

### Structure

```
frontend_src/
  app/            # Next.js App Router pages (routes above)
  components/     # UI (shadcn-style primitives in ui/, feature components elsewhere)
  hooks/          # TanStack Query hooks per domain (use-orders, use-cart, use-auth, ...)
  api/            # Typed axios wrappers per backend module
  store/          # Zustand auth store (persisted, with hydration-safe access)
  types/          # Shared TS types mirroring backend DTOs/schemas
  utils/          # Formatting helpers (currency, date)
```

### Requirements to run

- Node.js 18+
- Backend running and reachable at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api/v1`)

```bash
cd frontend_src
npm install
npm run dev
```

---

## Admin capabilities

- Manage categories and products (create/edit/delete, stock, thumbnail)
- View and update order status through its lifecycle (`pending → processing → shipped → delivered`, or `cancelled`)
- View payment method/status per order; manually confirm Cash on Delivery payments as collected
- Manage users

## Known gaps / not yet built

- Stripe and Khalti payment methods are modeled but not integrated (see the eSewa integration as the pattern to follow — a Stripe integration guide was drafted separately)
- Footer "Help" and "Legal" links point to placeholder pages (`/contact`, `/shipping`, `/returns`, `/faq`, `/terms`, `/privacy`, `/cookies` don't exist yet)
- No automated e2e test coverage beyond NestJS's generated boilerplate specs
