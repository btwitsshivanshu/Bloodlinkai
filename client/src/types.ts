// ============================================================
// BloodLink AI - Type Definitions
// ============================================================

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type UserRole = 'donor' | 'receiver' | 'admin';
export type UrgencyLevel = 'critical' | 'moderate' | 'normal';
export type RequestStatus = 'open' | 'matched' | 'fulfilled' | 'cancelled';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  phone: string;
  createdAt: string;
}

export interface DonorProfile {
  userId: string;
  name?: string;
  email?: string;
  bloodGroup: BloodGroup;
  lat: number;
  lng: number;
  address: string;
  available: boolean;
  lastDonationDate: string;
  totalDonations: number;
  donationHistory: DonationRecord[];
  healthScore: number;
  age: number;
  weight: number;
}

export interface DonationRecord {
  id?: string;
  _id?: string;
  date: string;
  location: string;
  receiverName: string;
  bloodGroup: BloodGroup;
  units: number;
}

export interface BloodRequest {
  id: string;
  receiverId: string;
  receiverName: string;
  bloodGroup: BloodGroup;
  units: number;
  urgency: UrgencyLevel;
  status: RequestStatus;
  lat: number;
  lng: number;
  address: string;
  hospital: string;
  description: string;
  createdAt: string;
  matchedDonorId?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface ChatConversation {
  id: string;
  participantIds: string[];
  participantNames: string[];
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'request' | 'match' | 'message' | 'system';
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
  link?: string;
}

export interface DonorMatch {
  donor: DonorProfile & { name: string; email: string };
  score: number;
  distance: number;
  compatibilityScore: number;
  availabilityScore: number;
  recencyScore: number;
}

export interface DemandPrediction {
  bloodGroup: BloodGroup;
  currentDemand: number;
  predictedDemand: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  confidence: number;
}

export interface AdminStats {
  totalDonors: number;
  activeDonors: number;
  totalReceivers: number;
  totalRequests: number;
  activeRequests: number;
  fulfilledRequests: number;
  totalDonations: number;
  avgResponseTime: number;
}
