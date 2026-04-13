import { useApp } from '../context/AppContext';
import { checkEligibility } from '../utils/ai';
import { canReceiveFrom } from '../data/blood';

interface Props {
  page: string;
  onNavigate?: (page: string) => void;
}

export default function DonorDashboard({ page, onNavigate }: Props) {
  const { user, donors, requests, toggleAvailability } = useApp();

  const profile = donors.find(d => d.userId === user?.id);

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading profile data...</p>
      </div>
    );
  }

  const eligibility = checkEligibility(profile);
  // Filter for requests that are open AND compatible with the donor's blood group AND not created by the current user
  const openRequests = requests.filter(r => 
    r.status === 'open' && r.bloodGroup && canReceiveFrom[r.bloodGroup]?.includes(profile.bloodGroup)
    && r.receiverId !== user?.id
  );
  const matchedRequests = requests.filter(r => r.matchedDonorId === user?.id);
  if (page === 'requests') {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Active Blood Requests</h1>
            <p className="text-gray-500">Live requests matching your blood group ({profile.bloodGroup})</p>
          </div>
          <div className="bg-red-50 rounded-xl px-5 py-3 text-center">
            <p className="text-2xl font-bold text-red-600">{openRequests.length}</p>
            <p className="text-xs text-red-600/70">Open Matches</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {openRequests.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No active requests match your blood group right now.</div>
            ) : openRequests.map(req => (
              <div key={req.id} className="p-5 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                      req.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                      req.urgency === 'moderate' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {req.bloodGroup}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-base">{req.receiverName || 'Unknown Patient'} • {req.hospital}</p>
                      <p className="text-sm text-gray-600 mt-1">{req.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          req.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                          req.urgency === 'moderate' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {req.urgency.charAt(0).toUpperCase() + req.urgency.slice(1)} Urgency
                        </span>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{req.units} units required</span>
                        <span className="text-xs text-gray-400">{req.address.split(',').slice(-2).join(', ')}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{new Date(req.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (page === 'history') {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Donation History</h1>
            <p className="text-gray-500">Track your contribution to saving lives</p>
          </div>
          <div className="bg-red-50 rounded-xl px-5 py-3 text-center">
            <p className="text-2xl font-bold text-red-600">{profile.totalDonations}</p>
            <p className="text-xs text-red-600/70">Total Donations</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Recent Donations</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {profile.donationHistory.map((record, idx) => (
              <div key={record._id || idx} className="p-5 flex items-center gap-4 hover:bg-gray-50 transition">
                <div className="relative">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  </div>
                  {idx < profile.donationHistory.length - 1 && (
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 w-0.5 h-5 bg-red-100"></div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">Donated to {record.receiverName}</p>
                  <p className="text-sm text-gray-500">{record.location}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{record.bloodGroup}</span>
                    <span className="text-xs text-gray-400">{record.units} unit(s)</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-600">{new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  <span className="text-xs text-green-600">✓ Completed</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Impact Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-linear-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white">
            <p className="text-3xl font-bold">{profile.totalDonations * 3}</p>
            <p className="text-red-100 text-sm mt-1">Lives Potentially Saved</p>
          </div>
          <div className="bg-linear-to-br from-orange-500 to-amber-600 rounded-2xl p-6 text-white">
            <p className="text-3xl font-bold">{profile.donationHistory.reduce((s, r) => s + r.units, 0)}</p>
            <p className="text-orange-100 text-sm mt-1">Total Units Donated</p>
          </div>
          <div className="bg-linear-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
            <p className="text-3xl font-bold">{profile.healthScore}%</p>
            <p className="text-green-100 text-sm mt-1">Health Score</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="bg-linear-to-r from-red-600 to-red-800 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4"></div>
        <div className="relative">
          <h1 className="text-2xl font-bold mb-1">Welcome back, {user?.name}</h1>
          <p className="text-red-100">Your blood type <span className="font-bold text-white">{profile.bloodGroup}</span> is always in demand. Thank you for being a hero.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </div>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">{profile.bloodGroup}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{profile.totalDonations}</p>
          <p className="text-sm text-gray-500">Total Donations</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${profile.healthScore >= 85 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {profile.healthScore >= 85 ? 'Excellent' : 'Good'}
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{profile.healthScore}%</p>
          <p className="text-sm text-gray-500">Health Score</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
          </div>
          <p className="text-lg font-bold text-gray-900">
            {profile.totalDonations === 0 || !profile.lastDonationDate 
              ? 'Never' 
              : new Date(profile.lastDonationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
          <p className="text-sm text-gray-500">Last Donation</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
            </div>
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">{openRequests.length} active</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{matchedRequests.length}</p>
          <p className="text-sm text-gray-500">Matched Requests</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Availability Toggle */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-4">Availability Status</h3>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-4">
            <div>
              <p className="font-medium text-gray-800">{profile.available ? 'Available to Donate' : 'Not Available'}</p>
              <p className="text-xs text-gray-500 mt-0.5">{profile.available ? 'You will receive matching requests' : 'You won\'t receive requests'}</p>
            </div>
            <button
              onClick={toggleAvailability}
              className={`w-14 h-7 rounded-full transition-colors relative ${profile.available ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all shadow ${profile.available ? 'left-8' : 'left-1'}`}></div>
            </button>
          </div>

          {/* Eligibility */}
          <div className={`p-4 rounded-xl ${eligibility.eligible ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <p className="font-medium text-sm">{eligibility.eligible ? 'Eligible to Donate' : 'Not Currently Eligible'}</p>
            </div>
            <ul className="space-y-1">
              {eligibility.reasons.map((r, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="mt-0.5">{r.includes('✓') ? '✓' : '•'}</span> {r}
                </li>
              ))}
            </ul>
            {eligibility.nextEligibleDate && (
              <p className="text-xs text-amber-700 mt-2 font-medium">Next eligible: {eligibility.nextEligibleDate}</p>
            )}
          </div>
        </div>

        {/* Active Blood Requests */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Active Blood Requests Overview</h3>
              <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">{openRequests.length} open</span>
            </div>
            <div className="divide-y divide-gray-50 flex-1 flex flex-col">
              {openRequests.slice(0, 3).map(req => (
              <div key={req.id} className="p-4 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                      req.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                      req.urgency === 'moderate' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {req.bloodGroup}
                    </div>
                    <div>
                        <p className="font-medium text-gray-800 text-sm">{req.receiverName || 'Unknown Patient'} • {req.hospital}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{req.description.slice(0, 60)}...</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          req.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                          req.urgency === 'moderate' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {req.urgency.charAt(0).toUpperCase() + req.urgency.slice(1)}
                        </span>
                        <span className="text-xs text-gray-400">{req.units} units</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{new Date(req.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
          {openRequests.length > 3 && (
            <div className="pt-4 text-center mt-auto border-t border-gray-100">
              <button 
                type="button" 
                className="text-sm font-medium text-red-600 hover:text-red-700 hover:underline"
                onClick={() => onNavigate?.('requests')}
              >
                View all {openRequests.length} requests &rarr;
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-4">My Profile</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">Full Name</p>
            <p className="font-medium text-gray-800">{user?.name}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">Blood Group</p>
            <p className="font-medium text-gray-800">{profile.bloodGroup}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">Location</p>
            <p className="font-medium text-gray-800 text-sm">{profile.address}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">Contact</p>
            <p className="font-medium text-gray-800">{user?.phone || 'Not set'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
