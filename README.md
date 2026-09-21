# 🎬 OneTake — Event Management System

A full-stack event production management platform for Lights, Sounds, Video & Photography services.

---

## 🧑‍💼 Stakeholders

| Role | Description |
|------|-------------|
| **Admin** | Full control — manage events, quotations, payments, freelancers & equipment |
| **Client** | Submit inquiries, review quotations, pay downpayment/balance, download deliverables |
| **Freelancer** | View assigned events, check-in on event day, access checklist & chat |

---

## ✨ Features

- **10-Step Workflow**: Inquiry → Assessment → Quotation → Payment → Assignment → Execution → Completion
- **Real-time Notifications**: Socket.io push + email (Nodemailer)
- **Video Conferencing**: Built-in WebRTC peer-to-peer video calls with in-meeting chat
- **Quotation Builder**: Dynamic line items for services, equipment, and manpower
- **Payment System**: GCash/bank upload with admin verification
- **Resource Assignment**: Suggest & assign freelancers and equipment with double-booking prevention
- **Pre-Event Checklist**: Admin-managed, trackable checklist
- **Event Chat**: Real-time messaging between all stakeholders
- **Deliverables**: Upload and share video/photo links with clients
- **Reports & Analytics**: Financial summaries, revenue charts

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6+ (local or Atlas)
- npm

### 1. Install dependencies

```bash
# From root
npm run install:all
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your MongoDB URI, email credentials, etc.
```

### 3. Seed the database

```bash
cd backend && npm run seed
```

**Demo accounts created:**
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@onetake.com | admin123 |
| Client | client@onetake.com | client123 |
| Freelancer | audio@onetake.com | freelancer123 |

### 4. Run development servers

```bash
# From root (runs both backend + frontend)
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api

---

## 🐳 Docker Deployment

```bash
docker-compose up -d
```

---

## 📁 Project Structure

```
onetake/
├── backend/
│   └── src/
│       ├── config/         # DB connection
│       ├── controllers/    # Route handlers
│       ├── middleware/     # Auth middleware
│       ├── models/         # Mongoose schemas
│       ├── routes/         # Express routes
│       ├── services/       # Email + notifications
│       ├── socket/         # Socket.io setup
│       └── utils/          # Resource suggestion, seed
└── frontend/
    └── src/
        ├── components/
        │   ├── layouts/    # Admin, Client, Freelancer layouts
        │   └── shared/     # Reusable UI components
        ├── pages/
        │   ├── admin/      # Admin portal pages
        │   ├── client/     # Client portal pages
        │   └── freelancer/ # Freelancer portal pages
        ├── services/       # API + Socket.io client
        ├── store/          # Zustand state management
        └── utils/          # Helpers, formatters
```

---

## 🔧 Environment Variables

```env
# Required
MONGODB_URI=mongodb://localhost:27017/onetake
JWT_SECRET=your_secret_key

# Email (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password

# Optional (for file uploads)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## 📱 Tech Stack

**Backend:** Node.js, Express, MongoDB (Mongoose), Socket.io, Nodemailer, JWT, Multer

**Frontend:** React 18, Vite, Tailwind CSS, Zustand, Recharts, Socket.io-client, React Router v6

**Video Calls:** WebRTC (native browser API) + Socket.io signaling server

---

## 🎯 Workflow Steps

1. **Inquiry Received** — Client submits event form
2. **Needs Assessed** — Admin schedules video call, fills in assessment
3. **Quotation Sent** — Admin creates & sends itemized quotation
4. **Confirmed** — Client approves quotation, submits 50% downpayment
5. **Assigned** — Admin assigns freelancers & equipment
6. **Pre-Event** — Checklist prepared, reminders sent
7. **In Progress** — Event day, freelancers check in
8. **Completed (Pending Balance)** — Event done, balance due
9. **Completed (Paid)** — Balance verified, fully paid
10. **Deliverables** — Videos & photos uploaded for client

---

*Built with ❤️ by OneTake*
