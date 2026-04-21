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

  const qrSrc = qrImageUrl ? qrImageUrl : `data:image/png;base64,${qrBase64}`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre ticket — ${eventTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f4ff;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f4ff;padding:28px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="background-color:#ffffff;border-radius:16px;overflow:hidden;max-width:560px;width:100%;border:1px solid #ede9fe;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:36px 40px 32px;text-align:center;">
              <table cellpadding="0" cellspacing="0" align="center" style="margin-bottom:8px;">
                <tr>
                  <td style="background:rgba(255,255,255,0.2);border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle;">
                    <span style="color:white;font-size:16px;">✦</span>
                  </td>
                  <td style="padding-left:10px;">
                    <span style="color:white;font-size:18px;font-weight:600;letter-spacing:-0.3px;">EventFlow</span>
                  </td>
                </tr>
              </table>
              <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0;">Votre billet d'entrée</p>
            </td>
          </tr>

          <!-- Salutation -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="color:#111827;font-size:15px;margin:0 0 4px;">
                Bonjour <strong style="font-weight:600;">${participantName}</strong>,
              </p>
              <p style="color:#6b7280;font-size:14px;margin:0;line-height:1.6;">
                Votre inscription est confirmée. Présentez ce QR code à l'entrée.
              </p>
            </td>
          </tr>

          <!-- Infos événement -->
          <tr>
            <td style="padding:20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background-color:#faf9ff;border-radius:12px;border-left:4px solid #6366f1;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <h2 style="color:#1e1b4b;font-size:16px;font-weight:600;margin:0 0 14px;">${eventTitle}</h2>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:0 0 8px;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background:#ede9fe;border-radius:6px;width:28px;height:28px;text-align:center;vertical-align:middle;">
                                <span style="font-size:13px;">📍</span>
                              </td>
                              <td style="padding-left:10px;color:#6b7280;font-size:13px;">${eventLocation}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background:#ede9fe;border-radius:6px;width:28px;height:28px;text-align:center;vertical-align:middle;">
                                <span style="font-size:13px;">📅</span>
                              </td>
                              <td style="padding-left:10px;color:#6b7280;font-size:13px;">${formattedDate}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- QR Code -->
          <tr>
            <td style="padding:4px 40px 28px;text-align:center;">
              <p style="color:#9ca3af;font-size:11px;margin:0 0 14px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">
                Code d'entrée
              </p>
              <table cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="background:#ffffff;border-radius:14px;border:1px solid #e5e7eb;padding:14px;">
                    <img src="${qrSrc}" alt="QR Code" width="160" height="160"
                      style="display:block;border-radius:4px;" />
                  </td>
                </tr>
              </table>
              <p style="color:#9ca3af;font-size:11px;margin:12px 0 0;letter-spacing:1px;font-family:monospace;">
                ${ticketId.slice(0, 8).toUpperCase()}
              </p>
            </td>
          </tr>

          <!-- Separateur -->
          <tr>
            <td style="padding:0 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="16" style="background:#f5f4ff;border-radius:50%;height:20px;"></td>
                  <td style="border-top:2px dashed #e5e7eb;"></td>
                  <td width="16" style="background:#f5f4ff;border-radius:50%;height:20px;"></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Avertissement -->
          <tr>
            <td style="padding:20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background-color:#fef9ec;border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:top;padding-right:10px;">
                          <div style="background:#fde68a;border-radius:50%;width:20px;height:20px;text-align:center;line-height:20px;font-size:11px;">!</div>
                        </td>
                        <td style="color:#92400e;font-size:12.5px;line-height:1.55;">
                          Ce QR code est personnel et à usage unique. Ne le partagez pas.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px 24px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="color:#9ca3af;font-size:11.5px;margin:0;line-height:1.6;">
                Envoyé automatiquement par EventFlow · Ne pas répondre
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
