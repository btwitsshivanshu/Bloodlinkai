"""
BloodLink AI - Python AI Microservice
FastAPI endpoints for donor ranking, urgency classification,
demand prediction, eligibility checking, fraud detection, and chatbot.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import math
import re
from datetime import datetime

app = FastAPI(title="BloodLink AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ──────────────────────────────────────────────────

class DonorIn(BaseModel):
    id: str
    userId: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    bloodGroup: str
    lat: float
    lng: float
    available: bool = True
    lastDonationDate: Optional[str] = None
    totalDonations: int = 0
    healthScore: int = 85

class RequestIn(BaseModel):
    bloodGroup: str
    lat: float
    lng: float
    urgency: Optional[str] = "normal"

class RankRequest(BaseModel):
    request: RequestIn
    donors: list[DonorIn]

class UrgencyRequest(BaseModel):
    description: str
    units: int = 1
    bloodGroup: Optional[str] = None

class EligibilityRequest(BaseModel):
    age: int
    weight: float
    lastDonationDate: Optional[str] = None
    healthScore: int = 85

class FraudRequest(BaseModel):
    description: str
    units: int = 1
    hospital: Optional[str] = None

class ChatRequest(BaseModel):
    message: str

class PredictRequest(BaseModel):
    requests: list[dict] = []

# ── Helpers ─────────────────────────────────────────────────

def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def days_since(date_str: Optional[str]) -> int:
    if not date_str:
        return 999
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return (datetime.now(dt.tzinfo) - dt).days
    except Exception:
        return 999

# ── Endpoints ───────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "BloodLink AI"}

@app.post("/api/rank-donors")
def rank_donors(body: RankRequest):
    req = body.request
    scored = []
    for d in body.donors:
        if not d.available:
            continue
        dist = haversine(req.lat, req.lng, d.lat, d.lng)
        if dist > 100:
            continue
        dist_score = max(0, 100 - (dist / 50) * 100)
        days = days_since(d.lastDonationDate)
        recency_score = min(100, (days / 56) * 100) if days >= 56 else (days / 56) * 50
        health_score = d.healthScore
        avail_score = 100 if d.available else 0
        total = dist_score * 0.35 + recency_score * 0.25 + avail_score * 0.20 + health_score * 0.20
        scored.append({
            "donorId": d.id,
            "userId": d.userId,
            "name": d.name,
            "email": d.email,
            "bloodGroup": d.bloodGroup,
            "distance": round(dist, 1),
            "score": round(total),
            "distanceScore": round(dist_score),
            "recencyScore": round(recency_score),
            "availabilityScore": round(avail_score),
            "healthScore": round(health_score),
        })
    scored.sort(key=lambda x: x["score"], reverse=True)
    return {"rankedDonors": scored}


@app.post("/api/classify-urgency")
def classify_urgency(body: UrgencyRequest):
    text = body.description.lower()
    critical_kw = ["emergency", "urgent", "accident", "trauma", "hemorrhage", "life-threatening", "critical", "immediate", "severe", "dying"]
    moderate_kw = ["surgery", "scheduled", "operation", "procedure", "transfusion", "planned", "pre-operative"]
    crit_count = sum(1 for w in critical_kw if w in text)
    mod_count = sum(1 for w in moderate_kw if w in text)
    if crit_count >= 2 or (crit_count >= 1 and body.units >= 3):
        level, conf = "critical", min(95, 60 + crit_count * 12)
    elif mod_count >= 1 or body.units >= 3:
        level, conf = "moderate", min(90, 55 + mod_count * 10)
    else:
        level, conf = "normal", 70
    return {"level": level, "confidence": conf, "reasons": [f"Keyword matches: critical={crit_count}, moderate={mod_count}", f"Units requested: {body.units}"]}


@app.post("/api/predict-demand")
def predict_demand(body: PredictRequest):
    groups = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]
    predictions = []
    for bg in groups:
        count = sum(1 for r in body.requests if r.get("bloodGroup") == bg)
        predicted = max(1, round(count * 1.15))
        trend = "increasing" if predicted > count else ("decreasing" if predicted < count else "stable")
        predictions.append({"bloodGroup": bg, "currentDemand": count, "predictedDemand": predicted, "trend": trend, "confidence": 72})
    return {"predictions": predictions}


@app.post("/api/check-eligibility")
def check_eligibility(body: EligibilityRequest):
    reasons = []
    eligible = True
    if body.age < 18 or body.age > 65:
        eligible = False
        reasons.append(f"Age {body.age} is outside the 18-65 range")
    else:
        reasons.append(f"Age {body.age}: eligible")
    if body.weight < 50:
        eligible = False
        reasons.append(f"Weight {body.weight}kg is below 50kg minimum")
    else:
        reasons.append(f"Weight {body.weight}kg: eligible")
    days = days_since(body.lastDonationDate)
    if days < 56:
        eligible = False
        reasons.append(f"Last donation {days} days ago (need 56 day gap)")
    else:
        reasons.append(f"Last donation {days} days ago: eligible")
    if body.healthScore < 60:
        eligible = False
        reasons.append(f"Health score {body.healthScore}% is below 60%")
    return {"eligible": eligible, "reasons": reasons, "nextEligibleDate": None}


@app.post("/api/detect-fraud")
def detect_fraud(body: FraudRequest):
    flags = []
    risk = 0
    if len(body.description) < 10:
        flags.append("Description too short")
        risk += 30
    if body.units > 5:
        flags.append(f"Unusually high units: {body.units}")
        risk += 25
    if not body.hospital or len(body.hospital) < 3:
        flags.append("No hospital or very short name")
        risk += 20
    suspicious_patterns = [r"\b(test|fake|asdf|xxx)\b"]
    for p in suspicious_patterns:
        if re.search(p, body.description, re.IGNORECASE):
            flags.append("Suspicious keywords detected")
            risk += 30
            break
    return {"isSuspicious": risk >= 50, "riskScore": min(100, risk), "flags": flags}


@app.post("/api/chatbot")
def chatbot(body: ChatRequest):
    q = body.message.lower()
    answers = {
        "eligib": ("To be eligible to donate blood, you generally need to be between 18-65 years old, weigh at least 50kg, be in good health, and have waited at least 56 days since your last donation.", 90),
        "blood type": ("There are 8 main blood types: A+, A-, B+, B-, AB+, AB-, O+, O-. O- is the universal donor, and AB+ is the universal recipient.", 95),
        "how often": ("You can donate whole blood every 56 days (about 8 weeks). Platelet donors can give every 7 days, up to 24 times a year.", 92),
        "safe": ("Yes, blood donation is very safe. A sterile, single-use needle is used for each donor. The process is closely supervised by trained medical staff.", 88),
        "prepar": ("Before donating: drink plenty of water, eat iron-rich foods, get a good night's sleep, and avoid fatty foods. Bring a valid ID.", 85),
        "after": ("After donating: rest for 10-15 minutes, drink extra fluids, avoid heavy lifting for 24 hours, and eat iron-rich foods to help recovery.", 87),
        "long": ("The actual blood draw takes about 8-10 minutes. The entire process, including registration and a mini-physical, takes about 45-60 minutes.", 84),
    }
    for key, (ans, conf) in answers.items():
        if key in q:
            return {"answer": ans, "confidence": conf, "relatedTopics": ["Eligibility", "Blood Types", "Safety"]}
    return {
        "answer": "I can help with blood donation questions! Try asking about eligibility requirements, blood types, donation frequency, safety, or how to prepare.",
        "confidence": 60,
        "relatedTopics": ["Eligibility", "Blood Types", "Donation Process", "Safety", "Preparation"],
    }


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
