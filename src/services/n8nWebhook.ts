interface N8nMessagePayload {
  sender_id: string;
  role: 'agent' | 'user';
  message: string;
  created_at: string;
  timestamp?: number;
}

export async function sendMessageToN8n(payload: N8nMessagePayload): Promise<void> {
  try {
    const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;

    if (!n8nUrl) {
      console.warn('N8N webhook URL not configured. Message not sent to webhook.');
      return;
    }

    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`N8N webhook error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to send message to N8N webhook:', error);
  }
}
