'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Painel', icon: '📊' },
  { href: '/produtos', label: 'Produtos', icon: '📦' },
  { href: '/estoque', label: 'Estoque', icon: '🔢' },
  { href: '/pedidos', label: 'Pedidos', icon: '🧾' },
  { href: '/marketplaces', label: 'Marketplaces', icon: '🔌' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
      <div className="px-5 py-6">
        <div className="text-lg font-bold text-brand">Integração</div>
        <div className="text-xs text-slate-400">Multiplataforma</div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-brand text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-xs text-slate-400">v0.1.0</div>
    </aside>
  );
}
