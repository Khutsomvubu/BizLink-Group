/* ============================================================
   BizLink — shared settings (edit this file only)
   Loaded by index.html and forgot-password.html, so you enter
   your EmailJS details once.

   EmailJS setup (https://www.emailjs.com):
   1. Add an Email Service            -> serviceId
   2. Account > General               -> publicKey
   3. Create TWO email templates:

      A) Password-reset code  -> resetTemplateId
         Subject: Your {{app_name}} verification code
         Body:    Your code is {{passcode}}. It expires in
                  {{expiry_minutes}} minutes. If you did not ask
                  for this, ignore this email.
         "To Email" field: {{to_email}}

      B) Delivery-delay alert -> templateId
         Variables: {{order_id}} {{customer_name}} {{rider_name}}
                    {{message}} {{reply_to}}
         "To Email" field: {{to_email}}
   ============================================================ */
window.BIZLINK_CONFIG = {
  appName: 'BizLink',
  emailjs: {
    publicKey: 'YOUR_PUBLIC_KEY',
    serviceId: 'YOUR_SERVICE_ID',
    resetTemplateId: 'YOUR_RESET_TEMPLATE_ID',   // password-reset code email
    templateId: 'YOUR_TEMPLATE_ID',              // delivery-delay alert email
    supportEmail: 'support@yourdomain.com'       // receives delay alerts
  },
  reset: {
    codeLength: 6,
    expiryMinutes: 6,
    maxVerifyAttempts: 5,      // wrong guesses before the code is destroyed
    resendCooldownSec: 60,     // wait between sends
    maxSendsPerHour: 3         // per browser
  }
};
