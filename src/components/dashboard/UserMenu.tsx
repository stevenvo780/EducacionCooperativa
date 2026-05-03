'use client';

import { useEffect, useRef, useState } from 'react';
import { CreditCard, KeyRound, LogOut, Sparkles, Users, HardDrive, type LucideIcon } from 'lucide-react';
import { authFetch } from '@/services/apiClient';

interface UserMenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  email: string;
  displayName?: string | null;
  planName?: string;
  onChangePassword: () => void;
  onShowMembers: () => void;
  onOpenPricing: () => void;
  onLogout: () => void;
}

interface Item {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  description?: string;
  danger?: boolean;
}

export default function UserMenu({
  open,
  onClose,
  anchorRef,
  email,
  displayName,
  planName,
  onChangePassword,
  onShowMembers,
  onOpenPricing,
  onLogout
}: UserMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [storage, setStorage] = useState<{ usedBytes: number; limitBytes: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      try {
        const res = await authFetch('/api/payments/storage-usage');
        if (!res.ok) return;
        const data = await res.json() as { usedBytes?: number; limitBytes?: number };
        if (active && typeof data.usedBytes === 'number' && typeof data.limitBytes === 'number') {
          setStorage({ usedBytes: data.usedBytes, limitBytes: data.limitBytes });
        }
      } catch { /* sin storage info */ }
    })();
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const items: Item[] = [
    {
      id: 'plan',
      label: planName ? `Plan: ${planName}` : 'Cambiar plan',
      icon: CreditCard,
      description: 'Gestiona tu suscripción',
      onClick: onOpenPricing
    },
    {
      id: 'members',
      label: 'Miembros del workspace',
      icon: Users,
      onClick: onShowMembers
    },
    {
      id: 'password',
      label: 'Cambiar contraseña',
      icon: KeyRound,
      onClick: onChangePassword
    },
    {
      id: 'logout',
      label: 'Cerrar sesión',
      icon: LogOut,
      danger: true,
      onClick: onLogout
    }
  ];

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Menú de cuenta"
      className="fixed bottom-3 left-14 z-[60] w-72 overflow-hidden rounded-lg border border-surface-700/60 bg-surface-900 shadow-2xl shadow-black/40"
    >
      <div className="border-b border-surface-700/60 px-3 py-2.5">
        <div className="flex items-center gap-1 text-xs text-surface-300">
          <Sparkles className="h-3 w-3 text-mandy-300" />
          <span className="truncate font-medium">{displayName || email}</span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-surface-500">{email}</p>
        {storage && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] text-surface-500">
              <span className="flex items-center gap-1">
                <HardDrive className="h-2.5 w-2.5" />
                {formatBytes(storage.usedBytes)} de {formatBytes(storage.limitBytes)}
              </span>
              <span className="text-surface-400">{Math.round((storage.usedBytes / storage.limitBytes) * 100)}%</span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-800">
              <div
                className={`h-full transition-[width] ${
                  storage.usedBytes / storage.limitBytes > 0.9 ? 'bg-rose-400' :
                  storage.usedBytes / storage.limitBytes > 0.7 ? 'bg-amber-300' :
                  'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, (storage.usedBytes / storage.limitBytes) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <ul className="py-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  item.onClick();
                  onClose();
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition ${
                  item.danger
                    ? 'text-rose-300 hover:bg-rose-500/10'
                    : 'text-surface-200 hover:bg-surface-800/70'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{item.label}</span>
                  {item.description && (
                    <span className="truncate text-[10px] text-surface-500">{item.description}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
