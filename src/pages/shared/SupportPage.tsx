import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { LifeBuoy, Mail, MessageCircle, Phone, Plus } from 'lucide-react';
import { useProfile } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/queries';
import { AnchorButton, Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader } from '@/components/ui/Display';
import { Modal, useToast } from '@/components/ui/Overlay';
import { createTicket, listMyTickets } from '@/services/support.service';
import { supportContacts } from '@/services/catalog.service';
import { ticketSchema } from '@/domain/validation';
import { TICKET_CATEGORIES, EMERGENCY_NOTICE } from '@/domain/catalog';
import { TICKET_STATUS } from '@/domain/status';
import { formatDateTime, telHref, whatsappHref } from '@/lib/format';
import { errorMessage } from '@/lib/errors';

type Form = z.infer<typeof ticketSchema>;

export default function SupportPage() {
  const profile = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: settings } = useSettings();
  const contacts = supportContacts(settings);
  const [open, setOpen] = useState(false);
  const tickets = useQuery({ queryKey: ['tickets', profile.id], queryFn: () => listMyTickets(profile.id) });

  const { register, handleSubmit, formState, reset } = useForm<Form>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { category: 'intervention', subject: '', message: '' },
  });
  const submit = handleSubmit(async (v) => {
    try {
      await createTicket(profile.id, v);
      toast.success('Votre message a été transmis au support.');
      reset();
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['tickets', profile.id] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <>
      <PageHeader
        title="Support"
        subtitle="Une question, une réclamation, un souci pendant une intervention ?"
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Nouveau message
          </Button>
        }
      />

      {(contacts.phone || contacts.whatsapp || contacts.email) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {contacts.phone && (
            <AnchorButton href={telHref(contacts.phone)} icon={<Phone className="h-4 w-4" />}>
              {contacts.phone}
            </AnchorButton>
          )}
          {contacts.whatsapp && (
            <AnchorButton href={whatsappHref(contacts.whatsapp)} target="_blank" rel="noreferrer" icon={<MessageCircle className="h-4 w-4" />}>
              WhatsApp
            </AnchorButton>
          )}
          {contacts.email && (
            <AnchorButton href={`mailto:${contacts.email}`} icon={<Mail className="h-4 w-4" />}>
              {contacts.email}
            </AnchorButton>
          )}
        </div>
      )}

      <Notice tone="danger" className="mb-6">
        {EMERGENCY_NOTICE}
      </Notice>

      <h2 className="mb-3 text-lg font-bold">Mes demandes au support</h2>
      {tickets.isLoading ? (
        <LoadingBlock />
      ) : tickets.isError ? (
        <ErrorState message={errorMessage(tickets.error)} onRetry={() => tickets.refetch()} />
      ) : !tickets.data?.length ? (
        <EmptyState icon={<LifeBuoy className="h-6 w-6" />} title="Aucun message envoyé" />
      ) : (
        <div className="space-y-3">
          {tickets.data.map((t) => (
            <Card key={t.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{t.subject}</p>
                  <p className="text-xs text-silver-500">
                    {TICKET_CATEGORIES.find((c) => c.value === t.category)?.label} · {formatDateTime(t.created_at)}
                  </p>
                </div>
                <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-silver-300">{t.message}</p>
              {t.admin_response && (
                <div className="mt-3 rounded-xl border border-electric-500/20 bg-electric-500/[0.06] p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-electric-300">Réponse du support</p>
                  <p className="whitespace-pre-line text-silver-200">{t.admin_response}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Écrire au support"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submit} loading={formState.isSubmitting}>
              Envoyer
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <Select label="Sujet" {...register('category')}>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Input label="Objet" {...register('subject')} error={formState.errors.subject?.message} />
          <Textarea label="Message" rows={5} {...register('message')} error={formState.errors.message?.message} />
        </form>
      </Modal>
    </>
  );
}
