import emailjs from '@emailjs/browser';

/* ════════════════════════════════════════════════════════════
   EMAIL SERVICE — sends attendance alert emails via EmailJS
   
   Setup instructions:
   1. Create a free account at https://www.emailjs.com
   2. Add an Email Service (e.g. Gmail) → note the Service ID
   3. Create an Email Template with these variables:
        {{to_email}}    — recipient email
        {{subject_name}} — the subject with low attendance
        {{percentage}}   — current attendance %
        {{target}}       — target attendance %
        {{need_to_attend}} — classes needed to reach target
        {{message}}      — full notification message
   4. Note the Template ID and your Public Key
   5. Add to your .env file:
        VITE_EMAILJS_SERVICE_ID=your_service_id
        VITE_EMAILJS_TEMPLATE_ID=your_template_id
        VITE_EMAILJS_PUBLIC_KEY=your_public_key
   ════════════════════════════════════════════════════════════ */

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

/**
 * Check whether EmailJS is configured (env vars present).
 */
export function isEmailConfigured() {
  return Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);
}

/**
 * Send a low-attendance alert email.
 * @param {{ toEmail: string, subjectName: string, percentage: string, target: number, needToAttend: number, message: string }} params
 * @returns {Promise<boolean>} true if sent successfully
 */
export async function sendAttendanceAlert({
  toEmail,
  subjectName,
  percentage,
  target,
  needToAttend,
  message,
}) {
  if (!isEmailConfigured()) {
    console.warn('[EmailService] EmailJS not configured — skipping email.');
    return false;
  }

  // Respect the user's email-reminders toggle
  const enabled = localStorage.getItem('emailReminders') === 'true';
  if (!enabled) return false;

  // De-duplicate: don't send the same alert twice in one day
  const dedupeKey = `email_sent_${subjectName}_${new Date().toISOString().slice(0, 10)}`;
  if (localStorage.getItem(dedupeKey)) return false;

  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: toEmail,
        subject_name: subjectName,
        percentage,
        target: String(target),
        need_to_attend: String(needToAttend),
        message,
      },
      PUBLIC_KEY,
    );
    localStorage.setItem(dedupeKey, 'true');
    return true;
  } catch (err) {
    console.error('[EmailService] Failed to send email:', err);
    return false;
  }
}
