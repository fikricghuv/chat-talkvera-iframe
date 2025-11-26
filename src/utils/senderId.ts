export function getSenderId(): string {
  const SENDER_ID_KEY = 'sender_id';

  let senderId = localStorage.getItem(SENDER_ID_KEY);

  if (!senderId) {
    senderId = crypto.randomUUID();
    localStorage.setItem(SENDER_ID_KEY, senderId);
  }

  return senderId;
}
