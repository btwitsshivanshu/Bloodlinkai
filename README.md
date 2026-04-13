# 🩸 BloodLink AI — Intelligent Blood Donation Platform

> A full-stack, AI-powered blood donation platform connecting donors and receivers in real time — built with a microservices architecture and deployed on AWS.

[![AWS ECS](https://img.shields.io/badge/Deployed-AWS%20ECS-orange?logo=amazon-aws)](https://aws.amazon.com/ecs/)
[![Docker](https://img.shields.io/badge/Containerized-Docker-blue?logo=docker)](https://www.docker.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?logo=node.js)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/AI%20Service-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?logo=mongodb)](https://www.mongodb.com/atlas)

---

## 🌐 Live Demo

**Frontend:** Hosted on AWS S3 (Static Website Hosting)  
**API Health:** `GET /api/health` → `{ status: 'ok' }`

---

## 📌 Overview

BloodLink AI solves a critical real-world problem: **connecting blood donors with patients in need — fast**. Traditional systems rely on manual calls and hospital directories. BloodLink automates the entire workflow with AI-driven matching, real-time notifications, and fraud detection.

### Key Differentiators
- 🤖 **AI Microservice** — Dedicated Python FastAPI service for ML-powered donor ranking, urgency classification, and fraud detection
- ⚡ **Real-time** — Socket.io for live chat, instant donor alerts, and typing indicators
- 🗺️ **Geospatial Search** — MongoDB `$geoNear` queries to find donors within radius
- 🔐 **Secure** — JWT auth, bcrypt, rate limiting, helmet, input validation, field injection prevention
- ☁️ **Cloud-Native** — Dockerized microservices on AWS ECS with ALB, ECR, and S3

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS Infrastructure                        │
│                                                             │
│  S3 (Static Frontend)                                       │
│       │                                                     │
│       ▼                                                     │
│  ALB (Application Load Balancer) ─── port 80               │
│       │                                                     │
│       ▼                                                     │
│  ECS Fargate ─── Node.js/Express (port 5000)                │
│       │                                                     │
│       ├──► MongoDB Atlas (cloud database)                   │
│       │                                                     │
│       └──► ECS Fargate ─── Python FastAPI (port 8000)       │
│                            AI Microservice                  │
└─────────────────────────────────────────────────────────────┘
```

### Services
| Service | Tech | Role |
|---------|------|------|
| **Frontend** | React 19 + TypeScript + Vite | SPA, hosted on S3 |
| **Backend API** | Node.js + Express + Socket.io | REST API + real-time |
| **AI Service** | Python + FastAPI + scikit-learn | Donor ranking, fraud detection |
| **Database** | MongoDB Atlas | Documents + geospatial index |
| **Container Registry** | AWS ECR | Docker image storage |
| **Load Balancer** | AWS ALB | Traffic distribution, health checks |

---

## 🤖 AI Features

All AI features run in a dedicated Python microservice — the Node.js backend calls it over HTTP, keeping concerns separated.

### 1. Smart Donor Ranking
Scores every compatible donor using a weighted formula across 4 factors:
- **Distance** (35%) — exponential decay, nearby donors scored disproportionately higher
- **Recency** (25%) — penalizes donors within 56-day WHO cooldown window
- **Availability** (20%) — only available donors score full points
- **Health Score** (20%) — donor health profile affects ranking

The client-side ranker uses 6 dynamic weights that **shift based on urgency** (critical requests prioritize distance & availability; normal requests weight recency & health more).

### 2. Urgency Classification
NLP keyword analysis on the request description auto-labels requests as `critical`, `moderate`, or `normal` — affecting notification priority and dashboard sorting.

### 3. Fraud Detection
Each new blood request is scored against heuristic signals:
- Description too short (< 10 characters)
- Unusually high unit count (> 5 units)
- Missing or suspicious hospital name
- Suspicious keywords (test, fake, etc.)

Requests are blocked automatically if risk score ≥ 50

### 4. Demand Prediction
Historical blood request data per blood group feeds a trend engine — the Admin dashboard shows predicted future demand with rising/falling indicators.

### 5. Eligibility Engine
Before ranking, donors are validated against WHO donation criteria:
- Age: 18–65
- Weight: ≥ 50kg
- Cooldown: 56 days since last donation
- No active health disqualifiers

### 6. AI Chatbot
A built-in blood donation Q&A assistant (available to all users) answers common questions — eligibility, blood types, preparation, safety — using TF-IDF inspired scoring with fuzzy keyword matching. Falls back to the Python AI microservice for complex queries.

---

## ⚡ Real-Time Features (Socket.io)

- **Blood request alerts** — All donors instantly notified when a new request is created
- **Live chat** — Full messaging system between donors and receivers
- **Typing indicators** — Real-time "is typing..." feedback
- **Status updates** — Request status changes pushed to all parties
- **JWT-authenticated sockets** — Every Socket.io connection verified server-side

---

## 🔒 Security

| Feature | Implementation |
|---------|---------------|
| Authentication | JWT (expiry + role-based) |
| Password storage | bcrypt (salt rounds: 12) |
| API protection | Rate limiting (100 req/15min) |
| HTTP security headers | helmet.js |
| Input validation | express-validator on all endpoints |
| Field injection prevention | Whitelist-only updates |
| Authorization checks | Ownership verified before mutations |
| ReDoS prevention | Regex-escaped search inputs |

---

## 🗂️ Project Structure

```
├── client/                  # React frontend (TypeScript)
│   └── src/
│       ├── pages/           # Dashboard, Landing, Chat, NearbyDonors...
│       ├── context/         # AppContext (state), SocketContext (real-time)
│       └── utils/           # api.ts, ai.ts, geocode.ts
│
├── server/                  # Node.js backend
│   └── src/
│       ├── controllers/     # auth, donor, request, chat, admin, ai...
│       ├── models/          # Mongoose schemas (User, DonorProfile, BloodRequest...)
│       ├── routes/          # Express routers
│       ├── middleware/       # JWT auth, validation
│       └── socket.js        # Socket.io event handlers
│
└── ai-service/              # Python AI microservice
    └── main.py              # FastAPI endpoints: rank, classify, detect, predict
```

---

## 🧪 Tech Stack

**Frontend**
- React 19, TypeScript, Vite (`vite-plugin-singlefile` — zero CDN dependency)
- Tailwind CSS, Leaflet.js (interactive maps)
- Socket.io client, Google OAuth (`@react-oauth/google`)

**Backend**
- Node.js, Express.js, Socket.io
- Mongoose (MongoDB ODM), JWT, bcryptjs
- helmet, express-rate-limit, express-validator, axios

**AI Service**
- FastAPI, Uvicorn, Pydantic
- scikit-learn, NumPy, pandas

**Infrastructure**
- AWS ECS Fargate (containerized backend + AI service)
- AWS ECR (Docker image registry)
- AWS S3 (static frontend hosting)
- AWS ALB (Application Load Balancer)
- MongoDB Atlas (managed cloud database)
- Docker + Dockerfiles for each service

---

## 🚀 Running Locally

### Prerequisites
- Node.js 18+, Python 3.11+, Docker, MongoDB

### 1. Backend
```bash
cd server
cp .env.example .env        # Add MONGODB_URI, JWT_SECRET
npm install
npm run dev                 # Starts on :5000
```

### 2. AI Service
```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend
```bash
cd client
npm install
npm run dev                 # Starts on :5173
```

> For local dev, update `client/src/utils/api.ts` → `BASE` to `http://localhost:5000/api`

---

## 📊 Data Flow — Blood Donation Lifecycle

```
Receiver creates request
        │
        ▼
AI classifies urgency (critical/moderate/normal)
        │
        ▼
Socket.io alerts all compatible donors in real-time
        │
        ▼
Donor accepts → Request status: open → matched
        │
        ▼
AI ranks matched donor (distance, recency, compatibility)
        │
        ▼
Receiver verifies donation → status: fulfilled
        │
        ▼
DonorProfile updated: totalDonations++, cooldown started,
donationHistory logged, available = false
```

---

## 👤 User Roles

| Role | Capabilities |
|------|-------------|
| **Receiver** | Create blood requests, AI-ranked donor search, live chat, track request status |
| **Donor** | Toggle availability, view compatible requests, donation history, geolocation map |
| **Admin** | Platform-wide stats, user management, AI insights dashboard, demand forecasting |

---

## 📸 Screenshots

> *(Add screenshots here — Landing page, Receiver Dashboard, AI Match results, Admin Dashboard, Live Chat)*

---

## 🛠️ Deployment

### Build & Push Docker Images
```bash
# Authenticate with ECR
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

# Build and push server
cd server
docker build -t server .
docker tag server:latest <account-id>.dkr.ecr.<region>.amazonaws.com/server:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/server:latest

# Build and push AI service
cd ai-service
docker build -t ai-service .
docker tag ai-service:latest <account-id>.dkr.ecr.<region>.amazonaws.com/ai-service:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/ai-service:latest
```

### Deploy Frontend to S3
```bash
cd client
npm run build
aws s3 cp dist/index.html s3://YOUR-BUCKET/index.html --content-type "text/html"
```

---

<div align="center">
  Built with ❤️ to save lives
</div>
