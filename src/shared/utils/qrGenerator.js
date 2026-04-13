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
 * Génère un QR code en Buffer PNG
 */
export const generateQrCodeBuffer = async (payload) => {
  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 400,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
};

/**
 * Génère un QR code en base64 PNG (fallback email inline)
 */
export const generateQrCodeBase64 = async (payload) => {
  const buffer = await generateQrCodeBuffer(payload);
  return buffer.toString("base64");
};

/**
 * Génère payload JWT + Buffer PNG en une seule opération
 */
export const generateTicketQr = async (ticketId, eventId, participantId) => {
  const payload = generateTicketPayload(ticketId, eventId, participantId);
  const buffer = await generateQrCodeBuffer(payload);
  return { payload, buffer };
};