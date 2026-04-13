import { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { BloodGroup } from '../types';
import { geocodeAddress } from '../utils/geocode';
import { api } from '../utils/api';

export default function Onboarding() {
  const { user, createDonorProfile } = useApp();
  
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bloodGroup) {
      setError('Please select a blood group');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const geo = await geocodeAddress(address);

      await api('/donors/profile', {
        method: 'POST',
        body: {
          bloodGroup,
          age: parseInt(age),
          weight: parseFloat(weight),
          address,
          lat: geo.lat,
          lng: geo.lng,
        }
      });

      // Add to local state to unlock dashboard immediately
      createDonorProfile({
        userId: user!.id,
        name: user!.name,
        email: user!.email,
        bloodGroup: bloodGroup as BloodGroup,
        lat: geo.lat,
        lng: geo.lng,
        address,
        available: true,
        lastDonationDate: '',
        totalDonations: 0,
        donationHistory: [],
        healthScore: 100,
        age: parseInt(age),
        weight: parseFloat(weight)
      });
      
    } catch (err: any) {
      setError(err?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 my-10">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C12 2 5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z"/></svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to BloodLink, {user?.name.split(' ')[0]}!</h1>
        <p className="text-gray-500">Before you can start saving lives, we need a few details to build your medical profile.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 text-center font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-4">1. What is your Blood Group?</label>
          <div className="grid grid-cols-4 gap-3">
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
              <button
                key={bg}
                type="button"
                onClick={() => setBloodGroup(bg as BloodGroup)}
                className={`py-3 rounded-xl font-bold text-sm transition ${
                  bloodGroup === bg 
                    ? 'bg-red-600 text-white shadow-md shadow-red-200' 
                    : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-500'
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age (Years)</label>
            <input 
              type="number" 
              min="18" 
              max="65"
              required
              value={age}
              onChange={e => setAge(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-red-500 transition"
              placeholder="e.g. 25"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
            <input 
              type="number" 
              min="50"
              step="0.1"
              required
              value={weight}
              onChange={e => setWeight(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-red-500 transition"
              placeholder="e.g. 70"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">General Address / City</label>
          <input 
            type="text" 
            required
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-red-500 transition"
            placeholder="e.g. Brooklyn, NY"
          />
          <p className="text-xs text-gray-400 mt-2">This helps our AI map coordinate emergency requests near you.</p>
        </div>

        <button 
          type="submit" 
          disabled={loading || !bloodGroup}
          className="w-full bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-4 rounded-xl transition shadow-xl shadow-red-200 disabled:opacity-50 mt-4 text-lg"
        >
          {loading ? 'Setting up profile...' : 'Complete Profile & View Dashboard'}
        </button>
      </form>
    </div>
  );
}