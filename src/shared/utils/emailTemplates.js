/**
 * Template email d'envoi de ticket avec QR code
 * Utilise qrImageUrl (Cloudinary) en priorité, sinon qrBase64 inline
 */
export const ticketEmailTemplate = ({
  participantName,
  eventTitle,
  eventLocation,
  eventDate,
  qrImageUrl = null,
  qrBase64 = null,
  ticketId,
}) => {
  const formattedDate = new Date(eventDate).toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const qrSrc = qrImageUrl
    ? qrImageUrl
    : `data:image/png;base64,${qrBase64}`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre ticket — ${eventTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
    style="background-color:#f4f4f4;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
          style="background-color:#ffffff;border-radius:8px;overflow:hidden;
          max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1E3A5F;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">
                EventFlow
              </h1>
              <p style="color:#93c5fd;margin:8px 0 0;font-size:14px;">
                Votre billet d'entrée
              </p>
            </td>
          </tr>

          <!-- Salutation -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="color:#374151;font-size:16px;margin:0;">
                Bonjour <strong>${participantName}</strong>,
              </p>
              <p style="color:#6b7280;font-size:15px;margin:12px 0 0;line-height:1.6;">
                Votre inscription a été confirmée.
                Présentez ce QR code à l'entrée de l'événement.
              </p>
            </td>
          </tr>

          <!-- Infos événement -->
          <tr>
            <td style="padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background-color:#f0f7ff;border-radius:8px;
                border-left:4px solid #1E3A5F;">
                <tr>
                  <td style="padding:20px 24px;">
                    <h2 style="color:#1E3A5F;margin:0 0 12px;font-size:18px;">
                      ${eventTitle}
                    </h2>
                    <p style="color:#374151;margin:0 0 6px;font-size:14px;">
                      📍 <strong>Lieu :</strong> ${eventLocation}
                    </p>
                    <p style="color:#374151;margin:0;font-size:14px;">
                      📅 <strong>Date :</strong> ${formattedDate}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- QR Code -->
          <tr>
            <td style="padding:0 40px 32px;text-align:center;">
              <p style="color:#374151;font-size:14px;margin:0 0 16px;font-weight:600;">
                Votre QR code d'entrée
              </p>
              <img
                src="${qrSrc}"
                alt="QR Code ticket"
                width="220"
                height="220"
                style="border:8px solid #f0f7ff;border-radius:8px;display:block;margin:0 auto;"
              />
              <p style="color:#9ca3af;font-size:11px;margin:12px 0 0;">
                Référence : ${ticketId.slice(0, 8).toUpperCase()}
              </p>
            </td>
          </tr>

          <!-- Avertissement -->
          <tr>
            <td style="padding:0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background-color:#fff7ed;border-radius:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="color:#92400e;font-size:13px;margin:0;line-height:1.5;">
                      ⚠️ Ce QR code est personnel et ne peut être utilisé
                      qu'une seule fois. Ne le partagez pas.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:20px 40px;
              text-align:center;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                Cet email a été envoyé automatiquement par EventFlow.
                Ne pas répondre à cet email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};