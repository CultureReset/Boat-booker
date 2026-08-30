'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate as t } from '@/i18n/translate';
import { passwordRules } from '@/lib/auth/password';
import { api, errorMessage } from '@/lib/client/api';
import { useSession } from '@/components/providers/SessionProvider';
import { useToast } from '@/components/providers/ToastProvider';
import type { PublicUser } from '@/lib/auth/session';
import type { NotificationPreferences } from '@/lib/domain/types';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog, Overlay } from '@/components/ui/Overlay';
import { Button, Field, Input, Toggle } from '@/components/ui/primitives';
import { cx } from '@/components/ui/cx';

/**
 * Account settings: notifications, credentials, account type and deletion.
 *
 * Notification toggles save as they are flipped — there is no "unsaved
 * switches" state to lose. Anything destructive or credential-related is
 * behind an explicit confirmation.
 */
export function SettingsPanel({ user }: { user: PublicUser }) {
  const router = useRouter();
  const { refresh, logout } = useSession();
  const { toast } = useToast();

  const [prefs, setPrefs] = useState<NotificationPreferences>(user.notificationPreferences);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const togglePref = async (key: keyof NotificationPreferences, value: boolean) => {
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await api.patch('/api/me', { notificationPreferences: { [key]: value } });
    } catch (caught) {
      // Roll the switch back so the UI never claims a setting that did not save.
      setPrefs(previous);
      toast(errorMessage(caught), 'error');
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api.delete('/api/account');
      toast(t('account', 'deleteAccount'), 'success');
      await logout();
    } catch (caught) {
      toast(errorMessage(caught), 'error');
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      {/* ------------------------------------------------ notifications */}
      <section className="rounded-card border border-line bg-white p-4">
        <h2 className="mb-1 text-base font-bold text-ink">{t('account', 'notificationsTitle')}</h2>
        <p className="mb-2 text-sm text-ink-muted">{t('navigation', 'notifications')}</p>

        <h3 className="mt-4 text-sm font-bold text-ink">{t('account', 'notifyEmail')}</h3>
        <div className="divide-y divide-line">
          <Toggle
            label={t('account', 'notifyBookingUpdates')}
            checked={prefs.emailBookingUpdates}
            onChange={(v) => togglePref('emailBookingUpdates', v)}
          />
          <Toggle
            label={t('account', 'notifyMessages')}
            checked={prefs.emailMessages}
            onChange={(v) => togglePref('emailMessages', v)}
          />
          <Toggle
            label={t('account', 'notifyReviewReminders')}
            checked={prefs.emailReviewReminders}
            onChange={(v) => togglePref('emailReviewReminders', v)}
          />
          <Toggle
            label={t('account', 'notifyPromotions')}
            checked={prefs.emailPromotions}
            onChange={(v) => togglePref('emailPromotions', v)}
          />
        </div>

        <h3 className="mt-4 text-sm font-bold text-ink">{t('account', 'notifyPush')}</h3>
        <div className="divide-y divide-line">
          <Toggle
            label={t('account', 'notifyBookingUpdates')}
            checked={prefs.pushBookingUpdates}
            onChange={(v) => togglePref('pushBookingUpdates', v)}
          />
          <Toggle
            label={t('account', 'notifyMessages')}
            checked={prefs.pushMessages}
            onChange={(v) => togglePref('pushMessages', v)}
          />
        </div>

        <h3 className="mt-4 text-sm font-bold text-ink">{t('account', 'notifySms')}</h3>
        <div className="divide-y divide-line">
          <Toggle
            label={t('account', 'notifyBookingUpdates')}
            checked={prefs.smsBookingUpdates}
            onChange={(v) => togglePref('smsBookingUpdates', v)}
          />
        </div>
      </section>

      {/* ---------------------------------------------------- security */}
      <section className="rounded-card border border-line bg-white p-4">
        <h2 className="mb-3 text-base font-bold text-ink">{t('account', 'securityTitle')}</h2>
        <div className="space-y-2">
          <SettingRow
            icon="mail"
            label={t('login', 'email')}
            value={user.email}
            action={t('general', 'edit')}
            onClick={() => setEmailOpen(true)}
          />
          <SettingRow
            icon="lock"
            label={t('login', 'password')}
            value="••••••••"
            action={t('account', 'changePassword')}
            onClick={() => setPasswordOpen(true)}
          />
        </div>
      </section>

      {/* ------------------------------------------------ account type */}
      <section className="rounded-card border border-line bg-white p-4">
        <h2 className="mb-1 text-base font-bold text-ink">{t('account', 'accountType')}</h2>
        <p className="mb-3 text-sm text-ink-muted">
          {user.role === 'owner' ? t('account', 'accountTypeOwner') : t('account', 'accountTypeCustomer')}
        </p>
        {user.role !== 'owner' ? (
          <Button variant="outline" onClick={() => setOwnerOpen(true)}>
            {t('account', 'switchToOwner')}
          </Button>
        ) : null}
      </section>

      {/* ---------------------------------------------------- deletion */}
      <section className="rounded-card border border-danger/30 bg-white p-4">
        <h2 className="mb-1 text-base font-bold text-danger">{t('account', 'deleteAccount')}</h2>
        <p className="mb-3 text-sm text-ink-muted">{t('account', 'deleteAccountBody')}</p>
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>
          {t('account', 'deleteAccount')}
        </Button>
      </section>

      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <ChangeEmailDialog
        open={emailOpen}
        currentEmail={user.email}
        onClose={() => setEmailOpen(false)}
        onSaved={async () => {
          await refresh();
          router.refresh();
        }}
      />
      <BecomeOwnerDialog open={ownerOpen} onClose={() => setOwnerOpen(false)} />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteAccount}
        loading={busy}
        title={t('account', 'deleteAccount')}
        confirmLabel={t('account', 'deleteAccountConfirm')}
        body={<p>{t('account', 'deleteAccountBody')}</p>}
      />
    </div>
  );
}

function SettingRow({
  icon,
  label,
  value,
  action,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-control border border-line p-3">
      <Icon name={icon} size={18} className="shrink-0 text-ink-muted" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="truncate text-sm font-semibold text-ink">{value}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 text-sm font-semibold text-brand-700 hover:underline"
      >
        {action}
      </button>
    </div>
  );
}

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = passwordRules.map((rule) => ({ key: rule.key, met: rule.test(next) }));
  const valid = rules.every((rule) => rule.met);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.put('/api/account/password', { currentPassword: current, newPassword: next });
      toast(t('account', 'savedSuccess'), 'success');
      setCurrent('');
      setNext('');
      onClose();
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
      title={t('account', 'changePassword')}
      size="sm"
      footer={
        <Button fullWidth onClick={submit} loading={busy} disabled={!valid}>
          {t('general', 'save')}
        </Button>
      }
    >
      {error ? (
        <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        <Field label={t('account', 'currentPassword')}>
          {({ id }) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('login', 'newPassword')} required>
          {({ id }) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          )}
        </Field>
        <ul className="grid gap-1">
          {rules.map((rule) => (
            <li
              key={rule.key}
              className={cx('flex items-center gap-1.5 text-xs', rule.met ? 'text-success' : 'text-ink-muted')}
            >
              <Icon name={rule.met ? 'check-circle' : 'info'} size={13} />
              {t('login', rule.key)}
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-muted">{t('login', 'signedOut')}</p>
      </div>
    </Overlay>
  );
}

function ChangeEmailDialog({
  open,
  currentEmail,
  onClose,
  onSaved,
}: {
  open: boolean;
  currentEmail: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState(currentEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/account', { action: 'change_email', email });
      toast(t('account', 'savedSuccess'), 'success');
      await onSaved();
      onClose();
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
      title={t('login', 'email')}
      size="sm"
      footer={
        <Button fullWidth onClick={submit} loading={busy} disabled={email === currentEmail}>
          {t('general', 'save')}
        </Button>
      }
    >
      {error ? (
        <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <Field label={t('login', 'email')} required>
        {({ id }) => (
          <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        )}
      </Field>
    </Overlay>
  );
}

function BecomeOwnerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { refresh } = useSession();
  const { toast } = useToast();

  const [companyName, setCompanyName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/account', { action: 'become_owner', companyName });
      await refresh();
      toast(t('account', 'savedSuccess'), 'success');
      // The owner dashboard is a different shell, so a full navigation is right.
      router.push('/owner');
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  return (
    <Overlay
      open={open}
      onClose={onClose}
      title={t('login', 'listYourBusiness')}
      size="sm"
      footer={
        <Button fullWidth onClick={submit} loading={busy} disabled={companyName.trim().length < 2}>
          {t('general', 'continue')}
        </Button>
      }
    >
      {error ? (
        <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <p className="mb-3 text-sm text-ink-muted">{t('login', 'accountTypeOwnerBody')}</p>
      <Field label={t('login', 'companyName')} required>
        {({ id }) => (
          <Input
            id={id}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={t('login', 'companyNamePlaceholder')}
            autoComplete="organization"
          />
        )}
      </Field>
    </Overlay>
  );
}
