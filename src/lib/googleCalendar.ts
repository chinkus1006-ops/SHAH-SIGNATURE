/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CalendarEventPayload {
  summary: string;
  description: string;
  location?: string;
  startDateTime: string; // ISO string
  endDateTime: string; // ISO string
}

export interface CalendarApiResult {
  success: boolean;
  eventLink?: string;
  error?: string;
}

/**
 * Creates a Google Calendar event for doorstep valet appointment or order pickup.
 * NOTE: Must only be invoked after explicit user confirmation in the UI.
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  event: CalendarEventPayload
): Promise<CalendarApiResult> {
  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.startDateTime,
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: event.endDateTime,
          timeZone: 'Asia/Kolkata',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'email', minutes: 60 },
          ],
        },
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error?.message || `HTTP ${res.status}: Failed to schedule Google Calendar event.`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      eventLink: data.htmlLink,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error connecting to Google Calendar API.',
    };
  }
}
