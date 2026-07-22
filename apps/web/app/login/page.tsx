'use client';

import { useState } from 'react';
import { api, auth } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await api.post<{
        token: string;
        role: string;
        mustChangePassword?: boolean;
      }>('/auth/login', { email, password });
      auth.setSession(res.token, res.role);
      window.location.href = res.mustChangePassword ? '/trocar-senha?obrigatorio=1' : '/';
    } catch (ex) {
      const msg = (ex as Error).message;
      if (msg.includes('401')) setErr('E-mail ou senha inválidos.');
      else if (msg.includes('403') && msg.includes('aprova'))
        setErr('Seu cadastro ainda aguarda aprovação do administrador.');
      else if (msg.includes('403')) setErr('Acesso bloqueado. Fale com o administrador.');
      else setErr(msg);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold text-brand">Integração</div>
          <div className="text-sm text-slate-400">Multiplataforma</div>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h1 className="mb-5 text-lg font-semibold text-slate-900">Entrar</h1>

          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-xs text-slate-500">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="mb-4 block text-sm">
            <span className="mb-1 block text-xs text-slate-500">Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          {err && <div className="mb-3 text-xs text-red-600">{err}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            Não tem conta?{' '}
            <a href="/cadastro" className="font-medium text-brand hover:underline">
              Criar conta
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
