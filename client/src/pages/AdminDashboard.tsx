import { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { useApp } from '../context/AppContext';
import { predictDemand } from '../utils/ai';
import { api } from '../utils/api';

import type { BloodGroup } from '../types';

interface Props {
  page: string;
}


export default function AdminDashboard({ page }: Props) {
  const { donors, requests } = useApp();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'demand' | 'donors' | 'requests'>('overview');
  const [backendStats, setBackendStats] = useState<any>(null);

  // Fetch admin stats from backend
  useEffect(() => {
    api<any>('/admin/stats').then(setBackendStats).catch(() => {});
  }, []);

  const predictions = useMemo(() => predictDemand(requests), [requests]);

  // Build monthly trend data for charts
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months = 6;
    const data: Record<string, any>[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      const row: Record<string, any> = { month: label };
      for (const bg of ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']) row[bg] = 0;
      data.push(row);
    }
    for (const r of requests) {
      const rd = new Date(r.createdAt);
      if (Number.isNaN(rd.getTime())) continue;
      const diff = (now.getFullYear() - rd.getFullYear()) * 12 + (now.getMonth() - rd.getMonth());
      if (diff < 0 || diff >= months) continue;
      const idx = months - 1 - diff;
      if (data[idx] && r.bloodGroup in data[idx]) {
        data[idx][r.bloodGroup] += r.units || 1;
      }
    }
    return data;
  }, [requests]);

  const stats = backendStats ? {
    totalDonors: backendStats.totalDonors ?? donors.length,
    activeDonors: backendStats.activeDonors ?? donors.filter(d => d.available).length,
    totalRequests: backendStats.totalRequests ?? requests.length,
    openRequests: backendStats.activeRequests ?? requests.filter(r => r.status === 'open').length,
    fulfilledRequests: backendStats.fulfilledRequests ?? requests.filter(r => r.status === 'fulfilled').length,
    criticalRequests: backendStats.criticalRequests ?? requests.filter(r => r.urgency === 'critical' && r.status === 'open').length,
    totalDonations: backendStats.totalDonations ?? donors.reduce((s, d) => s + d.totalDonations, 0),
    avgHealthScore: backendStats.avgHealthScore ?? (donors.length > 0 ? Math.round(donors.reduce((s, d) => s + d.healthScore, 0) / donors.length) : 0),
  } : {
    totalDonors: donors.length,
    activeDonors: donors.filter(d => d.available).length,
    totalRequests: requests.length,
    openRequests: requests.filter(r => r.status === 'open').length,
    fulfilledRequests: requests.filter(r => r.status === 'fulfilled').length,
    criticalRequests: requests.filter(r => r.urgency === 'critical' && r.status === 'open').length,
    totalDonations: donors.reduce((s, d) => s + d.totalDonations, 0),
    avgHealthScore: donors.length > 0 ? Math.round(donors.reduce((s, d) => s + d.healthScore, 0) / donors.length) : 0,
  };

  const bloodGroupDistribution = (['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as BloodGroup[]).map(bg => ({
    name: bg,
    donors: donors.filter(d => d.bloodGroup === bg).length,
    requests: requests.filter(r => r.bloodGroup === bg).length,
  }));

  const urgencyDistribution = [
    { name: 'Critical', value: requests.filter(r => r.urgency === 'critical').length, color: '#ef4444' },
    { name: 'Moderate', value: requests.filter(r => r.urgency === 'moderate').length, color: '#f59e0b' },
    { name: 'Normal', value: requests.filter(r => r.urgency === 'normal').length, color: '#22c55e' },
  ];

  const statusDistribution = [
    { name: 'Open', value: requests.filter(r => r.status === 'open').length, color: '#3b82f6' },
    { name: 'Matched', value: requests.filter(r => r.status === 'matched').length, color: '#8b5cf6' },
    { name: 'Fulfilled', value: requests.filter(r => r.status === 'fulfilled').length, color: '#22c55e' },
    { name: 'Cancelled', value: requests.filter(r => r.status === 'cancelled').length, color: '#6b7280' },
  ];

  // AI Insights Page
  if (page === 'ai-insights') {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Insights & Predictions</h1>
          <p className="text-gray-500">Analytics and demand forecasting</p>
        </div>

        {/* Demand Predictions */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Blood Demand Predictions</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {predictions.map(p => (
              <div key={p.bloodGroup} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-red-600">{p.bloodGroup}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.trend === 'increasing' ? 'bg-red-100 text-red-700' :
                    p.trend === 'decreasing' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {p.trend === 'increasing' ? '↑' : p.trend === 'decreasing' ? '↓' : '→'} {p.trend}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-gray-900">{p.predictedDemand}</p>
                  <p className="text-xs text-gray-500">predicted units</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500">Current: {p.currentDemand}</p>
                  <p className="text-xs text-gray-500">Conf: {p.confidence}%</p>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.confidence}%` }}></div>
                </div>
              </div>
            ))}
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="O+" stroke="#ef4444" fill="#fecaca" strokeWidth={2} />
                <Area type="monotone" dataKey="A+" stroke="#3b82f6" fill="#bfdbfe" strokeWidth={2} />
                <Area type="monotone" dataKey="B+" stroke="#22c55e" fill="#bbf7d0" strokeWidth={2} />
                <Area type="monotone" dataKey="AB+" stroke="#8b5cf6" fill="#ddd6fe" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Model Info */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Matching Algorithm</h3>
            <div className="space-y-3">
              {[
                { factor: 'Distance Score', weight: '35%', desc: 'Proximity-based, max radius 50km' },
                { factor: 'Recency Score', weight: '25%', desc: 'Days since last donation (min 56)' },
                { factor: 'Availability', weight: '20%', desc: 'Current availability status' },
                { factor: 'Compatibility', weight: '20%', desc: 'Blood group compatibility' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-sm font-bold text-blue-700">{f.weight}</div>
                  <div>
                    <p className="font-medium text-sm text-gray-800">{f.factor}</p>
                    <p className="text-xs text-gray-500">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Urgency Classifier</h3>
            <p className="text-sm text-gray-600 mb-4">Keyword-based analysis that classifies blood requests into urgency levels.</p>
            <div className="space-y-3">
              <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                <p className="font-medium text-sm text-red-800">Critical Keywords</p>
                <p className="text-xs text-red-600 mt-1">emergency, urgent, accident, trauma, hemorrhage, life-threatening</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="font-medium text-sm text-amber-800">Moderate Keywords</p>
                <p className="text-xs text-amber-600 mt-1">surgery, scheduled, operation, procedure, transfusion</p>
              </div>
              <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                <p className="font-medium text-sm text-green-800">Normal Keywords</p>
                <p className="text-xs text-green-600 mt-1">regular, routine, planned, chronic, maintenance</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-purple-50 rounded-xl border border-purple-100">
              <p className="font-medium text-sm text-purple-800">Fraud Detection</p>
              <p className="text-xs text-purple-600 mt-1">Analyzes description length, unit count, location validity, and hospital verification</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Requests Management
  if (page === 'requests') {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">All Blood Requests</h1>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Receiver</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Blood</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Hospital</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Urgency</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 text-sm text-gray-600 font-mono">{r.id}</td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-800">{r.receiverName}</td>
                    <td className="px-5 py-4"><span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">{r.bloodGroup}</span></td>
                    <td className="px-5 py-4 text-sm text-gray-600">{r.hospital}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        r.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                        r.urgency === 'moderate' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>{r.urgency}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        r.status === 'open' ? 'bg-blue-100 text-blue-700' :
                        r.status === 'matched' ? 'bg-purple-100 text-purple-700' :
                        r.status === 'fulfilled' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Donors List
  if (page === 'donors-list') {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">All Registered Donors</h1>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Donor</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Blood</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Location</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Donations</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Health</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Last Donated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {donors.map(d => (
                  <tr key={d.userId} className="hover:bg-gray-50">
                      <td className="px-5 py-4 text-sm font-medium text-gray-800">{d.name || d.userId}</td>
                    <td className="px-5 py-4"><span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">{d.bloodGroup}</span></td>
                    <td className="px-5 py-4 text-sm text-gray-600 max-w-[200px] truncate">{d.address}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${d.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {d.available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-800">{d.totalDonations}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${d.healthScore >= 90 ? 'bg-green-500' : d.healthScore >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${d.healthScore}%` }}></div>
                        </div>
                        <span className="text-xs text-gray-600">{d.healthScore}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">{d.lastDonationDate ? new Date(d.lastDonationDate).toLocaleDateString() : 'Never donated'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Main Admin Dashboard
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500">BloodLink AI Platform Overview</p>
        </div>
        <div className="flex gap-2">
          {(['overview', 'demand', 'donors', 'requests'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedTab === tab ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Donors', value: stats.totalDonors, color: 'from-blue-500 to-blue-600', sub: `${stats.activeDonors} active` },
          { label: 'Total Requests', value: stats.totalRequests, color: 'from-red-500 to-red-600', sub: `${stats.openRequests} open` },
          { label: 'Fulfilled', value: stats.fulfilledRequests, color: 'from-green-500 to-green-600', sub: `${stats.totalRequests > 0 ? Math.round(stats.fulfilledRequests / stats.totalRequests * 100) : 0}% rate` },
          { label: 'Critical', value: stats.criticalRequests, color: 'from-orange-500 to-orange-600', sub: 'Need immediate action' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-gray-200 hover:shadow-lg transition">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 bg-linear-to-br ${s.color} rounded-xl flex items-center justify-center shadow-lg`}>
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={
                  i === 0 ? "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" :
                  i === 1 ? "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" :
                  i === 2 ? "M5 13l4 4L19 7" :
                  "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                } /></svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      {selectedTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Blood Group Distribution */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Blood Group Distribution</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bloodGroupDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="donors" fill="#3b82f6" name="Donors" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="requests" fill="#ef4444" name="Requests" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Urgency Pie Chart */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Urgency Distribution</h3>
            <div className="h-72 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={urgencyDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {urgencyDistribution.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                  <Legend formatter={(value, entry: any) => `${value}: ${entry.payload.value}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Pie */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Request Status</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                  <Legend formatter={(value, entry: any) => `${value}: ${entry.payload.value}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Monthly Demand Trend</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="O+" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="A+" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="B+" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="AB+" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'demand' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Demand Predictions</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {predictions.map(p => (
              <div key={p.bloodGroup} className={`rounded-xl p-4 border ${
                p.trend === 'increasing' ? 'bg-red-50 border-red-200' :
                p.trend === 'decreasing' ? 'bg-green-50 border-green-200' :
                'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl font-bold text-red-600">{p.bloodGroup}</span>
                  <span className={`text-sm ${
                    p.trend === 'increasing' ? 'text-red-600' : p.trend === 'decreasing' ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {p.trend === 'increasing' ? '↑' : p.trend === 'decreasing' ? '↓' : '→'}
                  </span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{p.predictedDemand}</p>
                <p className="text-xs text-gray-500 mt-1">Current: {p.currentDemand} → Predicted: {p.predictedDemand}</p>
                <div className="mt-2 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${p.confidence}%` }}></div>
                </div>
                <p className="text-xs text-gray-400 mt-1">Confidence: {p.confidence}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

