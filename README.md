# E-Shop — Backend Overview

A NestJS + MongoDB API for a full-stack e-commerce app: auth, catalog, cart,
wishlist, checkout (COD + eSewa), order tracking, reviews, notifications, and
admin management endpoints.

---

## Tech Stack

- NestJS 11 (TypeScript) + MongoDB via Mongoose 8
- Auth: `@nestjs/jwt` + `passport-jwt` (access/refresh token pair), `bcrypt` for password hashing
- Validation: `class-validator` / `class-transformer`
- File storage: Cloudinary (product images, avatars)
- API docs: Swagger (`@nestjs/swagger`)
- Payments: eSewa (real v2 test/dummy merchant flow)

---

## Modules & API

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

---

## Checkout & payment flow

- **Cash on Delivery** — `POST /orders` creates the order immediately (`paymentStatus: pending`); a `Payment` record (`method: cod`) is created alongside it. An admin later confirms cash was collected via the mark-cod-paid endpoints, which flips both the `Payment` and the `Order.paymentStatus` to `paid`.
- **eSewa** — `POST /payments/esewa/initiate` prices the current cart and returns signed form fields; the frontend submits a real form POST to eSewa's payment page (eSewa's actual public test/dummy sandbox, using its published `EPAYTEST` test credentials). No order exists yet at this point — only a `PendingCheckout` "intent" record. eSewa redirects the browser back to `GET /payments/esewa/success` (or `/failure`); on success, the signature is verified and **only then** is the real order created (stock decremented, cart cleared) and marked paid.
- Stripe/Khalti are defined as `PaymentMethod` enum values but have no gateway integration wired up yet — `POST /payments` (the generic initiate endpoint) currently only accepts COD.

---

## Data model (Mongo collections)

`User`, `Address`, `Category`, `Product`, `Cart` + `CartItem`, `Wishlist` + `WishlistItem`, `Order` + `OrderItem`, `Payment`, `PendingCheckout`, `Review`, `Notification`.

---

## Auth model

Access + refresh JWT pair, issued on login/signup. Role-based guard (`RolesGuard` + `@Roles(UserRole.ADMIN)`) protects admin-only endpoints. The frontend's axios client auto-attaches the access token and transparently refreshes it on a 401.

---

## Project structure

```
src/
  common/       # global guards, filters, interceptors, decorators
  config/       # typed config loaders (app, esewa, etc.)
  modules/      # one folder per domain module (see table above)
```

---

## Requirements to run

- Node.js 18+
- MongoDB running as a **replica set** — required because checkout uses a Mongo transaction:
  ```bash
  mongod --dbpath ./data --replSet rs0
  # in a separate shell:
  mongosh --eval "rs.initiate()"
  ```
  Or with Docker:
  ```bash
  docker run -d -p 27017:27017 --name mongo mongo:7 --replSet rs0
  docker exec -it mongo mongosh --eval "rs.initiate()"
  ```
- Cloudinary account (image uploads)
- eSewa test credentials (already filled into `.env.example` — eSewa's own published sandbox values)

```bash
npm install
cp .env.example .env   # fill in Mongo URI, JWT secrets, Cloudinary keys
npm run start:dev      # watch mode
npm run build && npm run start:prod
```

### Tests & lint

```bash
npm test              # unit tests
npm run test:cov      # with coverage
npm run lint
```

---

## Known gaps / not yet built

- Stripe and Khalti payment methods are modeled but not integrated (see the eSewa integration as the pattern to follow — the `EsewaService` / `PaymentService` / `PendingCheckout` structure was written to be reusable for another gateway)
- No automated e2e test coverage beyond NestJS's generated boilerplate specs
