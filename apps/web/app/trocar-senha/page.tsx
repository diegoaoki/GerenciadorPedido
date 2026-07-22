'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function TrocarSenhaPage() {
  const [current, setCurrent] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Chega aqui forçado quando o admin exigiu a troca
  const forced =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('obrigatorio') === '1';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (nova !== confirma) {
      setErr('A confirmação não confere com a nova senha.');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      await api.post('/auth/change-password', {
        currentPassword: current,
        newPassword: nova,
      });
      alert('Senha alterada com sucesso!');
      window.location.href = '/';
    } catch (ex) {
      const msg = (ex as Error).message;
      setErr(msg.includes('401') ? 'Senha atual incorreta.' : msg);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Trocar senha</h1>
      {forced && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          ⚠️ O administrador solicitou que você defina uma nova senha antes de continuar.
        </p>
      )}

      <form
        onSubmit={submit}
        className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-xs text-slate-500">Senha atual</span>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoFocus
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-xs text-slate-500">Nova senha (mín. 6 caracteres)</span>
          <input
            type="password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-xs text-slate-500">Confirmar nova senha</span>
          <input
            type="password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
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
          {loading ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  );
}
