# Leave Management System (MERN)

Employees apply for leave, managers approve or reject requests from their own team, and admins manage users, reporting lines and holidays.

**Stack:** React 18 + Vite · Node.js + Express · MongoDB (Mongoose) · JWT + bcrypt

---

## Features

| Role | What they can do |
|---|---|
| **Employee** | See leave balance (available / used / pending), apply for leave (date range or half day) with a live working-day count, view their leave history with filters and pagination, withdraw pending requests, and cancel approved future leave (days are returned) |
| **Manager** | Everything an employee can do, plus a **Team requests** page with a pending badge in the menu: filter by status, type or employee; approve with an optional comment; reject with a required comment |
| **Admin** | Dashboard with organisation stats; **Users** (create, edit, change role, assign manager, reset password, deactivate/reactivate, search and filter); **Holidays** (add, edit and delete per year); **All leaves** (organisation-wide, with filters; can **approve/reject any pending request**, e.g. for users who have no manager) |

Leave types and yearly allowance: **Casual 12**, **Sick 8**, **Paid 15** days.

---

## Setup

**Requirements:** Node.js 18+ (tested on 22), and MongoDB, either local or Atlas. Transactions need a replica set; Atlas clusters, including the free tier, are replica sets.

```bash
# 1. Install all dependencies (root, server, client)
npm run install:all

# 2. Configure the server
cp server/.env.example server/.env
#    then edit server/.env: set MONGO_URI and a long random JWT_SECRET

# 3. Create the admin + sample users and sample holidays (safe to re-run)
npm run seed

# 4. Start API (http://localhost:5000) and web app (http://localhost:5173)
npm run dev
```

Open **http://localhost:5173**.

### Environment variables (`server/.env`)

| Variable | Example | Purpose |
|---|---|---|
| `PORT` | `5000` | API port |
| `MONGO_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/leave_management_system` | Database connection |
| `JWT_SECRET` | long random string | Signs login tokens. The server refuses to start without it |
| `JWT_EXPIRES_IN` | `1d` | Token lifetime |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin |

The client needs no `.env`: in development Vite proxies `/api` to `http://localhost:5000`.

### Scripts (run from the project root)

| Command | What it does |
|---|---|
| `npm run dev` | API (auto-restarts with nodemon) and React app together |
| `npm run seed` | Creates any missing seed users and holidays. **Never modifies or deletes existing data** |
| `npm test` | Runs the API test suite against an in-memory MongoDB. **Never touches your real database** |
| `npm run check:data` | **Read-only** integrity report on your real database: balances = yearly total − approved days, no overlaps, valid managers, complete review records |
| `npm run build` | Production build of the React app (`client/dist`) |

---

## Demo accounts (created by `npm run seed`)

Password for all accounts: **`Password@123`**

| Email | Role | Reports to |
|---|---|---|
| `admin@example.com` | Admin | — |
| `manager1@example.com` | Manager | — |
| `manager2@example.com` | Manager | Manager One |
| `employee1@example.com`, `employee2@example.com` | Employee | Manager One |
| `employee3@example.com`, `employee4@example.com` | Employee | Manager Two |

In development, the login page has **Demo accounts** buttons that fill these in.

---

## Business rules (all enforced on the backend)

**Applying**
- Only employees and managers can apply. A request goes to the applicant's manager; if they have no manager (e.g. a top-level manager), an admin reviews it.
- The start date can't be in the past, the end date can't be before the start date, and a single request can span at most 366 days.
- **Weekends and admin holidays are not counted.** A range made up only of weekends or holidays is refused.
- A half day is only allowed when the start and end date are the same, and counts as 0.5.
- **Pending and approved leaves cannot overlap** your other pending or approved leaves, **of any leave type** (an approved casual day also blocks sick or paid leave on that day). The apply form shows the clash before you submit, and the server enforces it.
- **Balance check:** `available = balance − days already pending`. Pending requests reserve their days, so you can't over-request across several pending requests.
- The day count is fixed when you apply. Holidays added or removed later don't change existing requests.

**Reviewing (manager)**
- A manager can only review leaves of their **current** team: users whose `manager` is them. Another team's leave returns `404`, so its existence isn't revealed.
- **Admins can review any pending leave.** Nobody can review their own leave.
- Only **pending** leaves can be approved or rejected. **Approved, rejected and cancelled are final.**
- **Approval deducts the balance.** The balance is re-checked atomically, so it can never go negative.
- A rejection requires a comment of at least 3 characters. For an approval the comment is optional.

**Cancelling (employee)**
- **Pending:** cancelled. Nothing was deducted, and the reserved days are freed.
- **Approved and starting in the future:** cancelled, and **the days are returned** to the balance.
- **Approved and already started, or rejected, or cancelled:** refused.

**Users (admin)**
- Users are **deactivated, never deleted**, so their leave history is kept. Deactivated users can't sign in, and their existing tokens stop working immediately.
- A manager must be an active user with the `manager` role. Self-management and circular reporting lines are refused.
- A manager with active team members can't be demoted or deactivated until the team is reassigned.
- An admin can't change their own role or deactivate themselves, so they can't lock themselves out.
- A user with pending or upcoming approved leave can't be made an admin until those leaves are resolved (admins can't apply for or cancel leave).
- Leave balances can't be edited directly. They change only through approval and cancellation.

**Concurrency:** apply, approve, reject and cancel run inside **MongoDB transactions** with status-guarded updates. Double clicks, an approval racing a cancellation, or two simultaneous applications can't corrupt balances or create overlaps. Each of these cases has a test.

---

## API reference

All endpoints are under `/api`. Errors always have the shape `{ "message": "..." }` with the appropriate status code (400, 401, 403, 404 or 409).

| Method | Endpoint | Who | Description |
|---|---|---|---|
| POST | `/auth/login` | public | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | any | Current user (manager populated) |
| GET | `/users` | admin | List: `page, limit, search, role, isActive, manager` |
| POST | `/users` | admin | Create user |
| GET / PATCH | `/users/:id` | admin | Get or update user (name, email, password, role, manager, isActive) |
| GET | `/holidays` | any | List: `year, page, limit` |
| POST / PATCH / DELETE | `/holidays[/:id]` | admin | Manage holidays (`{ name, date: "YYYY-MM-DD" }`) |
| GET | `/leaves/calculate` | any | Preview working days: `startDate, endDate, halfDay` |
| GET | `/leaves/balance` | any | Per type: total, balance, pending, available |
| POST | `/leaves` | employee, manager | Apply `{ leaveType, startDate, endDate, halfDay, reason }` |
| GET | `/leaves/my` | employee, manager | Own leaves: `status, leaveType, page, limit` (+ `canCancel`) |
| PATCH | `/leaves/:id/cancel` | employee, manager | Cancel own leave |
| GET | `/leaves/team` | manager | Team leaves: `status, leaveType, search, page, limit` |
| PATCH | `/leaves/:id/approve` | manager (own team), admin (any) | `{ comment? }` |
| PATCH | `/leaves/:id/reject` | manager (own team), admin (any) | `{ comment }` (required) |
| GET | `/leaves/all` | admin | All leaves: `status, leaveType, search, page, limit` |

`server/requests.http` contains ready-to-run examples for the VS Code **REST Client** extension.

---

## Project structure

```
server/
  src/
    config/        env validation, DB connection, constants (roles, leave types, statuses)
    models/        User, Leave, Holiday
    services/      leaveService (apply/cancel/review, transactions), leaveDays (holiday-aware day count)
    controllers/   auth, users, holidays, leaves
    middleware/    auth (protect + authorize roles), error handler
    utils/         ApiError, dates, workingDays, pagination, token
    seed/          idempotent seed for users + holidays
  tests/           node:test + supertest, in-memory MongoDB replica set
client/
  src/
    api/           fetch wrapper (token, errors, 401 → session expired) + endpoint modules
    context/       AuthContext (login, logout, session restore)
    components/    ui/ (Button, fields, Modal, ConfirmDialog, Toast, Pagination, …), layout/, route guards
    pages/         login, dashboards, leaves/, team/, admin/
    styles/        design tokens + base, components, layout, pages
```

---

## Testing

**Automated API tests:** `npm test`. There are 135 tests covering:
- auth, role guards, user management rules, holidays
- the working-day calculator: weekends, holidays, half day, month, year and leap-year boundaries
- apply validation, overlaps and balance reservation
- cancellation and restoration
- manager team scoping, approve/reject, and final status
- race conditions: concurrent apply, double approve, approve vs reject, approve vs cancel

The tests run on an in-memory MongoDB replica set, so they never touch real data.

**Data integrity:** `npm run check:data` (read-only) verifies the real database is consistent.

**Quick UI walkthrough:** see *How to test everything* below.

### How to test everything (about 10 minutes)

1. **Admin** (`admin@example.com`)
   - The dashboard shows user counts and pending requests.
   - **Users:**
     - Add a user, and try a duplicate email.
     - Edit them.
     - Try to deactivate Manager One. This is refused because Manager One still has a team.
     - Deactivate, then reactivate, the new user.
   - **Holidays:** add a holiday on a weekday next week.
2. **Employee** (`employee1@example.com`)
   - **Apply leave** for Mon–Fri of that week. The summary shows **4 days** and names your holiday. Submit.
   - Apply again for a single day with **Half day**, which uses 0.5.
   - Try overlapping dates of any leave type (the form shows the clash and disables Submit; the API also returns 409) and too many sick days (button disabled with a reason).
3. **Manager** (`manager1@example.com`)
   - The menu shows **Team requests (2)**, and the dashboard shows "Waiting for your approval".
   - **Reject** the half day: a comment is required.
   - **Approve** the 4-day leave: the dialog shows balance 12 → 8.
4. **Employee again**
   - The balance shows **8**, and **My leaves** shows the rejected request with the manager's comment.
   - **Cancel** the approved leave: the balance returns to **12**.
5. **Manager Two** (`manager2@example.com`) applies, and **Manager One** approves it. This shows managers have approvers too. **Manager One** (no manager) applies, and the request goes to admins.
6. **Admin → All leaves:** every request, with status tabs and search. **Approve** Manager One's request here.
7. **Role guards:** as an employee, open `/admin/users`, and as an admin, open `/team`. Both redirect to the dashboard.
8. **Responsive:** in browser DevTools (`Ctrl + Shift + M`), check phone width. The menu becomes a drawer and tables become cards.

---

## Assumptions

- **Balances are per calendar year**, starting at 12/8/15. Automatic reset or carry-over on 1 January isn't implemented; see below. A leave that crosses into the next year is charged entirely to the current balance.
- **Dates are calendar dates in UTC.** "Today" for "no past start date" and "future leave can be cancelled" uses the server's UTC date. For UTC+5:30 (India) this lets you apply for today at any hour.
- A **leave that has started** (start date today or earlier) can't be cancelled.
- **Two half days on the same date** count as overlapping. Choosing a morning or afternoon half isn't modelled.
- **Admins don't apply for leave.** Approval belongs to each employee's manager; admins can also review any pending request (needed for users without a manager).
- When an employee is **reassigned** to another manager, their pending requests move to the new manager.
- Holiday changes don't change the day count of requests that already exist.
- There is **no public sign-up**. The admin creates accounts.
- The JWT is stored in `localStorage`, which is simple and standard for this scope. An httpOnly cookie would be more resistant to XSS.

## Not implemented / possible next steps

- Yearly balance reset and carry-over job
- Email or in-app notifications on approve/reject
- Login rate limiting and account lockout
- Self-service password change and forgot-password flow
- Leave reports and export (CSV)
