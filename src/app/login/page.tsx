'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { translateAuthError } from '@/lib/auth-errors';
import { validatePasswordPolicy, PASSWORD_HELP_TEXT } from '@/lib/password-policy';
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';
import { Mail, Lock, AlertCircle, Chrome, ArrowLeft, Check, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { ELENXOS_BRAND } from '@/lib/branding';

function LoginPage() {
  const { signInWithGoogle, loginWithEmail, registerWithEmail, resetPassword } = useAuth();
  const reduceMotion = useReducedMotion();
  const [isLogin, setIsLogin] = useState(true);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Ingresá tu correo electrónico.');
      return;
    }
    if (!password) {
      setError('Ingresá tu contraseña.');
      return;
    }
    if (!isLogin) {
      const policy = validatePasswordPolicy(password);
      if (!policy.ok) {
        setError(policy.error ?? 'Contraseña inválida.');
        return;
      }
    }
    setLoading(true);
    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
    } catch (error: unknown) {
      setError(translateAuthError(error, 'Ocurrió un error. Intentalo de nuevo.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    setError(null);
    setLoading(true);
    try {
        await signInWithGoogle();
    } catch (error: unknown) {
        setError(translateAuthError(error, 'Error al iniciar sesión con Google'));
    } finally {
        setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    if (!resetEmail.trim()) {
      setResetError('Ingresá tu correo electrónico.');
      return;
    }
    setResetLoading(true);
    try {
      await resetPassword(resetEmail);
      setResetSuccess(true);
    } catch (error: unknown) {
      setResetError(translateAuthError(error, 'Error al enviar el correo'));
    } finally {
      setResetLoading(false);
    }
  };

  if (showResetPassword) {
    return (
      <LazyMotion features={domAnimation}>
        <div className="min-h-[100dvh] bg-surface-900 flex items-center justify-center p-4 relative">
          <div className="absolute inset-0 bg-gradient-glow opacity-40" />

          <div className="w-full max-w-md relative z-10">
            <div className="bg-surface-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden border border-surface-600/50">
              <div className="p-8">
                <button
                  onClick={() => {
                    setShowResetPassword(false);
                    setResetSuccess(false);
                    setResetError(null);
                    setResetEmail('');
                  }}
                  className="flex items-center gap-2 text-surface-400 hover:text-white transition mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver al inicio de sesión
                </button>

              {resetSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">¡Correo enviado!</h2>
                  <p className="text-surface-400 text-sm mb-6">
                    Hemos enviado un enlace de recuperación a <span className="text-white font-medium">{resetEmail}</span>.
                    Revisa tu bandeja de entrada y sigue las instrucciones.
                  </p>
                  <p className="text-surface-500 text-xs">
                    ¿No lo encuentras? Revisa la carpeta de spam.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold text-white">Recuperar contraseña</h2>
                    <p className="text-sm text-surface-400 mt-2">
                      Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
                    </p>
                  </div>

                  <form onSubmit={handleResetPassword} noValidate className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Correo Electrónico</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
                        <input
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-surface-700 border border-surface-600 rounded-lg focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500 outline-none transition text-white placeholder:text-surface-500"
                          placeholder="usuario@ejemplo.com"
                        />
                      </div>
                    </div>

                    <AnimatePresence>
                      {resetError && (
                        <m.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: 'easeOut' }}
                          className="bg-mandy-500/10 text-mandy-400 text-sm p-3 rounded-lg flex items-center gap-2 border border-mandy-500/20"
                        >
                          <AlertCircle className="w-4 h-4" />
                          {resetError}
                        </m.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full bg-gradient-mandy text-white font-semibold py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-mandy-500/20 flex items-center justify-center gap-2"
                    >
                      {resetLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        'Enviar enlace de recuperación'
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
            </div>
          </div>
        </div>
      </LazyMotion>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-[100dvh] bg-surface-900 flex items-center justify-center p-4 relative">
        <div className="absolute inset-0 bg-gradient-glow opacity-40" />

        <div className="w-full max-w-md relative z-10">
          <div className="bg-surface-800 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden border border-surface-600/50">
            <div role="tablist" aria-label="Modo de autenticación" className="flex border-b border-surface-600/50">
                <button
                    type="button"
                    role="tab"
                    aria-selected={isLogin}
                    aria-controls="auth-form"
                    onClick={() => setIsLogin(true)}
                    className={`flex-1 py-4 text-sm font-medium transition ${isLogin ? 'text-mandy-500 border-b-2 border-mandy-500 bg-mandy-500/5' : 'text-surface-400 hover:text-surface-200'}`}
                >
                    Iniciar Sesión
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={!isLogin}
                    aria-controls="auth-form"
                    onClick={() => setIsLogin(false)}
                    className={`flex-1 py-4 text-sm font-medium transition ${!isLogin ? 'text-mandy-500 border-b-2 border-mandy-500 bg-mandy-500/5' : 'text-surface-400 hover:text-surface-200'}`}
                >
                    Registrarse
                </button>
            </div>

            <div className="p-8">
                <div className="mb-6 text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className="bg-gradient-mandy text-white p-2 rounded-lg text-lg font-bold">A</span>
                      <span className="text-xl font-bold text-white">Agora</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                        {isLogin ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
                    </h2>
                    <p className="text-sm text-surface-400 mt-2">
                        {isLogin ? 'Accede a tus documentos y continúa investigando con rigor' : 'Crea tu cuenta para escribir, formalizar y colaborar con rigor'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-surface-500">
                      <span>{ELENXOS_BRAND.ownershipLine}</span>
                      <a
                        href={ELENXOS_BRAND.homeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-mandy-400 hover:text-mandy-300 transition"
                      >
                        {ELENXOS_BRAND.name}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                </div>

                <form id="auth-form" onSubmit={handleSubmit} noValidate className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Correo Electrónico</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
                            <input
                                type="email"
                                autoComplete="email"
                                inputMode="email"
                                autoCapitalize="off"
                                autoCorrect="off"
                                spellCheck={false}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-surface-700 border border-surface-600 rounded-lg focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500 outline-none transition text-white placeholder:text-surface-500"
                                placeholder="usuario@ejemplo.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-2 mb-6">
                        <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
                            <input
                                type="password"
                                autoComplete={isLogin ? 'current-password' : 'new-password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-surface-700 border border-surface-600 rounded-lg focus:ring-2 focus:ring-mandy-500/50 focus:border-mandy-500 outline-none transition text-white placeholder:text-surface-500"
                                placeholder="••••••••"
                            />
                        </div>
                        {isLogin && (
                            <button
                                type="button"
                                onClick={() => {
                                    setShowResetPassword(true);
                                    setResetEmail(email);
                                }}
                                className="text-xs text-mandy-400 hover:text-mandy-300 transition mt-1"
                            >
                                ¿Olvidaste tu contraseña?
                            </button>
                        )}
                        {!isLogin && (
                            <p className="text-[11px] text-surface-500 mt-1">{PASSWORD_HELP_TEXT}</p>
                        )}
                    </div>

                    <AnimatePresence>
                        {error && (
                            <m.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: 'easeOut' }}
                                className="bg-mandy-500/10 text-mandy-400 text-sm p-3 rounded-lg flex items-center gap-2 border border-mandy-500/20"
                            >
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </m.div>
                        )}
                    </AnimatePresence>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-mandy text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-mandy-500/20"
                    >
                        {loading ? 'Procesando...' : (isLogin ? 'Entrar' : 'Crear cuenta')}
                    </button>
                </form>

                <div className="my-6 flex items-center justify-between">
                    <span className="h-px w-full bg-surface-600/50" />
                    <span className="px-3 text-xs text-surface-500 font-medium">O</span>
                    <span className="h-px w-full bg-surface-600/50" />
                </div>

                <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={loading}
                    className="w-full max-w-full min-w-0 bg-surface-700 border border-surface-600 text-surface-200 font-medium py-2.5 px-3 rounded-lg hover:bg-surface-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
                >
                    <Chrome className="w-5 h-5 shrink-0 text-surface-400" />
                    <span className="truncate min-w-0">Continuar con Google</span>
                </button>
            </div>
        </div>
        <div className="text-center mt-6">
            <Link href="/" className="text-sm text-surface-500 hover:text-mandy-400 transition">
                &larr; Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </LazyMotion>
  );
}

export default dynamic(() => Promise.resolve(LoginPage), {
  ssr: false
});
