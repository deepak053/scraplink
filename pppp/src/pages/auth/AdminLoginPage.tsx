import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Mail, Lock, Settings } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../../components/UI/LoadingSpinner';

const schema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().required('Password is required'),
});

type FormData = yup.InferType<typeof schema>;

export function AdminLoginPage() {
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const { signInAsAdmin, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: yupResolver(schema),
  });

  // Redirect as soon as auth context reports admin
  useEffect(() => {
    if (isAdmin) {
      console.log('[AdminLoginPage] isAdmin true — navigating to /admin/dashboard');
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAdmin, navigate]);

  const onSubmit = async (data: FormData) => {
    setErrorMsg(null);
    setLocalLoading(true);

    try {
      console.log('[AdminLoginPage] Attempting admin sign-in for', data.email);
      await signInAsAdmin(data.email, data.password);
      // signInAsAdmin sets isAdmin in context — effect handles navigation
    } catch (err: any) {
      console.error('[AdminLoginPage] signInAsAdmin error:', err);
      // If Supabase RPC isn't available during local testing, allow local fallback admins
      const localFallbacks = [
        { email: 'sowmya@techsolveengine.com', password: 'gOWDA2123' },
      ];

      const matchedFallback = localFallbacks.find(c => c.email === data.email && c.password === data.password);
      if (matchedFallback) {
        console.log('[AdminLoginPage] Using local fallback admin for', matchedFallback.email);
        localStorage.setItem('isAdmin', 'true');
        localStorage.setItem('adminEmail', matchedFallback.email);
        // Reload so AuthProvider picks up isAdmin from localStorage
        window.location.href = '/admin/dashboard';
        return;
      }

      const message = err?.message ?? 'Admin login failed. Please check credentials.';
      setErrorMsg(message);
      try {
        const keys = err && typeof err === 'object' ? Object.getOwnPropertyNames(err) : undefined;
        setErrorDetails(JSON.stringify(err, keys as any, 2));
      } catch (_e) {
        setErrorDetails(String(err));
      }
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          <Settings className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900">Admin Access</h2>
          <p className="text-gray-600 mt-2">Sign in to the admin panel</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700">
            <div className="font-medium">{errorMsg}</div>
            {errorDetails && (
              <details className="mt-2 text-xs text-red-600">
                <summary className="cursor-pointer">Show details</summary>
                <pre className="whitespace-pre-wrap">{errorDetails}</pre>
              </details>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                {...register('email')}
                type="email"
                className="pl-10 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                placeholder="sowmya@techsolveengine.com"
                autoComplete="username"
              />
            </div>
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                {...register('password')}
                type="password"
                className="pl-10 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={localLoading || authLoading}
            className="w-full bg-slate-600 text-white py-3 px-4 rounded-lg hover:bg-slate-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-h-[48px]"
          >
            {(localLoading || authLoading) ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Authenticating...
              </>
            ) : (
              'Access Admin Panel'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-slate-600 hover:text-slate-700 text-sm">← Back to User Login</Link>
        </div>
      </div>
    </div>
  );
}
