import { TicketRepository } from "./ticket.repository.js";
import { EventRepository } from "../events/event.repository.js";
import {
  generateTicketQr,
  generateQrCodeBase64,
  verifyTicketPayload,
} from "../../shared/utils/qrGenerator.js";
import MediaUploader from "../../shared/utils/uploader.js";
import { sendEmail } from "../../config/mailer.js";
import { ticketEmailTemplate } from "../../shared/utils/emailTemplates.js";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from "../../shared/errors/AppError.js";
import logger from "../../config/logger.js";

const ticketRepo = new TicketRepository();
const eventRepo = new EventRepository();

// ─── Helpers ──────────────────────────────────────────────────

const assertOrganizerOwnsEvent = async (eventId, organizerId) => {
  const event = await eventRepo.findById(eventId);
  if (!event) throw new NotFoundError("Événement");
  if (event.organizerId !== organizerId) {
    throw new ForbiddenError(
      "Vous n'êtes pas l'organisateur de cet événement"
    );
  }
  return event;
};

const buildTicketResponse = (ticket) => ({
  id: ticket.id,
  status: ticket.status,
  qrPayload: ticket.qrPayload,
  qrUrl: ticket.qrUrl ?? null,
  usedAt: ticket.usedAt ?? null,
  participant: ticket.participant ?? undefined,
  event: ticket.event ?? undefined,
  emailLogs: ticket.emailLogs ?? undefined,
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
});

// ─── Service ──────────────────────────────────────────────────

export class TicketService {

  // ─── Créer un ticket + générer QR + upload Cloudinary ────────
  async createTicket(eventId, participantId) {
    const existing = await ticketRepo.findByEventAndParticipant(
      eventId,
      participantId
    );
    if (existing) {
      throw new ConflictError(
        "Ce participant a déjà un ticket pour cet événement"
      );
    }

    // Créer le ticket sans payload pour obtenir l'ID
    const ticket = await ticketRepo.create({
      eventId,
      participantId,
      qrPayload: "",
      status: "ACTIVE",
    });

    // Générer payload JWT + Buffer PNG
    const { payload, buffer } = await generateTicketQr(
      ticket.id,
      eventId,
      participantId
    );

    // Upload QR code sur Cloudinary
    const uploader = new MediaUploader();
    let qrUrl = null;
    let qrPublicId = null;

    try {
      const uploaded = await uploader.uploadBuffer(
        buffer,
        "eventflow/qrcodes",
        `qr_${ticket.id}`
      );
      qrUrl = uploaded.url;
      qrPublicId = uploaded.public_id;
    } catch (err) {
      logger.warn(
        { err, ticketId: ticket.id },
        "QR upload Cloudinary échoué — fallback base64 à l'envoi email"
      );
    }

    // Mettre à jour le ticket avec payload + URL QR
    const updated = await ticketRepo.updateTicket(ticket.id, {
      qrPayload: payload,
      ...(qrUrl && { qrUrl }),
      ...(qrPublicId && { qrPublicId }),
    });

    return { ticket: updated, qrUrl, buffer };
  }

  // ─── Envoyer le ticket par email ──────────────────────────────
  async sendTicketEmail(ticketId, organizerId, isResend = false) {
    const ticket = await ticketRepo.findByIdFull(ticketId);
    if (!ticket) throw new NotFoundError("Ticket");

    await assertOrganizerOwnsEvent(ticket.eventId, organizerId);

    if (ticket.status === "CANCELLED") {
      throw new BadRequestError("Impossible d'envoyer un ticket annulé");
    }

    if (!ticket.participant.email) {
      throw new BadRequestError(
        "Ce participant n'a pas d'adresse email — envoi impossible"
      );
    }

    // Créer le log email en PENDING
    const emailLog = await ticketRepo.createEmailLog({
      ticketId,
      to: ticket.participant.email,
      type: isResend ? "TICKET_RESEND" : "TICKET",
      status: "PENDING",
    });

    // Utiliser qrUrl Cloudinary si disponible, sinon générer base64
    const qrImageUrl = ticket.qrUrl || null;
    const qrBase64 = qrImageUrl
      ? null
      : await generateQrCodeBase64(ticket.qrPayload);

    const html = ticketEmailTemplate({
      participantName: ticket.participant.fullName,
      eventTitle: ticket.event.title,
      eventLocation: ticket.event.location,
      eventDate: ticket.event.startDate,
      qrImageUrl,
      qrBase64,
      ticketId: ticket.id,
    });

    try {
      await sendEmail({
        to: ticket.participant.email,
        toName: ticket.participant.fullName,
        subject: `Votre ticket — ${ticket.event.title}`,
        html,
      });

      await ticketRepo.updateEmailLog(emailLog.id, {
        status: "SENT",
        sentAt: new Date(),
      });

      logger.logEvent("ticket_email_sent", {
        ticketId,
        to: ticket.participant.email,
        type: emailLog.type,
      });

      return { sent: true, to: ticket.participant.email };
    } catch (err) {
        logger.error(err
        )
      await ticketRepo.updateEmailLog(emailLog.id, {
        status: "FAILED",
        error: err.message,
      });

      logger.error({ err, ticketId }, "Échec envoi email ticket");
      throw new BadRequestError(
        "Échec de l'envoi de l'email — réessayez plus tard"
      );
    }
  }

  // ─── Lister les tickets d'un événement ───────────────────────
  async getTickets(eventId, userId, role, options = {}) {
    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");

    if (role === "ORGANIZER" && event.organizerId !== userId) {
      throw new ForbiddenError("Accès non autorisé");
    }

    if (role === "MODERATOR") {
      const assigned = await eventRepo.findModerator(eventId, userId);
      if (!assigned) {
        throw new ForbiddenError("Vous n'êtes pas assigné à cet événement");
      }
    }

    const { page = 1, limit = 20, status } = options;

    const [tickets, total] = await Promise.all([
      ticketRepo.findManyByEvent(eventId, { page, limit, status }),
      ticketRepo.countByEvent(eventId, status),
    ]);

    return {
      data: tickets.map(buildTicketResponse),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Détail d'un ticket ───────────────────────────────────────
  async getTicketById(ticketId, userId, role) {
    const ticket = await ticketRepo.findByIdFull(ticketId);
    if (!ticket) throw new NotFoundError("Ticket");

    if (role === "ORGANIZER" && ticket.event.organizerId !== userId) {
      throw new ForbiddenError("Accès non autorisé");
    }

    if (role === "MODERATOR") {
      const assigned = await eventRepo.findModerator(ticket.eventId, userId);
      if (!assigned) {
        throw new ForbiddenError("Vous n'êtes pas assigné à cet événement");
      }
    }

    return buildTicketResponse(ticket);
  }

  // ─── Annuler un ticket ────────────────────────────────────────
  async cancelTicket(ticketId, organizerId) {
    const ticket = await ticketRepo.findByIdFull(ticketId);
    if (!ticket) throw new NotFoundError("Ticket");

    await assertOrganizerOwnsEvent(ticket.eventId, organizerId);

    if (ticket.status === "USED") {
      throw new BadRequestError(
        "Un ticket déjà utilisé ne peut pas être annulé"
      );
    }
    if (ticket.status === "CANCELLED") {
      throw new BadRequestError("Ce ticket est déjà annulé");
    }

    // Supprimer le QR de Cloudinary si présent
    if (ticket.qrPublicId) {
      const uploader = new MediaUploader();
      await uploader.deleteByPublicId(ticket.qrPublicId).catch(() => {});
    }

    const cancelled = await ticketRepo.cancelTicket(ticketId);
    return buildTicketResponse(cancelled);
  }

  // ─── Tickets pour sync mobile (offline-first) ─────────────────
  async getTicketsForSync(eventId, moderatorId) {
    const assigned = await eventRepo.findModerator(eventId, moderatorId);
    if (!assigned) {
      throw new ForbiddenError("Vous n'êtes pas assigné à cet événement");
    }

    return ticketRepo.findManyActiveByEvent(eventId);
  }

  // ─── Validation online d'un ticket ───────────────────────────
  async validateTicket(qrPayload, moderatorId, deviceId) {
    const decoded = verifyTicketPayload(qrPayload);
    if (!decoded) {
      return { result: "INVALID", message: "QR code invalide ou expiré" };
    }

    const ticket = await ticketRepo.findByIdFull(decoded.ticketId);
    if (!ticket) {
      return { result: "INVALID", message: "Ticket introuvable" };
    }

    const assigned = await eventRepo.findModerator(ticket.eventId, moderatorId);
    if (!assigned) {
      throw new ForbiddenError("Vous n'êtes pas assigné à cet événement");
    }

    if (ticket.status === "CANCELLED") {
      return { result: "INVALID", message: "Ticket annulé" };
    }

    if (ticket.status === "USED") {
      return {
        result: "ALREADY_USED",
        message: "Ticket déjà utilisé",
        usedAt: ticket.usedAt,
        participant: ticket.participant,
      };
    }

    // Marquer comme utilisé + créer ScanLog en une transaction
    await ticketRepo.prisma.$transaction([
      ticketRepo.prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "USED", usedAt: new Date() },
      }),
      ticketRepo.prisma.scanLog.create({
        data: {
          ticketId: ticket.id,
          eventId: ticket.eventId,
          moderatorId,
          deviceId,
          result: "VALID",
          scannedAt: new Date(),
          syncedAt: new Date(),
        },
      }),
    ]);

    logger.logEvent("ticket_validated_online", {
      ticketId: ticket.id,
      eventId: ticket.eventId,
      moderatorId,
    });

    return {
      result: "VALID",
      message: "Entrée validée",
      participant: ticket.participant,
      event: ticket.event,
    };
  }
}