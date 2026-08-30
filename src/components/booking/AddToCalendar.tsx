'use client';

import { translate as t } from '@/i18n/translate';
import { Button } from '@/components/ui/primitives';

/**
 * "Add to calendar" as a generated .ics download.
 *
 * A data-URI ics file works in every calendar app on every platform without
 * sending the trip details to a third-party calendar service first.
 */
export function AddToCalendar({
  title,
  date,
  time,
  durationHours,
  location,
  description,
}: {
  title: string;
  date: string;
  time: string;
  durationHours: number;
  location: string;
  description: string;
}) {
  const download = () => {
    const [hour, minute] = time.split(':').map(Number);
    const start = new Date(`${date}T${String(hour ?? 9).padStart(2, '0')}:${String(minute ?? 0).padStart(2, '0')}:00`);
    const end = new Date(start.getTime() + durationHours * 3_600_000);

    // ICS wants a compact UTC stamp with no separators.
    const stamp = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BoatBooker//Booking//EN',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@boatbooker`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escapeIcs(title)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `LOCATION:${escapeIcs(location)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'boat-trip.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Release the object URL once the download has been handed to the browser.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Button variant="outline" size="lg" icon="calendar" onClick={download}>
      {t('booking', 'addToCalendar')}
    </Button>
  );
}

/** Escape the characters ICS treats as structural. */
function escapeIcs(value: string): string {
  return value.replace(/[\\;,]/g, (match) => `\\${match}`).replace(/\n/g, '\\n');
}
