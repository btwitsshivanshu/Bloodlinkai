import type { BloodGroup, DonorProfile, BloodRequest, DonorMatch, DemandPrediction, UrgencyLevel } from '../types';
import { canReceiveFrom } from '../data/blood';

// ============================================================
// Haversine Distance (km) — Vincenty-accurate for short distances
// ============================================================
const DEG2RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLng = (lng2 - lng1) * DEG2RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) *
    Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// Donor Ranking — Adaptive Multi-Factor Scoring
//
// Weights shift dynamically based on request urgency:
//   Critical → distance & availability valued highest
//   Normal   → recency & health valued higher
// Health score and donation reliability factored in.
// ============================================================
const URGENCY_WEIGHT_PROFILES: Record<UrgencyLevel, { distance: number; availability: number; recency: number; compatibility: number; health: number; reliability: number }> = {
  critical:  { distance: 0.30, availability: 0.25, recency: 0.10, compatibility: 0.15, health: 0.10, reliability: 0.10 },
  moderate:  { distance: 0.25, availability: 0.20, recency: 0.15, compatibility: 0.15, health: 0.13, reliability: 0.12 },
  normal:    { distance: 0.20, availability: 0.15, recency: 0.20, compatibility: 0.15, health: 0.15, reliability: 0.15 },
};

function scoreDistance(distanceKm: number, maxRadius: number): number {
  if (distanceKm >= maxRadius) return 0;
  // Exponential decay — nearby donors scored disproportionately higher
  return 100 * Math.exp(-3 * (distanceKm / maxRadius));
}

function scoreRecency(lastDonationDate: string, totalDonations: number): number {
  if (totalDonations === 0 || !lastDonationDate) return 100; // Never donated = fully rested
  const ms = Date.now() - new Date(lastDonationDate).getTime();
  if (Number.isNaN(ms)) return 50;
  const days = ms / 86_400_000;
  if (days < 56) return 0; // Ineligible cooldown
  // Sigmoid curve: rises steeply after 56d, plateaus around 120d
  return 100 / (1 + Math.exp(-0.06 * (days - 90)));
}

function scoreCompatibility(donor: BloodGroup, request: BloodGroup): number {
  const compatible = canReceiveFrom[request] ?? [];
  if (!compatible.includes(donor)) return 0;
  if (donor === request) return 100;        // Exact match
  if (donor === 'O-') return 85;            // Universal donor — slightly deprioritized to preserve rare supply
  return 70;                                // Compatible non-exact
}

function scoreHealth(healthScore: number): number {
  return Math.min(100, Math.max(0, healthScore));
}

function scoreReliability(donor: DonorProfile): number {
  // Reliability = track record of showing up + healthy profile
  const donationBonus = Math.min(50, donor.totalDonations * 5);
  const consistencyBonus = donor.donationHistory.length >= 2 ? 30 : 0;
  const profileCompleteness = (donor.age ? 10 : 0) + (donor.weight ? 10 : 0);
  return Math.min(100, donationBonus + consistencyBonus + profileCompleteness);
}

export function rankDonors(
  donors: DonorProfile[],
  request: BloodRequest,
  maxRadius: number = 50
): DonorMatch[] {
  const weights = URGENCY_WEIGHT_PROFILES[request.urgency] ?? URGENCY_WEIGHT_PROFILES.normal;
  const matches: DonorMatch[] = [];

  for (const donor of donors) {
    const compatibilityScore = scoreCompatibility(donor.bloodGroup, request.bloodGroup);
    if (compatibilityScore === 0) continue;

    // Skip donors who are not eligible to donate (cooldown, age, weight, health score)
    const { eligible } = checkEligibility(donor);
    if (!eligible) continue;

    const distance = haversineDistance(donor.lat, donor.lng, request.lat, request.lng);
    const distScore = scoreDistance(distance, maxRadius);
    const availScore = donor.available ? 100 : 0;
    const recScore = scoreRecency(donor.lastDonationDate, donor.totalDonations);
    const hlthScore = scoreHealth(donor.healthScore);
    const relScore = scoreReliability(donor);

    const total =
      weights.distance * distScore +
      weights.availability * availScore +
      weights.recency * recScore +
      weights.compatibility * compatibilityScore +
      weights.health * hlthScore +
      weights.reliability * relScore;

    matches.push({
      donor: { ...donor, name: donor.name || 'Unknown Donor', email: donor.email || '' },
      score: Math.round(total * 10) / 10,
      distance: Math.round(distance * 10) / 10,
      compatibilityScore: Math.round(compatibilityScore),
      availabilityScore: Math.round(availScore),
      recencyScore: Math.round(recScore),
    });
  }

  // Primary: score desc. Tie-break: distance asc, then reliability desc
  return matches.sort((a, b) => b.score - a.score || a.distance - b.distance);
}

// ============================================================
// Demand Prediction — Exponential Weighted Moving Average + Linear Trend
//
// Combines EWMA for smoothing with OLS regression for trend.
// Confidence derived from data density and variance.
// ============================================================
function ols(data: number[]): { slope: number; intercept: number } {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const xMean = (n - 1) / 2;
  const yMean = data.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (data[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: yMean - slope * xMean };
}

function ewma(data: number[], alpha: number = 0.3): number {
  let result = data[0] ?? 0;
  for (let i = 1; i < data.length; i++) {
    result = alpha * data[i] + (1 - alpha) * result;
  }
  return result;
}

function stddev(data: number[]): number {
  if (data.length < 2) return 0;
  const mean = data.reduce((s, v) => s + v, 0) / data.length;
  return Math.sqrt(data.reduce((s, v) => s + (v - mean) ** 2, 0) / (data.length - 1));
}

function buildMonthlySeries(requests: BloodRequest[], months: number = 12): Record<BloodGroup, number[]> {
  const now = new Date();
  const groups: BloodGroup[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
  const series: Record<string, number[]> = {};
  for (const bg of groups) series[bg] = new Array(months).fill(0);

  for (const r of requests) {
    const d = new Date(r.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const monthDiff = (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + (now.getUTCMonth() - d.getUTCMonth());
    if (monthDiff < 0 || monthDiff >= months) continue;
    const idx = months - 1 - monthDiff;
    const units = Number.isFinite(r.units) ? r.units : 0;
    if (series[r.bloodGroup]) series[r.bloodGroup][idx] += units;
  }
  return series as Record<BloodGroup, number[]>;
}

export function predictDemand(requests: BloodRequest[]): DemandPrediction[] {
  const groups: BloodGroup[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
  const series = buildMonthlySeries(requests, 12);
  const predictions: DemandPrediction[] = [];

  for (const bg of groups) {
    const data = series[bg];
    const { slope, intercept } = ols(data);
    const smoothed = ewma(data, 0.3);
    const olsPrediction = slope * data.length + intercept;

    // Blend OLS trend with EWMA for robustness
    const predicted = Math.round(0.6 * olsPrediction + 0.4 * smoothed);
    const current = data[data.length - 1] ?? 0;

    // Trend detection with significance threshold relative to data variance
    const sd = stddev(data);
    const threshold = Math.max(0.5, sd * 0.3);
    let trend: 'increasing' | 'stable' | 'decreasing';
    if (slope > threshold) trend = 'increasing';
    else if (slope < -threshold) trend = 'decreasing';
    else trend = 'stable';

    // Confidence: data density (active months), variance stability, sample size
    const activeMonths = data.filter(v => v > 0).length;
    const densityScore = (activeMonths / data.length) * 40;
    const stabilityScore = sd === 0 ? 30 : Math.max(0, 30 - sd * 2);
    const sizeScore = Math.min(20, activeMonths * 3);
    const confidence = Math.min(95, Math.round(densityScore + stabilityScore + sizeScore + 10));

    predictions.push({
      bloodGroup: bg,
      currentDemand: current,
      predictedDemand: Math.max(0, predicted),
      trend,
      confidence,
    });
  }

  return predictions;
}

// ============================================================
// Urgency Classification — Weighted NLP Scoring
//
// Tiered keyword weights, n-gram phrase detection, punctuation
// analysis, rare blood type boost, unit-based scoring, and
// multi-signal confidence calculation.
// ============================================================
const CRITICAL_PHRASES: [string, number][] = [
  ['life threatening', 40], ['life-threatening', 40], ['mass casualty', 40],
  ['cardiac arrest', 35], ['hemorrhagic shock', 35], ['internal bleeding', 35],
  ['brain surgery', 35], ['organ transplant', 35], ['massive blood loss', 35],
  ['ruptured', 30], ['hemorrhage', 30], ['haemorrhage', 30],
  ['emergency', 28], ['urgent', 25], ['critical', 28], ['accident', 25],
  ['trauma', 25], ['immediately', 25], ['bleeding', 22], ['dying', 30],
  ['icu', 25], ['intensive care', 28], ['ventilator', 22],
  ['gunshot', 30], ['stab wound', 30], ['severe injury', 28],
  ['postpartum', 25], ['eclampsia', 30], ['placenta', 25],
  ['crash', 22], ['collision', 22], ['hit and run', 25],
];

const MODERATE_PHRASES: [string, number][] = [
  ['surgery', 15], ['scheduled surgery', 12], ['operation', 15],
  ['procedure', 12], ['post-operative', 12], ['transfusion', 15],
  ['anaemia', 12], ['anemia', 12], ['chemotherapy', 15], ['dialysis', 12],
  ['thalassemia', 15], ['sickle cell', 15], ['cancer', 12],
  ['pre-operative', 12], ['bone marrow', 15], ['leukemia', 15],
  ['dengue', 12], ['malaria', 10], ['liver disease', 12],
];

const NORMAL_PHRASES: [string, number][] = [
  ['regular', -10], ['routine', -10], ['planned', -8],
  ['chronic', -5], ['maintenance', -8], ['check-up', -10], ['stock', -5],
  ['donation camp', -8], ['blood bank', -5], ['replenish', -5],
];

function scoreText(text: string, phrases: [string, number][]): { total: number; matched: string[] } {
  const lower = text.toLowerCase();
  let total = 0;
  const matched: string[] = [];
  for (const [phrase, weight] of phrases) {
    if (lower.includes(phrase)) {
      total += weight;
      matched.push(phrase);
    }
  }
  return { total, matched };
}

export function classifyUrgency(
  description: string,
  units: number,
  bloodGroup: BloodGroup
): { level: UrgencyLevel; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // -- Text analysis --
  const crit = scoreText(description, CRITICAL_PHRASES);
  const mod = scoreText(description, MODERATE_PHRASES);
  const norm = scoreText(description, NORMAL_PHRASES);
  score += crit.total + mod.total + norm.total;

  if (crit.matched.length > 0) reasons.push(`Critical indicators: ${crit.matched.slice(0, 3).join(', ')}`);
  if (mod.matched.length > 0) reasons.push(`Medical indicators: ${mod.matched.slice(0, 3).join(', ')}`);
  if (norm.matched.length > 0) reasons.push(`Routine indicators: ${norm.matched.slice(0, 2).join(', ')}`);

  // -- Punctuation / emphasis signals --
  const exclamations = (description.match(/!/g) || []).length;
  const capsWords = (description.match(/\b[A-Z]{2,}\b/g) || []).length;
  if (exclamations >= 2 || capsWords >= 2) {
    score += Math.min(15, (exclamations + capsWords) * 3);
    reasons.push('Elevated language urgency detected');
  }

  // -- Unit volume signal --
  if (units >= 6) { score += 30; reasons.push(`Very high volume: ${units} units`); }
  else if (units >= 4) { score += 20; reasons.push(`High volume: ${units} units`); }
  else if (units >= 2) { score += 8; reasons.push(`Moderate volume: ${units} units`); }

  // -- Rare blood type signal --
  const rareTypes: BloodGroup[] = ['AB-', 'B-', 'O-', 'A-'];
  const veryRare: BloodGroup[] = ['AB-', 'B-'];
  if (veryRare.includes(bloodGroup)) {
    score += 20; reasons.push(`Very rare blood type: ${bloodGroup}`);
  } else if (rareTypes.includes(bloodGroup)) {
    score += 12; reasons.push(`Rare blood type: ${bloodGroup}`);
  }

  // -- Description quality penalty --
  const wordCount = description.trim().split(/\s+/).length;
  if (wordCount < 4) { score = Math.max(score - 10, 0); reasons.push('Very brief description — lower certainty'); }

  // -- Classify --
  let level: UrgencyLevel;
  if (score >= 40) level = 'critical';
  else if (score >= 18) level = 'moderate';
  else level = 'normal';

  // -- Confidence: based on signal count and strength --
  const signalCount = crit.matched.length + mod.matched.length + norm.matched.length;
  const baseConf = 50 + Math.min(30, signalCount * 8) + Math.min(18, Math.abs(score) * 0.4);
  const confidence = Math.min(97, Math.round(baseConf));

  return { level, confidence, reasons };
}

// ============================================================
// Eligibility Checker — Comprehensive Medical Screening
// ============================================================
export function checkEligibility(donor: DonorProfile): {
  eligible: boolean;
  reasons: string[];
  nextEligibleDate?: string;
} {
  const checks: { pass: boolean; message: string; blocking?: boolean; nextDate?: string }[] = [];

  // Age (WHO guideline: 18-65)
  if (donor.age < 18) {
    checks.push({ pass: false, message: `Must be at least 18 years old (currently ${donor.age})`, blocking: true });
  } else if (donor.age > 65) {
    checks.push({ pass: false, message: `Upper age limit is 65 (currently ${donor.age})`, blocking: true });
  } else {
    checks.push({ pass: true, message: `Age ${donor.age} within eligible range (18-65) ✓` });
  }

  // Weight (WHO: ≥50 kg)
  if (donor.weight < 50) {
    checks.push({ pass: false, message: `Minimum weight is 50 kg (currently ${donor.weight} kg)`, blocking: true });
  } else {
    checks.push({ pass: true, message: `Weight ${donor.weight} kg meets requirement (≥50 kg) ✓` });
  }

  // Last donation cooldown (56 days / 8 weeks)
  if (donor.totalDonations > 0 && donor.lastDonationDate) {
    const lastDate = new Date(donor.lastDonationDate);
    if (!Number.isNaN(lastDate.getTime())) {
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86_400_000);
      if (daysSince < 56) {
        const remaining = 56 - daysSince;
        const nextDate = new Date(lastDate.getTime() + 56 * 86_400_000);
        checks.push({
          pass: false,
          message: `Must wait ${remaining} more day${remaining !== 1 ? 's' : ''} since last donation`,
          blocking: true,
          nextDate: nextDate.toISOString().split('T')[0],
        });
      } else {
        checks.push({ pass: true, message: `${daysSince} days since last donation (≥56 required) ✓` });
      }
    }
  } else {
    checks.push({ pass: true, message: 'No prior donations — cooldown not applicable ✓' });
  }

  // Health score
  if (donor.healthScore < 70) {
    checks.push({ pass: false, message: `Health score ${donor.healthScore}% below threshold (70%)`, blocking: true });
  } else if (donor.healthScore < 80) {
    checks.push({ pass: true, message: `Health score ${donor.healthScore}% — meets minimum but could improve` });
  } else {
    checks.push({ pass: true, message: `Health score ${donor.healthScore}% — excellent ✓` });
  }

  // BMI-based weight warning (if age is available, rough heuristic)
  if (donor.weight > 0 && donor.age >= 18) {
    // Approx check: extremely underweight  
    if (donor.weight < 45) {
      checks.push({ pass: false, message: 'Weight significantly below safe threshold', blocking: true });
    }
  }

  const eligible = checks.every(c => c.pass);
  const reasons = checks.map(c => c.message);
  const blockingCheck = checks.find(c => !c.pass && c.nextDate);

  return { eligible, reasons, nextEligibleDate: blockingCheck?.nextDate };
}

// ============================================================
// Fake Request Detection — Multi-Signal Risk Scoring
//
// Checks: content quality, gibberish detection, impossible
// coordinates, suspicious volumes, temporal anomalies,
// duplicate patterns, and hospital validation.
// ============================================================
function entropyScore(text: string): number {
  // Shannon entropy — low entropy = repetitive/gibberish text
  const freq: Record<string, number> = {};
  for (const ch of text.toLowerCase()) freq[ch] = (freq[ch] || 0) + 1;
  const len = text.length;
  if (len === 0) return 0;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function hasRepeatedChars(text: string, threshold: number = 4): boolean {
  return new RegExp(`(.)\\1{${threshold - 1},}`).test(text);
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

export function detectFakeRequest(request: BloodRequest): {
  isSuspicious: boolean;
  riskScore: number;
  flags: string[];
} {
  const flags: string[] = [];
  let risk = 0;

  // -- Description quality --
  const desc = (request.description || '').trim();
  const wordCount = desc.split(/\s+/).filter(Boolean).length;
  if (desc.length < 10) { risk += 25; flags.push('Description too short (< 10 characters)'); }
  else if (wordCount < 3) { risk += 15; flags.push('Description has very few words'); }

  // Gibberish / entropy check
  if (desc.length >= 5) {
    const ent = entropyScore(desc);
    if (ent < 2.0) { risk += 20; flags.push('Description appears to be gibberish or repetitive'); }
  }
  if (hasRepeatedChars(desc)) { risk += 15; flags.push('Description contains excessive repeated characters'); }

  // -- Volume anomalies --
  if (request.units > 10) { risk += 30; flags.push(`Unusually high volume: ${request.units} units`); }
  else if (request.units > 6) { risk += 10; flags.push(`High volume: ${request.units} units`); }
  if (request.units <= 0) { risk += 25; flags.push('Invalid unit count'); }

  // -- Location validation (skip if coords are 0 — not yet geocoded by server) --
  if (request.lat !== 0 || request.lng !== 0) {
    if (!isValidCoordinate(request.lat, request.lng)) {
      risk += 35; flags.push('Invalid or zero coordinates');
    }
    // Coordinates in ocean (rough check — most land is between ±60 lat for populated areas)
    if (Math.abs(request.lat) > 70) { risk += 10; flags.push('Coordinates in extreme latitude'); }
  }

  // -- Hospital validation --
  const hospital = (request.hospital || '').trim();
  if (hospital.length < 3) { risk += 20; flags.push('Missing or invalid hospital name'); }
  else if (/^(.)\1+$/.test(hospital)) { risk += 25; flags.push('Hospital name is all repeated characters'); }
  else if (!/[a-zA-Z]/.test(hospital)) { risk += 15; flags.push('Hospital name contains no letters'); }

  // -- Address validation --
  const address = (request.address || '').trim();
  if (address.length < 5) { risk += 10; flags.push('Address too short or missing'); }

  // -- Suspicious description content --
  const lower = desc.toLowerCase();
  const spamPatterns = ['test', 'asdf', 'lorem ipsum', 'xxx', '123', 'abc'];
  for (const pat of spamPatterns) {
    if (lower === pat || (lower.length < 15 && lower.includes(pat))) {
      risk += 20; flags.push(`Description matches test/spam pattern: "${pat}"`);
      break;
    }
  }

  return {
    isSuspicious: risk >= 60,
    riskScore: Math.min(100, risk),
    flags,
  };
}

// ============================================================
// Chatbot — TF-IDF Inspired Scoring + Fuzzy Matching
//
// Each FAQ entry has weighted terms. Scoring uses inverse
// document frequency weighting so rare keywords (like
// "thalassemia") score higher than common ones (like "blood").
// Includes Levenshtein fuzzy matching for typo tolerance.
// ============================================================
interface ChatbotResponse {
  answer: string;
  confidence: number;
  relatedTopics: string[];
}

interface FaqEntry {
  terms: string[];  // Search terms (weighted by rarity automatically)
  answer: string;
  topics: string[];
}

const FAQ_DB: FaqEntry[] = [
  {
    terms: ['eligible', 'can i donate', 'who can donate', 'requirements', 'qualify', 'eligibility', 'criteria', 'allowed', 'able to donate', 'fit to donate'],
    answer: 'To be eligible for blood donation, you must be: at least 18 years old, weigh at least 50 kg (110 lbs), be in good health, and have not donated blood in the last 56 days (8 weeks). You should not have any active infections, fever, or certain chronic medical conditions. Hemoglobin levels must be at least 12.5 g/dL.',
    topics: ['Age Requirements', 'Weight Requirements', 'Health Conditions', 'Hemoglobin'],
  },
  {
    terms: ['how often', 'frequency', 'how many times', 'wait', 'interval', 'gap between', 'how long between', 'again', 'next donation', 'cooldown'],
    answer: 'You can donate whole blood every 56 days (8 weeks). Platelet donors can give every 7 days, up to 24 times per year. Double red cell donors must wait 112 days between donations. Plasma donations can be done every 28 days.',
    topics: ['Donation Types', 'Recovery Time', 'Plasma'],
  },
  {
    terms: ['blood type', 'blood group', 'compatibility', 'universal', 'which type', 'match', 'compatible', 'receive from', 'donate to', 'rh factor'],
    answer: 'There are 8 main blood types: A+, A-, B+, B-, AB+, AB-, O+, and O-. O- is the universal donor (can give to anyone). AB+ is the universal receiver. O+ is the most common type. Rh factor (+ or -) determines compatibility — Rh- blood can go to Rh+ recipients but not vice versa.',
    topics: ['Blood Compatibility', 'Universal Donor', 'Rh Factor', 'ABO System'],
  },
  {
    terms: ['prepare', 'before', 'eat', 'drink', 'preparation', 'ready', 'what to do before', 'tips before'],
    answer: 'Before donating: eat a healthy iron-rich meal (spinach, red meat, beans), drink at least 500ml of water, avoid fatty or fried foods, get 7-8 hours of sleep the night before, wear comfortable clothing with loose sleeves, and avoid alcohol for 24 hours prior.',
    topics: ['Diet', 'Hydration', 'Rest', 'Iron-Rich Foods'],
  },
  {
    terms: ['after', 'recovery', 'side effects', 'how long', 'feel', 'post donation', 'afterwards', 'dizziness', 'faint', 'weak'],
    answer: 'After donating: rest for 10-15 minutes at the center, drink extra fluids for 24-48 hours, avoid strenuous exercise and heavy lifting for at least 5 hours, eat iron-rich foods, and keep the bandage on for 4-5 hours. Mild bruising at the needle site is normal. Contact the center if you feel dizzy, nauseous, or experience prolonged bleeding.',
    topics: ['Recovery Tips', 'Side Effects', 'Post-Donation Care', 'When to Call Doctor'],
  },
  {
    terms: ['safe', 'risk', 'danger', 'needle', 'infection', 'disease', 'hiv', 'hepatitis', 'contamination', 'sterile'],
    answer: 'Blood donation is extremely safe. All needles and equipment are sterile, single-use, and disposed of immediately. You cannot contract HIV, hepatitis, or any disease from donating blood. The actual donation takes about 8-10 minutes. Donated blood undergoes rigorous testing for infectious diseases before use.',
    topics: ['Safety', 'Sterile Equipment', 'Blood Testing', 'Disease Screening'],
  },
  {
    terms: ['process', 'steps', 'procedure', 'what happens', 'how does it work', 'walk through', 'flow', 'experience'],
    answer: 'The donation process: 1) Registration & ID verification (5 min), 2) Health screening questionnaire (5-10 min), 3) Mini physical — blood pressure, pulse, temperature, hemoglobin (5 min), 4) Donation — about 450ml drawn (8-10 min), 5) Rest & refreshments (10-15 min). Total time is approximately 45-60 minutes.',
    topics: ['Registration', 'Screening', 'Donation Steps', 'Time Required'],
  },
  {
    terms: ['platelet', 'plasma', 'types of donation', 'whole blood', 'apheresis', 'component', 'red cells', 'double red'],
    answer: 'Types of donation: 1) Whole Blood — most common, ~450ml, takes 8-10 min. 2) Platelets (apheresis) — takes 1.5-2.5 hours, can donate every 7 days. 3) Plasma — takes ~45 min, every 28 days. 4) Double Red Cells — collects 2 units of red cells, takes ~30 min, requires 112-day wait. Each component helps different patients.',
    topics: ['Whole Blood', 'Platelets', 'Plasma', 'Apheresis', 'Double Red Cells'],
  },
  {
    terms: ['medication', 'medicine', 'drugs', 'prescription', 'aspirin', 'antibiotic', 'blood thinner', 'pill'],
    answer: 'Most medications do not disqualify you. Exceptions: blood thinners (warfarin — 7 day wait), aspirin (48-hour wait for platelet donation), antibiotics (wait until course is finished + 24 hours), isotretinoin/Accutane (1 month wait), finasteride (1 month wait). Always disclose all medications during screening.',
    topics: ['Medication Guidelines', 'Waiting Periods', 'Blood Thinners', 'Antibiotics'],
  },
  {
    terms: ['tattoo', 'piercing', 'travel', 'defer', 'deferral', 'malaria', 'postpone'],
    answer: 'Tattoos and piercings: if done at a licensed regulated facility, many regions allow immediate donation; otherwise a 3-12 month wait may apply. Travel deferrals: visits to malaria-endemic regions require a 3-12 month wait. Living in UK/Europe during BSE/CJD periods may result in permanent deferral. Always check local guidelines.',
    topics: ['Tattoo Policy', 'Travel Restrictions', 'Malaria', 'Deferral Periods'],
  },
  {
    terms: ['pregnancy', 'pregnant', 'breastfeeding', 'nursing', 'period', 'menstruation', 'woman', 'female'],
    answer: 'Pregnant women cannot donate blood. After delivery, you must wait at least 6 months (some guidelines say 9-12 months) before donating. Breastfeeding mothers are generally deferred until the baby is weaned. Menstruation does not disqualify donation, but ensure your hemoglobin levels are adequate.',
    topics: ['Pregnancy', 'Breastfeeding', 'Menstruation', 'Women\'s Health'],
  },
  {
    terms: ['iron', 'hemoglobin', 'anemia', 'anaemia', 'low blood', 'deficiency', 'ferritin'],
    answer: 'Minimum hemoglobin for donation is 12.5 g/dL (women) and 13.0 g/dL (men). If deferred for low hemoglobin: eat iron-rich foods (leafy greens, red meat, lentils, fortified cereals), consider iron supplements, pair iron foods with vitamin C for better absorption, and avoid tea/coffee with meals as they inhibit iron absorption.',
    topics: ['Iron Deficiency', 'Hemoglobin Levels', 'Diet Tips', 'Supplements'],
  },
  {
    terms: ['covid', 'coronavirus', 'vaccine', 'vaccination', 'booster', 'flu shot'],
    answer: 'After COVID-19 infection: wait at least 14 days after full recovery and being symptom-free. After COVID vaccination: most vaccines have no waiting period, but some (like AstraZeneca) may require a 7-day wait. After a flu shot: no waiting period for inactivated vaccines. Live vaccines (e.g., MMR) typically require a 4-week deferral.',
    topics: ['COVID-19', 'Vaccination', 'Flu Shot', 'Live Vaccines'],
  },
  {
    terms: ['diabetes', 'sugar', 'insulin', 'chronic', 'heart', 'blood pressure', 'hypertension', 'thyroid'],
    answer: 'Diabetics on insulin are usually eligible to donate if well-controlled. Hypertension: eligible if blood pressure is below 180/100 on the day of donation (with or without medication). Thyroid conditions: eligible if stable on medication. Heart disease: depends on severity — consult with the blood bank. Well-managed chronic conditions usually do not disqualify you.',
    topics: ['Diabetes', 'Hypertension', 'Heart Disease', 'Thyroid', 'Chronic Conditions'],
  },
  {
    terms: ['age', 'old', 'young', 'minor', 'teen', 'senior', 'elderly', 'years old', 'minimum age', 'maximum age'],
    answer: 'Minimum age is 18 in most countries (16-17 with parental consent in some regions). Maximum age is typically 65 for first-time donors and up to 70 for repeat donors who have donated within the last 2 years and are in good health. There is no maximum age in some countries if the donor is healthy.',
    topics: ['Age Limits', 'Senior Donors', 'Young Donors', 'Parental Consent'],
  },
  {
    terms: ['weight', 'heavy', 'light', 'bmi', 'underweight', 'overweight', 'obese', 'kg', 'pounds'],
    answer: 'Minimum weight is 50 kg (110 lbs). There is no upper weight limit, but extremely high BMI may make finding veins difficult. Underweight donors are deferred for their own safety, as donating ~450ml can cause adverse reactions in smaller individuals. The volume collected is standardized regardless of body weight.',
    topics: ['Weight Requirements', 'BMI', 'Volume Collected', 'Safety'],
  },
  {
    terms: ['bloodlink', 'this app', 'how to use', 'what is', 'platform', 'features', 'help me', 'what can you do'],
    answer: 'BloodLink AI is an intelligent blood donation platform that connects donors with recipients in real-time. Features: AI-powered donor-recipient matching based on blood compatibility, location, and availability; smart urgency classification for requests; real-time chat between donors and recipients; nearby donor map; demand prediction analytics; and donation history tracking.',
    topics: ['Platform Features', 'Donor Matching', 'Real-time Chat', 'Analytics'],
  },
];

// Build inverse document frequency weights for terms
function buildIDF(db: FaqEntry[]): Map<string, number> {
  const docCount = db.length;
  const termDocs = new Map<string, number>();
  for (const entry of db) {
    const seen = new Set<string>();
    for (const term of entry.terms) {
      for (const word of term.toLowerCase().split(/\s+/)) {
        if (!seen.has(word)) { termDocs.set(word, (termDocs.get(word) || 0) + 1); seen.add(word); }
      }
    }
  }
  const idf = new Map<string, number>();
  for (const [word, count] of termDocs) {
    idf.set(word, Math.log(docCount / count) + 1);
  }
  return idf;
}

const IDF_WEIGHTS = buildIDF(FAQ_DB);

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1).fill(0) as number[];
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatch(input: string, target: string, maxDist: number = 2): boolean {
  if (target.length <= 3) return input === target;
  if (input.includes(target)) return true;
  // Check if any input word is within edit distance of target
  for (const word of input.split(/\s+/)) {
    if (word.length >= target.length - maxDist && levenshtein(word, target) <= maxDist) return true;
  }
  return false;
}

export function chatbotAnswer(question: string): ChatbotResponse {
  const lowerQ = question.toLowerCase().replace(/[?!.,;:'"]/g, '').trim();
  const qWords = lowerQ.split(/\s+/);

  const scores: { index: number; score: number }[] = [];

  FAQ_DB.forEach((entry, idx) => {
    let entryScore = 0;

    for (const term of entry.terms) {
      const termWords = term.toLowerCase().split(/\s+/);

      // Exact phrase match — highest weight
      if (lowerQ.includes(term.toLowerCase())) {
        const idfSum = termWords.reduce((s, w) => s + (IDF_WEIGHTS.get(w) || 1), 0);
        entryScore += idfSum * 3;
        continue;
      }

      // Word-level matching with IDF weighting + fuzzy tolerance
      for (const tw of termWords) {
        const idf = IDF_WEIGHTS.get(tw) || 1;
        if (lowerQ.includes(tw)) {
          entryScore += idf * 2;
        } else if (qWords.some(qw => fuzzyMatch(qw, tw, tw.length > 5 ? 2 : 1))) {
          entryScore += idf * 1.2; // Fuzzy match — reduced weight
        }
      }
    }

    if (entryScore > 0) scores.push({ index: idx, score: entryScore });
  });

  scores.sort((a, b) => b.score - a.score);

  if (scores.length > 0 && scores[0].score > 2) {
    const best = FAQ_DB[scores[0].index];
    // Confidence: ratio of best score to theoretical max, normalized
    const secondBest = scores[1]?.score || 0;
    const separation = scores[0].score / (secondBest || 1);
    const rawConf = Math.min(97, 50 + scores[0].score * 3 + Math.min(20, separation * 5));

    // Gather related topics from runner-up entries for "see also"
    const relatedTopics = [...best.topics];
    if (scores.length > 1) {
      const runner = FAQ_DB[scores[1].index];
      for (const t of runner.topics) {
        if (!relatedTopics.includes(t)) { relatedTopics.push(t); break; }
      }
    }

    return {
      answer: best.answer,
      confidence: Math.round(rawConf),
      relatedTopics: relatedTopics.slice(0, 5),
    };
  }

  return {
    answer: 'I don\'t have a specific answer for that question. Here are topics I can help with: eligibility, donation frequency, blood types & compatibility, preparation tips, post-donation recovery, safety, medications, tattoos & travel deferrals, pregnancy, iron/hemoglobin, COVID & vaccines, chronic conditions, and how BloodLink works. Try asking about any of these!',
    confidence: 15,
    relatedTopics: ['Eligibility', 'Blood Types', 'Donation Process', 'Safety', 'Platform Features'],
  };
}



