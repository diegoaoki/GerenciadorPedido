'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, Badge, EmptyState } from '@/components/ui';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: 'PENDING' | 'ACTIVE' | 'BLOCKED';
  mustChangePassword: boolean;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Aguardando aprovação',
  ACTIVE: 'Ativo',
  BLOCKED: 'Bloqueado',
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [resetInfo, setResetInfo] = useState<{ email: string; tempPassword: string } | null>(null);

  async function resetPassword(id: string, email: string) {
    if (!confirm(`Resetar a senha de ${email}? A senha atual deixará de funcionar.`)) return;
    const res = await api.patch<{ email: string; tempPassword: string }>(
      `/users/${id}/reset-password`,
    );
    setResetInfo(res);
    load();
  }

  async function requireChange(id: string) {
    await api.patch(`/users/${id}/require-password-change`);
    load();
  }

  async function load() {
    try {
      setUsers(await api.get<UserRow[]>('/users'));
    } catch (e) {
      const msg = (e as Error).message;
      setErr(msg.includes('403') ? 'Apenas o administrador pode ver esta página.' : msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: 'ACTIVE' | 'BLOCKED') {
    await api.patch(`/users/${id}/status`, { status });
    load();
  }

  const pending = users.filter((u) => u.status === 'PENDING');
  const others = users.filter((u) => u.status !== 'PENDING');

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Aprove novos cadastros e gerencie o acesso"
      />

      {err && (
        <Card className="mb-6 border-red-200 bg-red-50 text-sm text-red-700">{err}</Card>
      )}

      {resetInfo && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <div className="text-sm font-semibold text-amber-800">
            🔑 Senha temporária de {resetInfo.email}:
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-amber-900">
            {resetInfo.tempPassword}
          </div>
          <p className="mt-1 text-xs text-amber-700">
            Repasse ao usuário — ele será obrigado a trocar no primeiro login.
            Esta senha não será mostrada de novo.
          </p>
          <button
            onClick={() => setResetInfo(null)}
            className="mt-2 text-xs text-amber-700 underline"
          >
            fechar
          </button>
        </Card>
      )}

      {loading ? (
        <EmptyState>Carregando…</EmptyState>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-semibold text-amber-700">
                ⏳ Aguardando aprovação ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((u) => (
                  <Card key={u.id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-xs text-slate-400">
                          {u.email} · cadastrado em{' '}
                          {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setStatus(u.id, 'ACTIVE')}
                          className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          ✓ Aprovar
                        </button>
                        <button
                          onClick={() => setStatus(u.id, 'BLOCKED')}
                          className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <h2 className="mb-3 text-sm font-semibold text-slate-700">Todos os usuários</h2>
          {others.length === 0 && pending.length === 0 ? (
            <EmptyState>Nenhum usuário ainda.</EmptyState>
          ) : (
            <Card className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="px-5 py-3">Nome</th>
                    <th className="px-5 py-3">E-mail</th>
                    <th className="px-5 py-3">Papel</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {others.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50">
                      <td className="px-5 py-3 font-medium">{u.name}</td>
                      <td className="px-5 py-3 text-slate-500">{u.email}</td>
                      <td className="px-5 py-3">
                        {u.role === 'ADMIN' ? '👑 Admin' : 'Usuário'}
                      </td>
                      <td className="px-5 py-3">
                        <Badge status={u.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => resetPassword(u.id, u.email)}
                            className="text-xs font-medium text-amber-600 hover:underline"
                            title="Gera senha temporária e obriga troca no próximo login"
                          >
                            Resetar senha
                          </button>
                          {u.role !== 'ADMIN' && !u.mustChangePassword && (
                            <button
                              onClick={() => requireChange(u.id)}
                              className="text-xs font-medium text-slate-500 hover:underline"
                              title="No próximo login o usuário terá que definir nova senha"
                            >
                              Exigir troca
                            </button>
                          )}
                          {u.mustChangePassword && (
                            <span className="text-xs text-amber-500" title="Troca de senha pendente">
                              🔑 troca pendente
                            </span>
                          )}
                          {u.role !== 'ADMIN' &&
                            (u.status === 'ACTIVE' ? (
                              <button
                                onClick={() => setStatus(u.id, 'BLOCKED')}
                                className="text-xs font-medium text-red-600 hover:underline"
                              >
                                Bloquear
                              </button>
                            ) : (
                              <button
                                onClick={() => setStatus(u.id, 'ACTIVE')}
                                className="text-xs font-medium text-green-600 hover:underline"
                              >
                                Reativar
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </>
  );
}
