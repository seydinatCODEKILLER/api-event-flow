import QRCode from "qrcode";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

/**
 * Génère le payload JWT signé pour un ticket
 */
export const generateTicketPayload = (ticketId, eventId, participantId) => {
  return jwt.sign(
    { ticketId, eventId, participantId },
    env.JWT_SECRET,
    { expiresIn: "365d" }
  );
};

/**
 * Vérifie et décode un payload JWT de ticket
 */
export const verifyTicketPayload = (payload) => {
  try {
    return jwt.verify(payload, env.JWT_SECRET);
  } catch {
    return null;
  }
};

/**
 * Génère un QR code en base64 PNG à partir du payload JWT
 * @param {string} payload - JWT signé
 * @returns {Promise<string>} - base64 PNG (sans préfixe data:image)
 */
export const generateQrCodeBase64 = async (payload) => {
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 300,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  // Retirer le préfixe "data:image/png;base64,"
  return dataUrl.split(",")[1];
};

/**
 * Génère payload JWT + QR code base64 en une seule opération
 */
export const generateTicketQr = async (ticketId, eventId, participantId) => {
  const payload = generateTicketPayload(ticketId, eventId, participantId);
  const qrBase64 = await generateQrCodeBase64(payload);
  return { payload, qrBase64 };
};