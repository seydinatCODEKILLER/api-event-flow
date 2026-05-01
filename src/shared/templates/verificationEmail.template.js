export const verificationEmailTemplate = ({ userName, verificationLink }) => {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vérifiez votre email — EventFlow</title>
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
              <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0;">Confirmation de votre inscription</p>
            </td>
          </tr>

          <!-- Salutation -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="color:#111827;font-size:15px;margin:0 0 4px;">
                Bonjour <strong style="font-weight:600;">${userName}</strong>,
              </p>
              <p style="color:#6b7280;font-size:14px;margin:0;line-height:1.6;">
                Merci de vous être inscrit sur EventFlow ! Pour activer votre compte, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous.
              </p>
            </td>
          </tr>

          <!-- Bouton de vérification -->
          <tr>
            <td style="padding:28px 40px;text-align:center;">
              <a href="${verificationLink}"
                style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;font-size:14px;font-weight:600;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.2px;">
                Vérifier mon email
              </a>
            </td>
          </tr>

          <!-- Lien en fallback -->
          <tr>
            <td style="padding:0 40px 24px;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">
                Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :
              </p>
              <p style="color:#6366f1;font-size:11px;margin:6px 0 0;word-break:break-all;line-height:1.5;">
                ${verificationLink}
              </p>
            </td>
          </tr>

          <!-- Séparateur -->
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

          <!-- Info expiration -->
          <tr>
            <td style="padding:20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background-color:#fef9ec;border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:top;padding-right:10px;">
                          <div style="background:#fde68a;border-radius:50%;width:20px;height:20px;text-align:center;line-height:20px;font-size:11px;">⏱</div>
                        </td>
                        <td style="color:#92400e;font-size:12.5px;line-height:1.55;">
                          Ce lien est valable <strong>24 heures</strong>. Passé ce délai, vous devrez demander un nouvel email de vérification.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Sécurité -->
          <tr>
            <td style="padding:4px 40px 24px;">
              <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">
                Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email en toute sécurité.
              </p>
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