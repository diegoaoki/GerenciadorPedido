'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function CadastroPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await api.post('/auth/register', { name, email, password });
      setDone(true);
    } catch (ex) {
      const msg = (ex as Error).message;
      if (msg.includes('409')) setErr('Este e-mail já está cadastrado.');
      else if (msg.includes('senha precisa')) setErr('A senha precisa de pelo menos 6 caracteres.');
      else setErr(msg);
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-3 text-4xl">✅</div>
          <h1 className="mb-2 text-lg font-semibold">Conta criada!</h1>
          <p className="mb-6 text-sm text-slate-500">
            Seu cadastro foi enviado e <strong>aguarda a aprovação do administrador</strong>.
            Você receberá acesso assim que for aprovado.
          </p>
          <a
            href="/login"
            className="inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Voltar ao login
          </a>
        </div>
      </div>
    );
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
          <h1 className="mb-1 text-lg font-semibold text-slate-900">Criar conta</h1>
          <p className="mb-5 text-xs text-slate-400">
            O acesso é liberado após aprovação do administrador.
          </p>

          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-xs text-slate-500">Nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-xs text-slate-500">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="mb-4 block text-sm">
            <span className="mb-1 block text-xs text-slate-500">Senha (mín. 6 caracteres)</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          {err && <div className="mb-3 text-xs text-red-600">{err}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {loading ? 'Enviando…' : 'Criar conta'}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            Já tem conta?{' '}
            <a href="/login" className="font-medium text-brand hover:underline">
              Entrar
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
