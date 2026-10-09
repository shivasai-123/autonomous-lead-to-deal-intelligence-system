import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layers, Eye, EyeOff, Lock, Mail, User, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card, CardContent } from '../components/common/Card';
import { Badge } from '../components/common/Badge';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!firstName.trim()) errors.firstName = 'First name is required';
    if (!lastName.trim()) errors.lastName = 'Last name is required';

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!validate()) return;

    setIsLoading(true);
    const result = await register({
      firstName,
      lastName,
      email,
      password,
    });
    setIsLoading(false);

    if (result.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setErrorMessage(result.error);
      if (result.errors) {
        setFieldErrors(result.errors);
      }
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <Link to="/" className="inline-flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center text-white shadow-sm shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <Layers className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">AutoLead CRM</span>
        </Link>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          Create a Sales Rep Account
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Get started with autonomous lead tracking and sales intelligence
        </p>
        <div className="mt-2">
          <Badge variant="primary">Role: Sales Representative</Badge>
        </div>
      </div>

      <div className="w-full max-w-md">
        <Card className="shadow-md">
          <CardContent className="p-8">
            {errorMessage && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-rose-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    First Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      className={`block w-full pl-9 pr-3 py-2 text-sm rounded-lg border ${
                        fieldErrors.firstName ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-brand-500'
                      } bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2`}
                    />
                  </div>
                  {fieldErrors.firstName && (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.firstName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className={`block w-full px-3 py-2 text-sm rounded-lg border ${
                      fieldErrors.lastName ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-brand-500'
                    } bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2`}
                  />
                  {fieldErrors.lastName && (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rep@company.com"
                    className={`block w-full pl-9 pr-3 py-2 text-sm rounded-lg border ${
                      fieldErrors.email ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-brand-500'
                    } bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-rose-600">{fieldErrors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password (min 8 characters)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`block w-full pl-9 pr-10 py-2 text-sm rounded-lg border ${
                      fieldErrors.password ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300 focus:ring-brand-500'
                    } bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-rose-600">{fieldErrors.password}</p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full py-2.5"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Creating Account...
                    </span>
                  ) : (
                    'Register Account'
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Already registered?{' '}
                <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
                  Sign in here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default RegisterPage;
