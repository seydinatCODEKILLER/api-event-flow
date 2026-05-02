import { Expo } from "expo-server-sdk";
import logger from "../../config/logger.js";

const expo = new Expo();

export const sendPushNotification = async ({
  token,
  title,
  body,
  data = {},
}) => {
  // Vérifier que le token est valide avant d'envoyer
  if (!Expo.isExpoPushToken(token)) {
    logger.warn({ token }, "Push token Expo invalide — envoi ignoré");
    return;
  }

  const message = {
    to: token,
    sound: "default",
    title,
    body,
    data,
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);

    for (const chunk of chunks) {
      const receipts = await expo.sendPushNotificationsAsync(chunk);

      for (const receipt of receipts) {
        if (receipt.status === "error") {
          logger.error({ receipt }, `Erreur push Expo : ${receipt.message}`);

          // Token invalide ou expiré → à nettoyer en DB
          if (receipt.details?.error === "DeviceNotRegistered") {
            logger.warn({ token }, "Token Expo expiré — à supprimer en DB");
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err, token }, "Échec envoi push Expo");
    throw err;
  }
};
