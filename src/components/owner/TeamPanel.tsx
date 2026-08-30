'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { formatDate } from '@/lib/core/dates';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/providers/ToastProvider';
import type { TeamMember } from '@/lib/domain/types';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog, Overlay } from '@/components/ui/Overlay';
import { Badge, Button, Field, Input, Select } from '@/components/ui/primitives';

/**
 * Team members.
 *
 * Roles decide what a member can reach: a captain sees the calendar and their
 * own trips; a manager can also respond to bookings. The account owner cannot
 * be removed from their own team.
 */
export function TeamPanel({ members: initial }: { members: TeamMember[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [members, setMembers] = useState(initial);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await api.delete(`/api/owner/team?memberId=${removeTarget.id}`);
      setMembers((current) => current.filter((m) => m.id !== removeTarget.id));
      setRemoveTarget(null);
      toast(t('general', 'remove'), 'success');
      router.refresh();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setBusy(false);
    }
  };

  const roleLabel = (role: TeamMember['role']) =>
    role === 'owner' ? t('owner', 'teamRoleOwner')
    : role === 'manager' ? t('owner', 'teamRoleManager')
    : t('owner', 'teamRoleCaptain');

  return (
    <div className="max-w-xl">
      <p className="mb-4 text-sm text-ink-muted">{t('owner', 'teamBody')}</p>

      <ul className="space-y-2">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 rounded-card border border-line bg-white p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
              {member.name
                .split(' ')
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() ?? '')
                .join('')}
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                {member.name}
                <Badge tone={member.role === 'owner' ? 'brand' : 'neutral'}>{roleLabel(member.role)}</Badge>
              </p>
              <p className="truncate text-xs text-ink-muted">
                {member.email}
                {!member.acceptedAt
                  ? ` · invited ${formatDate(member.invitedAt.slice(0, 10), 'short')}`
                  : ''}
              </p>
            </div>

            {member.role !== 'owner' ? (
              <button
                type="button"
                onClick={() => setRemoveTarget(member)}
                aria-label={t('general', 'remove')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken hover:text-danger"
              >
                <Icon name="trash" size={16} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <Button className="mt-4" variant="outline" icon="plus" onClick={() => setInviteOpen(true)}>
        {t('owner', 'inviteTeamMember')}
      </Button>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={(member) => {
          setMembers((current) => [...current, member]);
          setInviteOpen(false);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={remove}
        loading={busy}
        title={t('general', 'remove')}
        confirmLabel={t('general', 'remove')}
        body={removeTarget ? <p>{removeTarget.name} · {removeTarget.email}</p> : null}
      />
    </div>
  );
}

function InviteDialog({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: (member: TeamMember) => void;
}) {
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'manager' | 'captain'>('captain');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const member = await api.post<TeamMember>('/api/owner/team', { name, email, role });
      toast(t('owner', 'inviteTeamMember'), 'success');
      setName('');
      setEmail('');
      onInvited(member);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay
      open={open}
      onClose={onClose}
      title={t('owner', 'inviteTeamMember')}
      size="sm"
      footer={
        <Button fullWidth onClick={submit} loading={busy} disabled={!valid}>
          {t('owner', 'inviteTeamMember')}
        </Button>
      }
    >
      {error ? (
        <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        <Field label={t('login', 'firstName')}>
          {({ id }) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label={t('login', 'email')} required>
          {({ id }) => (
            <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <Field label={t('owner', 'teamRoleCaptain')}>
          {({ id }) => (
            <Select id={id} value={role} onChange={(e) => setRole(e.target.value as 'manager' | 'captain')}>
              <option value="captain">{t('owner', 'teamRoleCaptain')}</option>
              <option value="manager">{t('owner', 'teamRoleManager')}</option>
            </Select>
          )}
        </Field>
      </div>
    </Overlay>
  );
}
