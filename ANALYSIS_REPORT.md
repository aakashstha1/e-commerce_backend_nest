# E-Commerce Backend — Analysis, Architecture & Implementation Report

## 1. Project Analysis (before this work)

The uploaded project was a **very early-stage skeleton**, not a partially built e-commerce backend:

| Area | State found |
|---|---|
| Auth | `signup`/`login` endpoints existed, but **no JWT was ever issued** despite `@nestjs/jwt` and `passport-jwt` being installed. `login()` returned the raw Mongoose document, including the bcrypt password hash. |
| Users | Partial CRUD. Create route was commented out. No delete endpoint. No RBAC — any authenticated caller could hit any route (and there was no auth to enforce anyway). |
| Address | Mongoose schema existed (`address.schema.ts`) but had **zero service, controller, or module** — completely unused. |
| Everything else in the diagram | **Did not exist at all**: Category, Product, ProductImage, Cart, CartItem, Wishlist, WishlistItem, Order, OrderItem, Payment, Review, Notification. |
| Cross-cutting concerns | No global exception filter, no request logging, no RBAC guards, no refresh-token flow, no `.env` validation, no consistent DTO validation pattern. |

This wasn't "missing a few features" — it was roughly **10% of the diagram's scope**, concentrated in Auth/Users, with real bugs in what existed.

## 2. Gap Analysis Against the Diagram

| Entity in diagram | Status before | Status now |
|---|---|---|
| User | Partial (no RBAC, no delete) | ✅ Complete + RBAC |
| Address | Schema only | ✅ Complete (CRUD, default-address logic) |
| Notification | Missing | ✅ Complete |
| Cart / Cart Item | Missing | ✅ Complete (price-snapshot, stock validation) |
| Wishlist / Wishlist Item | Missing | ✅ Complete |
| Category | Missing | ✅ Complete (tree endpoint, slug uniqueness) |
| Product / Product Image | Missing | ✅ Complete (search, filters, pagination, atomic stock ops) |
| Review | Missing | ✅ Complete (verified-purchase enforcement) |
| Order / Order Item | Missing | ✅ Complete (transactional checkout) |
| Payment | Missing | ✅ Modeled + workflow; **gateway SDK calls are stubbed** (see §7) |
| Coupons/discounts (in your written requirements, not in the diagram) | Missing | ⚠️ **Not built** — see §7 |

### Design inconsistencies / bugs found and fixed
1. **No password stripping on login/signup response** — fixed via `stripSensitiveFields()`.
2. **No refresh token mechanism** despite `refreshToken` field existing on the User schema — fixed with rotation + theft detection (see §4).
3. **`refreshToken` field had no `select: false`**, so it would leak on any `find()` — fixed.
4. **No stock-safety at checkout** — a race condition where two users could buy the last unit simultaneously. Fixed with an atomic `findOneAndUpdate` filter (`stockQuantity: { $gte: quantity }`) inside a Mongo transaction.
5. **No verified-purchase gate on reviews** — anyone could review anything. Fixed by checking for a `DELIVERED` order containing the product.

## 3. Architecture

**Pattern**: standard NestJS modular architecture — one module per bounded context, each owning its own schema(s), DTOs, service (business logic + persistence), and controller (HTTP boundary only).

```
src/
  common/                 # cross-cutting: guards, filters, interceptors, decorators
  config/                 # typed config loaders (db, jwt, hashing, app)
  modules/
    auth/                 # JWT issuance, refresh rotation, passport strategies
    users/                # profile CRUD, RBAC-gated admin routes
    address/              # user shipping addresses
    category/              # catalog taxonomy (tree-structured)
    product/               # catalog items + images, stock management
    cart/                  # per-user cart + items
    wishlist/               # per-user wishlist + items
    order/                 # checkout, order lifecycle, order items
    payment/                # payment records, gateway workflow
    review/                 # verified-purchase reviews + rating aggregation
    notification/           # in-app notifications, written to by other modules
```

**Dependency direction** (avoids circular imports): `Payment → Order → {Cart, Address, Product, Notification}`; `Review → Order` (schema-level only, no service coupling); `Category → Product` (schema-level, for the delete-guard check). Every module `export`s its service so siblings can inject it — no controller ever reaches into another module's model directly.

**Why Mongoose + MongoDB (kept as-is)**: the codebase was already committed to Mongoose. A relational engine would model Order/OrderItem more rigidly with foreign-key constraints, but Mongo transactions (used in checkout) give equivalent atomicity guarantees **as long as you run a replica set** (see §9 — a standalone `mongod` cannot run transactions).

## 4. Authentication & RBAC

- **Access token**: short-lived (15 min default), signed with `JWT_ACCESS_SECRET`.
- **Refresh token**: long-lived (7 days default), signed with a *different* secret (`JWT_REFRESH_SECRET`), sent by the client as `Authorization: Bearer <refreshToken>` to `POST /auth/refresh`.
- **Rotation + theft detection**: the server never stores the raw refresh token — only a bcrypt hash of it. On every refresh, the presented token is compared against the hash; on success, both tokens are reissued and the old hash is overwritten. If a presented token *doesn't* match the stored hash (e.g., an already-rotated/stolen token being replayed), the stored token is wiped, forcing re-login — a standard defense against refresh-token replay attacks.
- **RBAC**: `@Roles(UserRole.ADMIN)` + `RolesGuard` on admin-only routes (user management, category/product writes, order status transitions, payment confirmation). `JwtAuthGuard` is registered globally via `APP_GUARD`, so **every route requires a valid access token by default** — routes are opted *out* with `@Public()`, not opted in. This "secure by default" posture is deliberate: a forgotten guard decorator can't accidentally expose a route.

## 5. Key Business Logic Decisions

- **Checkout is transactional**: `OrderService.checkout()` opens a Mongo session, decrements stock atomically per line item (failing the whole transaction if any item is out of stock), creates the `Order` + `OrderItem`s, and clears the cart — all-or-nothing.
- **Order status is a state machine**: `pending → processing → shipped → delivered`, with `cancelled` reachable only from `pending`/`processing`. Cancelling restores stock. Invalid transitions (e.g., `delivered → processing`) are rejected.
- **Reviews require a delivered order** containing the product being reviewed — enforced server-side, not just a UI nicety.
- **Cart price snapshots**: the price shown in the cart is captured at add-time so it doesn't silently change while shopping, but checkout re-reads the *current* product price as the source of truth (a deliberate, explicit business decision — flagged in code — since letting stale cart prices win would let attackers exploit price rollbacks).
- **Address default logic**: exactly one address per user can be `isDefault`; setting a new default un-sets the old one; deleting the default promotes another address if one exists.

## 6. API Design (high-level)

All routes are prefixed `/api/v1` (global prefix + URI versioning, set in `main.ts`).

| Resource | Key endpoints |
|---|---|
| Auth | `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| Users | `GET /users/me`, `PATCH /users/me`, `GET /users` (admin), `GET/PATCH/DELETE /users/:id` (admin) |
| Addresses | `GET/POST /addresses`, `GET/PATCH/DELETE /addresses/:id` |
| Categories | `GET /categories?tree=true`, `GET /categories/:id`, `POST/PATCH/DELETE` (admin) |
| Products | `GET /products` (search/filter/paginate), `GET /products/slug/:slug`, `GET /products/:id`, `POST/PATCH/DELETE` (admin), `PATCH /products/:id/stock` (admin) |
| Cart | `GET/DELETE /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:itemId` |
| Wishlist | `GET /wishlist`, `POST /wishlist/items`, `DELETE /wishlist/items/:productId` |
| Orders | `POST /orders` (checkout), `GET /orders`, `GET /orders/admin/all` (admin), `GET /orders/:id`, `PATCH /orders/:id/cancel`, `PATCH /orders/:id/status` (admin) |
| Payments | `POST /payments` (initiate), `POST /payments/confirm` (admin — stand-in for webhook), `PATCH /payments/:id/fail`, `PATCH /payments/:id/mark-cod-paid` (admin), `GET /payments/order/:orderId` |
| Reviews | `POST /reviews`, `GET /reviews/product/:productId`, `GET /reviews/product/:productId/summary`, `PATCH/DELETE /reviews/:id` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |

## 7. Known Gaps / Assumptions (explicitly not built — recommendations below)

1. **Coupon/discount module**: your diagram doesn't include a `Coupon` entity, but your written requirements mention it. `CreateOrderDto.couponCode` and a `discount` field already exist end-to-end as placeholders. **Recommendation**: add a `Coupon` schema (`code`, `type: percent|flat`, `value`, `expiresAt`, `usageLimit`, `minOrderValue`) and a `CouponService.validateAndApply()` called from `OrderService.checkout()` where the `// TODO` comment already marks the spot.
2. **Payment gateway integration is stubbed**, not real. `PaymentService.createGatewaySession()` returns a fake redirect URL. Wiring real Stripe/eSewa/Khalti requires their SDKs/API keys and, critically, **signed webhook handlers** (Stripe webhook signatures, eSewa/Khalti server-side verification calls) instead of the current admin-gated `/payments/confirm` stand-in.
3. **Shipping fee and tax are flat-rate constants** (`SHIPPING_FEE`, `TAX_RATE` in `order.service.ts`) rather than a real shipping-rate/tax-jurisdiction engine. Fine for an MVP; swap for a real calculator before launch in multiple regions.
4. **No admin analytics/dashboard endpoints** (revenue over time, top products, etc.) were requested in your bullet list but aren't in the diagram. These are just Mongo aggregation pipelines against `Order`/`OrderItem` — straightforward to add once you confirm which metrics matter.
5. **Image uploads**: `thumbnail`/`imageUrl` are plain string fields — there's no file-upload endpoint. Assumption: images are uploaded to S3/Cloudinary/etc. by the frontend or a separate service, and only the resulting URL is sent to this API.

## 8. Testing Strategy

- **Unit tests** (implemented, 23 passing): AuthService (signup/login token issuance, wrong-password/duplicate-email rejection), AuthController (delegation), UsersService/Controller (not-found handling, delegation), ProductService (the atomic stock-decrement guard — the most safety-critical piece of logic in the whole system).
- **Pattern used**: every service test mocks its Mongoose model via `getModelToken()` — no real DB needed, fast and deterministic.
- **Recommended next tests** (not yet written, given scope): `OrderService.checkout()` with an in-memory MongoDB replica set (e.g. `mongodb-memory-server` configured with `--replSet`, required because transactions need one) to verify the all-or-nothing rollback behavior; `ReviewService` verified-purchase gate; e2e tests per module using Nest's `supertest` harness (`*.e2e-spec.ts`, scaffolding for which already exists under `test/`).

## 9. Deployment Recommendations

- **MongoDB must run as a replica set** (even a single-node one) for `session.withTransaction()` in checkout to work — a standalone `mongod` will throw at runtime. Locally: `mongod --replSet rs0` + `rs.initiate()`. Managed: Atlas clusters are replica sets by default.
- **Secrets**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PASSWORD_PEPPER` must be long, random, and different from each other — generate with `openssl rand -hex 32`. Never commit `.env`; `.env.example` is provided.
- **Add `helmet`** (`npm i helmet`) and call `app.use(helmet())` in `main.ts` for standard HTTP security headers — omitted here to avoid introducing an unverified new dependency mid-build; safe to add.
- **Rate limiting**: add `@nestjs/throttler` on `/auth/login` and `/auth/signup` at minimum, to blunt credential-stuffing/brute-force attempts.
- **Containerize**: a simple multi-stage `Dockerfile` (build stage with full `devDependencies` → slim runtime stage with `npm ci --omit=dev` + `dist/`) plus a `docker-compose.yml` wiring the API to a Mongo replica-set container is the standard next step.
- **Logging**: `LoggingInterceptor` currently logs to stdout via Nest's built-in `Logger`. In production, pipe stdout to a log aggregator (CloudWatch/Datadog/ELK) rather than adding a logging library — keeps the app simple and 12-factor.

## 10. Implementation Roadmap (if continuing from here)

1. Stand up a Mongo replica set locally, run `npm run start:dev`, smoke-test the flows in Postman/Insomnia (signup → login → browse products → cart → checkout → admin marks shipped → review).
2. Build the Coupon module (§7.1) — the one diagram-adjacent gap most likely to be needed soon.
3. Wire one real payment gateway end-to-end (recommend eSewa or Khalti first, given the `NPR` currency default) including its webhook.
4. Add e2e tests for checkout and payment confirmation.
5. Add `helmet`, `@nestjs/throttler`, and structured request-ID logging before any public deployment.
