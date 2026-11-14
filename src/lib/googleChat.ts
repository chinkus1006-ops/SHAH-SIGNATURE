/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChatSpace {
  name: string; // e.g. "spaces/AAAAAAAAAAA"
  displayName?: string;
  type?: 'SPACE' | 'GROUP_CHAT' | 'DIRECT_MESSAGE';
  spaceType?: string;
}

export interface ChatMessage {
  name?: string;
  text: string;
  createTime?: string;
  sender?: {
    displayName?: string;
    avatarUrl?: string;
    type?: string;
  };
}

export interface ChatApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  isNotConfigured?: boolean;
}

const CHAT_API_BASE = 'https://chat.googleapis.com/v1';

/**
 * List spaces accessible to the authenticated user.
 * Handles the Google Chat App not configured 404 requirement.
 */
export async function listChatSpaces(accessToken: string): Promise<ChatApiResult<ChatSpace[]>> {
  try {
    const res = await fetch(`${CHAT_API_BASE}/spaces`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 404) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error?.message || 'Google Chat app not found.';
      return {
        success: false,
        error: msg,
        isNotConfigured: true,
      };
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error?.message || `HTTP ${res.status}: Failed to fetch Google Chat spaces.`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      data: data.spaces || [],
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error communicating with Google Chat API.',
    };
  }
}

/**
 * Send a message to a Google Chat space.
 * NOTE: Must only be invoked after explicit user confirmation in UI.
 */
export async function sendChatMessage(
  accessToken: string,
  spaceName: string,
  text: string
): Promise<ChatApiResult<ChatMessage>> {
  try {
    const res = await fetch(`${CHAT_API_BASE}/${spaceName}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (res.status === 404) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error?.message || 'Google Chat space or app configuration not found.',
        isNotConfigured: true,
      };
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error?.message || `HTTP ${res.status}: Failed to send message to Google Chat.`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error sending Google Chat message.',
    };
  }
}
