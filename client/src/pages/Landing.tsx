import { useState, useEffect, useCallback } from 'react';
import type { UserRole } from '../types';
import { useApp } from '../context/AppContext';
import { GoogleLogin } from '@react-oauth/google';

const TYPEWRITER_WORDS = ['Save Lives.', 'Find Donors.', 'Give Hope.', 'Act Now.'];
const TYPE_SPEED = 100;
const DELETE_SPEED = 60;
const PAUSE_DURATION = 2000;

function useTypewriter(words: string[]) {
  const [text, setText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const tick = useCallback(() => {
    const currentWord = words[wordIndex];
    if (!isDeleting) {
      setText(currentWord.slice(0, text.length + 1));
      if (text.length + 1 === currentWord.length) {
        setTimeout(() => setIsDeleting(true), PAUSE_DURATION);
        return;
      }
    } else {
      setText(currentWord.slice(0, text.length - 1));
      if (text.length - 1 === 0) {
        setIsDeleting(false);
        setWordIndex((wordIndex + 1) % words.length);
        return;
      }
    }
  }, [text, wordIndex, isDeleting, words]);

  useEffect(() => {
    const delay = isDeleting ? DELETE_SPEED : TYPE_SPEED;
    const timer = setTimeout(tick, delay);
    return () => clearTimeout(timer);
  }, [tick, isDeleting]);

  return text;
}

export default function Landing() {
  const { login } = useApp();
  const typedText = useTypewriter(TYPEWRITER_WORDS);
  const [showLogin, setShowLogin] = useState(false);
  const [loginStep, setLoginStep] = useState<'role' | 'form'>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole>('donor');
  const [isLoginView, setIsLoginView] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setIsLoginView(true);
    setLoginStep('form');
  };

  const handleStandardAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = isLoginView ? 'http://bloodlink-alb-1885440142.eu-north-1.elb.amazonaws.com/api/auth/login' : 'http://bloodlink-alb-1885440142.eu-north-1.elb.amazonaws.com/api/auth/register';
      const bodyPayload = isLoginView 
        ? { email, password } 
        : { name: fullName, email, password, role: selectedRole };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('Server unreachable or returned invalid response (Is the backend running?)');
      }

      if (!res.ok) {
        const detail = data?.details?.[0]?.message;
        throw new Error(detail || data?.error || `${isLoginView ? 'Login' : 'Signup'} failed`);
      }

      // Role validation on login
      if (isLoginView) {
        const actualRole = data.user.role;
        if (selectedRole === 'admin' && actualRole !== 'admin') {
          throw new Error('You do not have admin access');
        }
        // Allow donors to login as receiver (donors can also need blood)
        if (selectedRole === 'receiver' && actualRole === 'donor') {
          data.user.role = 'receiver';
        }
      }

      login(data.user, data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError('');
    try {
      const res = await fetch('http://bloodlink-alb-1885440142.eu-north-1.elb.amazonaws.com/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          credential: credentialResponse.credential, 
          role: selectedRole 
        }),
      });
      
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('Server unreachable. Ensure the backend is running on port 5000.');
      }

      if (!res.ok) throw new Error(data?.error || 'Google login failed');

      // Role validation
      const actualRole = data.user.role;
      if (selectedRole === 'admin' && actualRole !== 'admin') {
        throw new Error('You do not have admin access');
      }
      if (selectedRole === 'receiver' && actualRole === 'donor') {
        data.user.role = 'receiver';
      }

      login(data.user, data.token);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 z-50 shrink-0">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg className="w-8 h-8 text-red-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C12 2 5 10.5 5 15a7 7 0 0014 0C19 10.5 12 2 12 2z"/>
            </svg>
            <span className="font-bold text-lg text-gray-900">BloodLink<span className="text-red-600">AI</span></span>
          </div>
          <button
            onClick={() => setShowLogin(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            Join & Save Lives
          </button>
        </div>
      </nav>

      {/* Hero — fills remaining viewport */}
      <main className="flex-1 flex items-center justify-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-red-50/40 to-white -z-10" />

        {/* Floating background blobs */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-red-100/40 rounded-full blur-3xl animate-[float_8s_ease-in-out_infinite]" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-red-50/60 rounded-full blur-3xl animate-[float_10s_ease-in-out_2s_infinite]" />

        <div className="max-w-2xl text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight animate-[fadeUp_0.8s_ease-out_both]">
            Connect Donors.
            <br />
            <span className="text-red-600 inline-block min-w-[5ch]">
              {typedText}
              <span className="inline-block w-[3px] h-[1em] bg-red-600 ml-0.5 align-middle animate-[blink_0.7s_step-end_infinite]" />
            </span>
          </h1>
          <p className="mt-5 text-lg text-gray-500 max-w-lg mx-auto leading-relaxed animate-[fadeUp_0.8s_ease-out_0.2s_both]">
            Instantly find and connect with the right blood donors near you. Every second counts, and we make sure none are wasted.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center animate-[fadeUp_0.8s_ease-out_0.4s_both]">
            <button
              onClick={() => setShowLogin(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-semibold transition-all hover:scale-105 hover:shadow-lg hover:shadow-red-600/20 active:scale-100"
            >
              Find a Donor Now
            </button>
          </div>
        </div>
      </main>

      {/* Thin footer */}
      <footer className="border-t border-gray-100 py-4 text-center text-xs text-gray-400 shrink-0">
        © {new Date().getFullYear()} BloodLink AI
      </footer>

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-100 p-4 animate-[fadeIn_0.2s_ease-out]" onClick={() => { setShowLogin(false); setLoginStep('role'); }}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl animate-[fadeUp_0.3s_ease-out]" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <svg className="w-10 h-10 text-red-600 mx-auto mb-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C12 2 5 10.5 5 15a7 7 0 0014 0C19 10.5 12 2 12 2z"/>
              </svg>
              <h2 className="text-xl font-bold text-gray-900">
                {loginStep === 'role' ? 'Welcome to BloodLink AI' : `Sign in as ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}`}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                {loginStep === 'role' ? 'Select your role to continue' : 'Access your dashboard'}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 text-center">
                {error}
              </div>
            )}

            {loginStep === 'role' ? (
              <div className="space-y-2">
                {([
                  { role: 'donor' as UserRole, title: 'Donor', desc: 'Donate blood and save lives', color: 'bg-red-100 text-red-600' },
                  { role: 'receiver' as UserRole, title: 'Receiver', desc: 'Find compatible blood donors', color: 'bg-blue-100 text-blue-600' },
                  { role: 'admin' as UserRole, title: 'Admin', desc: 'Manage the platform', color: 'bg-purple-100 text-purple-600' },
                ]).map(r => (
                  <button
                    key={r.role}
                    onClick={() => handleRoleSelect(r.role)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-red-200 hover:bg-red-50/30 transition group"
                  >
                    <div className={`w-10 h-10 ${r.color} rounded-lg flex items-center justify-center font-bold text-sm`}>
                      {r.title.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 text-sm">{r.title}</p>
                      <p className="text-xs text-gray-500">{r.desc}</p>
                    </div>
                    <span className="ml-auto text-gray-300 group-hover:text-red-400 transition">→</span>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <form onSubmit={handleStandardAuth} className="space-y-4 mb-5">
                  {!isLoginView && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-red-500"
                        placeholder="Enter your full name"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input 
                      type="email" 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-red-500"
                      placeholder="Enter your email"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input 
                      type="password" 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-red-500"
                      placeholder="Enter your password"
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : (isLoginView ? 'Log In' : 'Sign Up')}
                  </button>
                </form>

                <div className="text-center mb-5">
                  <p className="text-sm text-gray-600">
                    {isLoginView ? (selectedRole !== 'admin' ? "Don't have an account? " : '') : "Already have an account? "}
                    {(isLoginView ? selectedRole !== 'admin' : true) && (
                      <button 
                        onClick={() => setIsLoginView(!isLoginView)}
                        className="text-red-600 font-semibold hover:underline"
                      >
                        {isLoginView ? 'Sign up' : 'Log in'}
                      </button>
                    )}
                  </p>
                </div>
                
                <div className="relative mb-5">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                  <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">Or continue with</span></div>
                </div>

                <div className="flex justify-center mb-4">
                  <GoogleLogin 
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google Login Failed')}
                    useOneTap
                  />
                </div>

                <button 
                  onClick={() => { setLoginStep('role'); setIsLoginView(true); }}
                  className="w-full text-sm text-gray-400 hover:text-gray-700 text-center mt-2"
                >
                  ← Back to roles
                </button>
              </div>
            )}

            <p className="text-xs text-gray-400 text-center mt-5">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
