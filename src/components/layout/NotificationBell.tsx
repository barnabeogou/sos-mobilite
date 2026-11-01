import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeInvalidate } from '@/hooks/useRealtime';
import { listNotifications, markNotificationsRead } from '@/services/notifications/notifications.service';
import { Modal } from '@/components/ui/Overlay';
import { EmptyState, LoadingBlock } from '@/components/ui/Display';
import { timeAgo } from '@/lib/format';
import type { AppNotification } from '@/types/database';

export function NotificationBell() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const uid = profile?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', uid],
    queryFn: () => listNotifications(uid!),
    enabled: Boolean(uid),
    refetchInterval: 60_000,
  });
  useRealtimeInvalidate('notifications', uid ? `user_id=eq.${uid}` : undefined, [['notifications', uid]], Boolean(uid));

  const markAll = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', uid] }),
  });

  const unread = (data ?? []).filter((n) => !n.read_at).length;

  const openNotification = async (n: AppNotification) => {
    if (!n.read_at) {
      void markNotificationsRead([n.id]).then(() => qc.invalidateQueries({ queryKey: ['notifications', uid] }));
    }
    setOpen(false);
    if (!n.request_id || !profile) return;
    if (profile.role === 'client') navigate(`/client/demandes/${n.request_id}`);
    else if (profile.role === 'mechanic') navigate(n.type === 'mission_proposed' ? '/pro' : `/pro/missions/${n.request_id}`);
    else navigate(`/admin/demandes/${n.request_id}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-night-850 text-silver-200 transition hover:text-white"
        aria-label={unread ? `Notifications (${unread} non lues)` : 'Notifications'}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-alert-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Notifications"
        footer={
          unread > 0 ? (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              className="inline-flex items-center gap-2 text-sm font-semibold text-electric-300 hover:text-electric-400"
            >
              <CheckCheck className="h-4 w-4" /> Tout marquer comme lu
            </button>
          ) : undefined
        }
      >
        {isLoading ? (
          <LoadingBlock />
        ) : !data?.length ? (
          <EmptyState icon={<Bell className="h-6 w-6" />} title="Aucune notification">
            Les mises à jour de vos interventions apparaîtront ici.
          </EmptyState>
        ) : (
          <ul className="-mx-2 divide-y divide-white/5">
            {data.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className="flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-white/[0.03]"
                >
                  <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-alert-500')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-white">{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-sm text-silver-400">{n.body}</span>}
                    <span className="mt-1 block text-xs text-silver-500">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
