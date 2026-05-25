# Agency CRM — Multi-Tenant SaaS Platform

A production-ready, multi-tenant CRM built for Digital Marketing Agencies. Supports multi-workspace organizations with role-based access, lead pipeline management, invoicing, quotations, content calendar, real-time notifications, and webhook integrations.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Chart.js, @hello-pangea/dnd, Socket.io-client |
| Backend | Node.js, Express.js, Sequelize ORM, Socket.io |
| Database | MySQL 8 |
| Auth | JWT HS256 (7-day expiry), bcrypt (12 rounds) |
| PDF | PDFKit |
| Email | Nodemailer |
| Container | Docker + docker-compose |
| Reverse Proxy | Nginx (React Router SPA support) |

---

## Quick Start (Docker)

### 1. Clone and configure

```bash
git clone <repo-url>
cd latest_crm
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET and SMTP credentials
```

### 2. Start all services

```bash
docker-compose up -d --build
```

### 3. Seed demo data (first run)

```bash
# In .env set SEED_DB=true, then restart server
docker-compose restart server
# After seeding, set SEED_DB=false to prevent re-seeding
```

Access the app at **http://localhost**

---

## Development Setup (without Docker)

### Prerequisites
- Node.js 18+
- MySQL 8 running locally

### Server

```bash
cd server
cp ../.env.example .env   # edit DB credentials
npm install
npm run dev               # starts on port 5000
```

### Client

```bash
cd client
echo "REACT_APP_API_URL=http://localhost:5000" > .env
npm install
npm start                 # starts on port 3000
```

---

## Seed Credentials

After running the seed script, the following demo accounts are created:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@crm.com | SuperAdmin@123 |
| Owner | owner@sunrisedigital.com | Owner@123456 |
| Admin (Real Estate) | admin.realestate@sunrisedigital.com | Admin@123456 |
| Agent 1 | agent1.realestate@sunrisedigital.com | Agent@123456 |
| Agent 2 | agent2.realestate@sunrisedigital.com | Agent@123456 |
| Designer | designer.realestate@sunrisedigital.com | Designer@123 |
| Admin (Education) | admin.education@sunrisedigital.com | Admin@123456 |

> Credentials are also printed to the server console during seeding.

---

## User Roles

| Role | Access |
|------|--------|
| `superadmin` | Platform-wide — manages all orgs, plans, billing |
| `owner` | Organization-wide — manages workspaces, users, settings, sees all revenue |
| `admin` | Workspace-scoped — manages leads, team, reports |
| `agent` | Workspace-scoped — manages assigned/workspace leads, followups, appointments |
| `designer` | Content calendar only |

---

## Plan Tiers

| Plan | Price | Workspaces | Users | Leads | PDF | Webhooks | Reports |
|------|-------|-----------|-------|-------|-----|----------|---------|
| Trial | Free | 1 | 5 | 100 | ✗ | ✗ | ✗ |
| Starter | ₹2,999/mo | 2 | 15 | 1,000 | ✓ | ✗ | ✗ |
| Growth | ₹5,999/mo | 5 | 50 | 10,000 | ✓ | ✓ | ✓ |
| Agency | ₹11,999/mo | 20 | 200 | 100,000 | ✓ | ✓ | ✓ |

---

## Webhook Endpoints

Each organization has a unique `webhookToken` (UUID). Webhook URLs follow this pattern:

```
POST /webhooks/meta/:token
POST /webhooks/google/:token
POST /webhooks/website/:token
POST /webhooks/whatsapp/:token
POST /webhooks/instagram/:token
```

### Finding your token
The webhook token is stored in the Organization record. Owners can view it in Settings (future UI feature), or retrieve it via the API:
```
GET /api/organizations/settings  →  webhookToken field
```

### Meta Webhook Verification
```
GET /webhooks/meta/:token?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<challenge>
```

### Website Lead Webhook (simple POST)
```json
POST /webhooks/website/:token
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "message": "Interested in your services",
  "source": "Website"
}
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | `localhost` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_NAME` | Database name | `crm_db` |
| `DB_USER` | DB username | `crm_user` |
| `DB_PASS` | DB password | `crm_pass` |
| `JWT_SECRET` | **Change in production** | — |
| `PORT` | Server port | `5000` |
| `CLIENT_URL` | Frontend URL (CORS) | `http://localhost:3000` |
| `SMTP_HOST` | Platform SMTP host | — |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password | — |
| `SMTP_FROM` | From address | — |
| `SEED_DB` | Seed demo data on boot | `false` |
| `REACT_APP_API_URL` | API base URL (build-time) | `http://localhost:5000` |

---

## API Overview

All API routes are prefixed with `/api`. Auth required (JWT Bearer token) unless noted.

```
POST   /api/auth/login
GET    /api/auth/me
PUT    /api/auth/profile
PUT    /api/auth/password

GET    /api/leads
POST   /api/leads
GET    /api/leads/:id
PUT    /api/leads/:id
DELETE /api/leads/:id
GET    /api/leads/pipeline
POST   /api/leads/:id/note
POST   /api/leads/import/csv

GET    /api/followups
POST   /api/followups
PUT    /api/followups/:id
POST   /api/followups/:id/complete
POST   /api/followups/:id/cancel

GET    /api/appointments
POST   /api/appointments
PUT    /api/appointments/:id
DELETE /api/appointments/:id

GET    /api/quotations
POST   /api/quotations
GET    /api/quotations/:id
PUT    /api/quotations/:id
PUT    /api/quotations/:id/status
GET    /api/quotations/:id/pdf
POST   /api/quotations/:id/email

GET    /api/invoices
POST   /api/invoices
GET    /api/invoices/:id
GET    /api/invoices/:id/pdf

GET    /api/payments
POST   /api/payments
GET    /api/payments/stats

GET    /api/content
POST   /api/content
PUT    /api/content/:id
DELETE /api/content/:id
GET    /api/content/calendar/:year/:month

GET    /api/reports/dashboard
GET    /api/reports/advanced

GET    /api/notifications
GET    /api/notifications/unread-count
POST   /api/notifications/:id/read
POST   /api/notifications/read-all

GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id

POST   /api/communication/call
POST   /api/communication/whatsapp
POST   /api/communication/email
GET    /api/communication/calls

GET    /api/organizations/dashboard
GET    /api/organizations/workspaces
POST   /api/organizations/workspaces
GET    /api/organizations/settings
PUT    /api/organizations/settings

GET    /api/superadmin/dashboard
GET    /api/superadmin/organizations
POST   /api/superadmin/organizations
GET    /api/superadmin/organizations/:id
PUT    /api/superadmin/organizations/:id
DELETE /api/superadmin/organizations/:id
POST   /api/superadmin/organizations/:id/suspend
POST   /api/superadmin/organizations/:id/unsuspend
GET    /api/superadmin/plans
PUT    /api/superadmin/plans/:id
```

---

## Deployment

### Render.com (Backend) + Vercel (Frontend)

**Backend on Render:**
1. Create a new Web Service pointing to the `server/` directory
2. Build command: `npm install`
3. Start command: `node src/server.js`
4. Add all environment variables from `.env.example`
5. Add a MySQL database (Render managed or PlanetScale)

**Frontend on Vercel:**
1. Import the `client/` directory
2. Set `REACT_APP_API_URL` to your Render backend URL
3. Add `vercel.json` for SPA routing:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

### Self-hosted with Docker
```bash
# Production with custom domain
CLIENT_URL=https://crm.yourdomain.com \
REACT_APP_API_URL=https://api.yourdomain.com \
JWT_SECRET=$(openssl rand -hex 32) \
docker-compose up -d --build
```

---

## Socket.io Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `notification` | Server → Client | New in-app notification |
| `new_lead` | Server → Client | Lead created/assigned in workspace |
| `followup_reminder` | Server → Client | Followup due reminder |
| `appointment_reminder` | Server → Client | Appointment coming up in 30 min |

Rooms used: `user:{id}`, `workspace:{id}`, `org:{id}`

---

## Data Architecture

- Every business data table has `organizationId` + `workspaceId` columns
- Every query is scoped through both — no cross-tenant data leakage
- Plan limits are enforced by middleware before every create operation
- Soft deletes via `isActive = false` (users, organizations)
- All timestamps stored UTC, displayed IST via `moment-timezone('Asia/Kolkata')`

---

## License

MIT
