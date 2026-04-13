import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { rankDonors, classifyUrgency, detectFakeRequest } from '../utils/ai';

import type { BloodGroup, UrgencyLevel } from '../types';

interface Props {
  page: string;
  onNavigate?: (page: string) => void;
}

export default function ReceiverDashboard({ page, onNavigate }: Props) {
    const { user, donors, requests, addRequest, completeDonation, startConversation } = useApp();

  // Find Donors — fetched directly from API
  const [findDonorsList, setFindDonorsList] = useState<any[]>([]);
  const [findDonorsLoading, setFindDonorsLoading] = useState(false);
  const [findBloodFilter, setFindBloodFilter] = useState('all');
  const [findAvailOnly, setFindAvailOnly] = useState(false);

  const fetchFindDonors = useCallback(async () => {
    setFindDonorsLoading(true);
    try {
      const data = await api<any>('/donors/compatible');
      setFindDonorsList(data.donors || []);
    } catch { /* silently fail */ } finally {
      setFindDonorsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (page === 'find-donors') fetchFindDonors();
  }, [page, fetchFindDonors]);

  // New Request Form
  const [formData, setFormData] = useState({
    bloodGroup: 'O+' as BloodGroup,
    units: 1,
    hospital: '',
    address: '',
    description: '',
    lat: 0,
    lng: 0,
  });
  const [showResult, setShowResult] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  const myRequests = requests.filter(r => r.receiverId === user?.id);
  const openRequests = myRequests.filter(r => r.status === 'open');
  const fulfilledRequests = myRequests.filter(r => r.status === 'fulfilled');

  // AI urgency classification preview
  const urgencyPreview = useMemo(() => {
    if (!formData.description) return null;
    return classifyUrgency(formData.description, formData.units, formData.bloodGroup);
  }, [formData.description, formData.units, formData.bloodGroup]);

  // AI Match — fetched from API using the request's actual location
  const [matchedDonors, setMatchedDonors] = useState<any[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);

  const loadMatches = useCallback(async (reqId: string) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;
    setMatchLoading(true);
    try {
      const data = await api<any>(`/donors/compatible?bloodGroup=${encodeURIComponent(req.bloodGroup)}`);
      const fetchedDonors: DonorProfile[] = (data.donors || []).map((d: any) => ({
        userId: d.userId?._id || d.userId,
        name: d.userId?.name || d.userName || d.name || 'Unknown',
        email: d.userId?.email || d.userEmail || '',
        phone: d.userId?.phone || '',
        bloodGroup: d.bloodGroup,
        lat: d.location?.coordinates?.[1] ?? d.lat ?? 0,
        lng: d.location?.coordinates?.[0] ?? d.lng ?? 0,
        address: d.address || '',
        available: d.available ?? true,
        lastDonationDate: d.lastDonationDate || '',
        totalDonations: d.totalDonations || 0,
        donationHistory: d.donationHistory || [],
        healthScore: d.healthScore || 85,
        age: d.age || 0,
        weight: d.weight || 0,
      }));
      const ranked = rankDonors(fetchedDonors, req, 99999);
      setMatchedDonors(ranked);
    } catch { setMatchedDonors([]); } finally {
      setMatchLoading(false);
    }
  }, [requests]);

  const handleToggleMatch = (reqId: string) => {
    if (selectedRequest === reqId) {
      setSelectedRequest(null);
      setMatchedDonors([]);
    } else {
      setSelectedRequest(reqId);
      loadMatches(reqId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fakeCheck = detectFakeRequest({
      id: '', receiverId: user?.id || '', receiverName: user?.name || '',
      ...formData, urgency: 'normal' as UrgencyLevel, status: 'open', createdAt: '',
    });

    if (fakeCheck.isSuspicious) {
      alert(`Request flagged as suspicious (Risk: ${fakeCheck.riskScore}%). Reasons: ${fakeCheck.flags.join(', ')}`);
      return;
    }

    const urgency = classifyUrgency(formData.description, formData.units, formData.bloodGroup);
    await addRequest({
      receiverId: user?.id || '',
      receiverName: user?.name || '',
      ...formData,
      lat: 0,
      lng: 0,
      urgency: urgency.level,
    });
    setShowResult(true);
    setTimeout(() => setShowResult(false), 3000);
    setFormData({ bloodGroup: 'O+', units: 1, hospital: '', address: '', description: '', lat: 0, lng: 0 });
  };

  // New Request Page
  if (page === 'new-request') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Blood Request</h1>
          <p className="text-gray-500">AI will automatically classify urgency and match donors</p>
        </div>

        {showResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
            <div>
              <p className="font-semibold text-green-800">Request Created Successfully</p>
              <p className="text-sm text-green-600">Matching compatible donors in your area.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Blood Group Needed</label>
              <select
                value={formData.bloodGroup}
                onChange={e => setFormData(p => ({ ...p, bloodGroup: e.target.value as BloodGroup }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-white"
              >
                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Units Required</label>
              <input
                type="number"
                min={1}
                max={10}
                value={formData.units}
                onChange={e => setFormData(p => ({ ...p, units: parseInt(e.target.value) || 1 }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Hospital Name</label>
            <input
              type="text"
              required
              value={formData.hospital}
              onChange={e => setFormData(p => ({ ...p, hospital: e.target.value }))}
              placeholder="e.g., Bellevue Hospital Center"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Hospital Address</label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
              placeholder="e.g., 462 1st Ave, New York, NY 10016"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              placeholder="Describe the medical situation and urgency..."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
            />
          </div>

          {/* AI Urgency Preview */}
          {urgencyPreview && (
            <div className={`rounded-xl p-4 border ${
              urgencyPreview.level === 'critical' ? 'bg-red-50 border-red-200' :
              urgencyPreview.level === 'moderate' ? 'bg-amber-50 border-amber-200' :
              'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <p className="font-semibold text-sm">Urgency Classification</p>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  urgencyPreview.level === 'critical' ? 'bg-red-200 text-red-800' :
                  urgencyPreview.level === 'moderate' ? 'bg-amber-200 text-amber-800' :
                  'bg-green-200 text-green-800'
                }`}>
                  {urgencyPreview.level.toUpperCase()}
                </span>
                <span className="text-sm text-gray-600">Confidence: {urgencyPreview.confidence}%</span>
              </div>
              <ul className="space-y-1">
                {urgencyPreview.reasons.map((r, i) => (
                  <li key={i} className="text-xs text-gray-600">• {r}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-3.5 rounded-xl font-semibold transition shadow-lg shadow-red-200"
          >
            Submit Blood Request
          </button>
        </form>
      </div>
    );
  }

  // My Requests Page
  if (page === 'my-requests') {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">My Blood Requests</h1>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-200 text-center">
            <p className="text-2xl font-bold text-gray-900">{myRequests.length}</p>
            <p className="text-sm text-gray-500">Total Requests</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-200 text-center">
            <p className="text-2xl font-bold text-orange-600">{openRequests.length}</p>
            <p className="text-sm text-gray-500">Open</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-200 text-center">
            <p className="text-2xl font-bold text-green-600">{fulfilledRequests.length}</p>
            <p className="text-sm text-gray-500">Verified</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-50">
              {myRequests.length === 0 ? (
                <div className="p-8 text-center bg-gray-50">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                  </div>
                  <h3 className="font-semibold text-gray-800">No requests yet</h3>
                  <p className="text-gray-500 text-sm mt-1">Create a new blood request to see it here.</p>
                </div>
              ) : myRequests.map(req => (
              <div key={req.id} className="p-5 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold ${
                      req.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                      req.urgency === 'moderate' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {req.bloodGroup}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{req.hospital}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{req.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          req.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                          req.urgency === 'moderate' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>{req.urgency}</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          req.status === 'open' ? 'bg-blue-100 text-blue-700' :
                          req.status === 'matched' ? 'bg-purple-100 text-purple-700' :
                          req.status === 'fulfilled' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{req.status === 'fulfilled' ? 'verified' : req.status}</span>
                        <span className="text-xs text-gray-400">{req.units} units</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{new Date(req.createdAt).toLocaleDateString()}</p>
                    {req.status === 'open' && (
                      <button
                        onClick={() => handleToggleMatch(req.id)}
                        className="mt-2 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition"
                      >
                        {selectedRequest === req.id ? 'Hide Matches' : 'View AI Matches'}
                      </button>
                    )}
                  </div>
                </div>

                {/* AI Matched Donors */}
                {selectedRequest === req.id && (
                  <div className="mt-4 bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-sm text-gray-700 mb-3">Compatible Donors</h4>
                    {matchLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        Finding nearby donors...
                      </div>
                    ) : matchedDonors.length === 0 ? (
                      <p className="text-sm text-gray-500">No compatible donors found in the area.</p>
                    ) : (
                      <div className="space-y-2">
                        {matchedDonors.slice(0, 5).map((m, i) => (
                          <div key={i} className="bg-white rounded-lg p-3 flex items-center gap-3 border border-gray-100">
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-xs font-bold text-red-600">
                              #{i + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm text-gray-800">{m.donor.name}</p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
                                <span className="bg-red-50 text-red-600 font-semibold px-1.5 py-0.5 rounded">{m.donor.bloodGroup}</span>
                                <span className={m.donor.available ? 'text-green-600 font-medium' : 'text-gray-400'}>
                                  {m.donor.available ? '● Available' : '● Unavailable'}
                                </span>
                                {(m.donor as any).phone && (
                                  <a href={`tel:${(m.donor as any).phone}`} className="text-blue-600 hover:underline">📞 {(m.donor as any).phone}</a>
                                )}
                                {m.donor.address && (
                                  <span className="text-gray-400">{m.donor.address.split(',').slice(-2).join(',').trim()}</span>
                                )}
                              </div>
                            </div>
                              <div className="flex flex-col items-end gap-2">
                                <div className="text-right">
                                  <p className="text-lg font-bold text-green-600">{m.score}%</p>
                                  <p className="text-xs text-gray-400">AI Score</p>
                                </div>
                                <button
                                  onClick={() => { startConversation(m.donor.userId, m.donor.name); if (onNavigate) onNavigate('chat'); }}
                                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition"
                                >
                                  Message
                                </button>
                                <button 
                                  onClick={() => completeDonation(req.id, m.donor.userId)}
                                  className="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg font-medium transition"
                                >
                                  Verify Donation
                                </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Find Donors Page
  if (page === 'find-donors') {
    const filteredDonors = findDonorsList.filter(d => {
      if (findAvailOnly && !d.available) return false;
      if (findBloodFilter !== 'all' && d.bloodGroup !== findBloodFilter) return false;
      return true;
    });

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Find Compatible Donors</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={findBloodFilter}
              onChange={e => setFindBloodFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-red-500"
            >
              <option value="all">All Blood Types</option>
              {['O+','O-','A+','A-','B+','B-','AB+','AB-'].map(bg => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={findAvailOnly} onChange={e => setFindAvailOnly(e.target.checked)} className="accent-red-500" />
              Available only
            </label>
            <button onClick={fetchFindDonors} className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium transition">
              Refresh
            </button>
          </div>
        </div>

        {findDonorsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm">Loading donors...</p>
          </div>
        ) : filteredDonors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <p className="text-sm">No donors found</p>
            <p className="text-xs mt-1">Try changing the blood type filter</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDonors.map(d => {
              const donorUser = d.userId?.name || d.userName || d.name || 'Unknown';
              const uid = d.userId?._id || d.userId || d._id;
              const phone = d.userId?.phone || d.phone || '';
              const addr = (d.address || '').split(',').slice(-2).join(',');
              return (
                <div key={uid} className="bg-white rounded-2xl p-5 border border-gray-200 hover:shadow-lg transition">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-sm font-bold text-red-600">{d.bloodGroup}</div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{donorUser}</p>
                        <p className="text-xs text-gray-400">{addr || 'Address not set'}</p>
                        {phone && <a href={`tel:${phone}`} className="text-xs text-blue-600 hover:underline">📞 {phone}</a>}
                      </div>
                    </div>
                    <span className={`w-3 h-3 rounded-full ${d.available ? 'bg-green-500' : 'bg-gray-300'}`} title={d.available ? 'Available' : 'Unavailable'}></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-sm font-bold text-gray-800">{d.totalDonations ?? 0}</p>
                      <p className="text-xs text-gray-500">Donations</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-sm font-bold text-gray-800">{d.healthScore ?? 85}%</p>
                      <p className="text-xs text-gray-500">Health</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-sm font-bold text-gray-800">{d.available ? '✓' : '✗'}</p>
                      <p className="text-xs text-gray-500">Ready</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => { startConversation(uid, donorUser); if (onNavigate) onNavigate('chat'); }}
                      className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium py-2 rounded-xl text-sm transition"
                    >
                      Message Donor
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Default: Receiver Dashboard
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-linear-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4"></div>
        <div className="relative">
          <h1 className="text-2xl font-bold mb-1">Welcome, {user?.name}</h1>
          <p className="text-blue-100">Find compatible blood donors quickly using our AI-powered matching system.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 text-center">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          </div>
          <p className="text-2xl font-bold text-gray-900">{myRequests.length}</p>
          <p className="text-sm text-gray-500">Total Requests</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200 text-center">
          <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center mx-auto mb-2">
            <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <p className="text-2xl font-bold text-orange-600">{openRequests.length}</p>
          <p className="text-sm text-gray-500">Open Requests</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200 text-center">
          <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center mx-auto mb-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          </div>
          <p className="text-2xl font-bold text-green-600">{fulfilledRequests.length}</p>
          <p className="text-sm text-gray-500">Fulfilled</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200 text-center">
          <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center mx-auto mb-2">
            <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <p className="text-2xl font-bold text-blue-600">{donors.filter(d => d.available).length}</p>
          <p className="text-sm text-gray-500">Available Donors</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Requests */}
        <div className="bg-white rounded-2xl border border-gray-200">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Recent Requests</h3>
          </div>
          <div className="divide-y divide-gray-50">
              {myRequests.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  You haven't made any requests yet.
                </div>
              ) : myRequests.slice(0, 4).map(req => (
              <div key={req.id} className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                  req.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                  req.urgency === 'moderate' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>{req.bloodGroup}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">{req.hospital}</p>
                  <p className="text-xs text-gray-500">{req.units} units • {req.urgency}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  req.status === 'open' ? 'bg-blue-100 text-blue-700' :
                  req.status === 'fulfilled' ? 'bg-green-100 text-green-700' :
                  'bg-purple-100 text-purple-700'
                }`}>{req.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="bg-linear-to-r from-red-500 to-pink-600 rounded-2xl p-6 text-white">
            <h3 className="font-semibold text-lg mb-2">Critical Requests</h3>
            <p className="text-3xl font-bold">{myRequests.filter(r => r.urgency === 'critical' && r.status === 'open').length}</p>
            <p className="text-red-100 text-sm mt-1">Active critical requests needing immediate attention</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3">Blood Group Distribution</h3>
            <div className="grid grid-cols-4 gap-2">
              {(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as BloodGroup[]).map(bg => (
                <div key={bg} className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-sm font-bold text-red-600">{bg}</p>
                  <p className="text-xs text-gray-500">{donors.filter(d => d.bloodGroup === bg).length} donors</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



