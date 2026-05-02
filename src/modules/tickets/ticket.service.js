import { TicketRepository } from "./ticket.repository.js";
import { EventRepository } from "../events/event.repository.js";
import { NotificationService } from "../notifications/notification.service.js";
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
import { emitToEvent } from "../../config/socket.js";

const ticketRepo = new TicketRepository();
const eventRepo = new EventRepository();
const notifService = new NotificationService();

// ─── Helpers ──────────────────────────────────────────────────

const assertOrganizerOwnsEvent = async (eventId, organizerId) => {
  const event = await eventRepo.findById(eventId);
  if (!event) throw new NotFoundError("Événement");
  if (event.organizerId !== organizerId) {
    throw new ForbiddenError("Vous n'êtes pas l'organisateur de cet événement");
  }
  return event;
};

const buildTicketResponse = (ticket) => ({
  id: ticket.id,
  status: ticket.status,
  qrPayload: ticket.qrPayload,
  qrUrl: ticket.qrUrl ?? null,
  usedAt: ticket.usedAt ?? null,
  addedByOrganizer: ticket.addedByOrganizer ?? false,
  userId: ticket.userId,
  user: ticket.user ?? undefined,
  event: ticket.event ?? undefined,
  emailLogs: ticket.emailLogs ?? undefined,
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
});

// ─── Service ──────────────────────────────────────────────────

export class TicketService {
  // ─── Créer un ticket ──────────────────────────────────────────
  async createTicket(eventId, userId, data = {}) {
    const existing = await ticketRepo.findByEventAndUser(eventId, userId);
    if (existing) {
      throw new ConflictError(
        "Cet utilisateur a déjà un ticket pour cet événement",
      );
    }

    // Récupérer l'event pour le titre dans la notif
    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");

    const ticket = await ticketRepo.create({
      eventId,
      userId,
      qrPayload: "",
      status: "ACTIVE",
      addedByOrganizer: data.addedByOrganizer || false,
    });

    const { payload, buffer } = await generateTicketQr(
      ticket.id,
      eventId,
      userId,
    );

    const uploader = new MediaUploader();
    let qrUrl = null;
    let qrPublicId = null;

    try {
      const uploaded = await uploader.uploadBuffer(
        buffer,
        "eventflow/qrcodes",
        `qr_${ticket.id}`,
      );
      qrUrl = uploaded.url;
      qrPublicId = uploaded.public_id;
    } catch (err) {
      logger.warn(
        { err, ticketId: ticket.id },
        "QR upload Cloudinary échoué — fallback base64",
      );
    }

    const updated = await ticketRepo.updateTicket(ticket.id, {
      qrPayload: payload,
      ...(qrUrl && { qrUrl }),
      ...(qrPublicId && { qrPublicId }),
    });

    // ── Notifier l'user — inscription confirmée ────────────────
    notifService
      .notify({
        userId,
        type: "INSCRIPTION_CONFIRMED",
        title: "Inscription confirmée",
        body: `Votre inscription pour "${event.title}" est confirmée`,
        metadata: { eventId, ticketId: ticket.id },
      })
      .catch(() => {});

    return { ticket: updated, qrUrl, buffer };
  }

  // ─── Envoyer le ticket par email (organisateur) ───────────────
  async sendTicketEmail(ticketId, organizerId, isResend = false) {
    const ticket = await ticketRepo.findByIdFull(ticketId);
    if (!ticket) throw new NotFoundError("Ticket");

    await assertOrganizerOwnsEvent(ticket.eventId, organizerId);

    if (ticket.status === "CANCELLED")
      throw new BadRequestError("Impossible d'envoyer un ticket annulé");
    if (!ticket.user.email)
      throw new BadRequestError("Cet utilisateur n'a pas d'adresse email");

    const emailLog = await ticketRepo.createEmailLog({
      ticketId,
      to: ticket.user.email,
      type: isResend ? "TICKET_RESEND" : "TICKET",
      status: "PENDING",
    });

    const qrImageUrl = ticket.qrUrl || null;
    const qrBase64 = qrImageUrl
      ? null
      : await generateQrCodeBase64(ticket.qrPayload);

    const html = ticketEmailTemplate({
      participantName: ticket.user.fullName,
      eventTitle: ticket.event.title,
      eventLocation: ticket.event.location,
      eventDate: ticket.event.startDate,
      qrImageUrl,
      qrBase64,
      ticketId: ticket.id,
    });

    try {
      await sendEmail({
        to: ticket.user.email,
        toName: ticket.user.fullName,
        subject: `Votre ticket — ${ticket.event.title}`,
        html,
      });

      await ticketRepo.updateEmailLog(emailLog.id, {
        status: "SENT",
        sentAt: new Date(),
      });
      logger.info(
        { ticketId, to: ticket.user.email, type: emailLog.type },
        "ticket_email_sent",
      );
      return { sent: true, to: ticket.user.email };
    } catch (err) {
      await ticketRepo.updateEmailLog(emailLog.id, {
        status: "FAILED",
        error: err.message,
      });
      throw new BadRequestError(
        "Échec de l'envoi de l'email — réessayez plus tard",
      );
    }
  }

  // ─── Envoyer le ticket par email (public) ────────────────────
  async sendTicketEmailPublic(ticketId, activationToken = null) {
    const ticket = await ticketRepo.findByIdFull(ticketId);
    if (!ticket) throw new NotFoundError("Ticket");
    if (!ticket.user.email) return;

    const emailLog = await ticketRepo.createEmailLog({
      ticketId,
      to: ticket.user.email,
      type: "TICKET",
      status: "PENDING",
    });

    const qrImageUrl = ticket.qrUrl || null;
    const qrBase64 = qrImageUrl
      ? null
      : await generateQrCodeBase64(ticket.qrPayload);

    const html = ticketEmailTemplate({
      participantName: ticket.user.fullName,
      eventTitle: ticket.event.title,
      eventLocation: ticket.event.location,
      eventDate: ticket.event.startDate,
      qrImageUrl,
      qrBase64,
      ticketId: ticket.id,
      activationToken,
      participantEmail: ticket.user.email,
    });

    try {
      await sendEmail({
        to: ticket.user.email,
        toName: ticket.user.fullName,
        subject: `Votre ticket — ${ticket.event.title}`,
        html,
      });
      await ticketRepo.updateEmailLog(emailLog.id, {
        status: "SENT",
        sentAt: new Date(),
      });
    } catch (err) {
      await ticketRepo.updateEmailLog(emailLog.id, {
        status: "FAILED",
        error: err.message,
      });
      throw err;
    }
  }

  // ─── Lister les tickets d'un event ───────────────────────────
  async getTickets(eventId, userId, options = {}) {
    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");

    const isOrganizer = event.organizerId === userId;
    const isModerator = await eventRepo.findModerator(eventId, userId);

    if (!isOrganizer && !isModerator) {
      throw new ForbiddenError("Accès non autorisé");
    }

    const { page = 1, limit = 20, status } = options;
    const [tickets, total] = await Promise.all([
      ticketRepo.findManyByEvent(eventId, { page, limit, status }),
      ticketRepo.countByEvent(eventId, status),
    ]);

    return {
      data: tickets.map(buildTicketResponse),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Détail d'un ticket ───────────────────────────────────────
  async getTicketById(ticketId, userId) {
    const ticket = await ticketRepo.findByIdFull(ticketId);
    if (!ticket) throw new NotFoundError("Ticket");

    const isOrganizer = ticket.event.organizerId === userId;
    const isModerator = await eventRepo.findModerator(ticket.eventId, userId);

    if (!isOrganizer && !isModerator) {
      throw new ForbiddenError("Accès non autorisé");
    }

    return buildTicketResponse(ticket);
  }

  // ─── Annuler un ticket ────────────────────────────────────────
  async cancelTicket(ticketId, organizerId) {
    const ticket = await ticketRepo.findByIdFull(ticketId);
    if (!ticket) throw new NotFoundError("Ticket");

    await assertOrganizerOwnsEvent(ticket.eventId, organizerId);

    if (ticket.status === "USED")
      throw new BadRequestError(
        "Un ticket déjà utilisé ne peut pas être annulé",
      );
    if (ticket.status === "CANCELLED")
      throw new BadRequestError("Ce ticket est déjà annulé");

    if (ticket.qrPublicId) {
      const uploader = new MediaUploader();
      await uploader.deleteByPublicId(ticket.qrPublicId).catch(() => {});
    }

    const cancelled = await ticketRepo.cancelTicket(ticketId);
    return buildTicketResponse(cancelled);
  }

  // ─── Tickets pour sync offline ────────────────────────────────
  async getTicketsForSync(eventId, moderatorId) {
    const assigned = await eventRepo.findModerator(eventId, moderatorId);
    if (!assigned)
      throw new ForbiddenError("Vous n'êtes pas assigné à cet événement");
    return ticketRepo.findManyActiveByEvent(eventId);
  }

  // ─── Valider un ticket (scan online) ─────────────────────────
  async validateTicket(qrPayload, moderatorId, deviceId) {
    const decoded = verifyTicketPayload(qrPayload);
    if (!decoded)
      return { result: "INVALID", message: "QR code invalide ou expiré" };

    const ticket = await ticketRepo.findByIdFull(decoded.ticketId);
    if (!ticket) return { result: "INVALID", message: "Ticket introuvable" };

    const assigned = await eventRepo.findModerator(ticket.eventId, moderatorId);
    if (!assigned)
      throw new ForbiddenError("Vous n'êtes pas assigné à cet événement");

    if (ticket.status === "CANCELLED") {
      await ticketRepo.processScanOnline(
        ticket.id,
        ticket.eventId,
        moderatorId,
        deviceId,
        "INVALID",
      );
      return { result: "INVALID", message: "Ticket annulé" };
    }

    if (ticket.status === "USED") {
      await ticketRepo.processScanOnline(
        ticket.id,
        ticket.eventId,
        moderatorId,
        deviceId,
        "ALREADY_USED",
      );
      return {
        result: "ALREADY_USED",
        message: "Ticket déjà utilisé",
        usedAt: ticket.usedAt,
        user: ticket.user,
      };
    }

    await ticketRepo.processScanOnline(
      ticket.id,
      ticket.eventId,
      moderatorId,
      deviceId,
      "VALID",
    );

    // ── Notifier l'user — ticket scanné ───────────────────────
    notifService
      .notify({
        userId: ticket.userId,
        type: "TICKET_SCANNED",
        title: "Entrée validée",
        body: `Votre entrée pour "${ticket.event.title}" a été validée`,
        metadata: { eventId: ticket.eventId, ticketId: ticket.id },
      })
      .catch(() => {});

    // ── Emit Socket — stats live pour l'organisateur ──────────
    emitToEvent(ticket.eventId, "scan:result", {
      result: "VALID",
      ticketId: ticket.id,
      scannedBy: moderatorId,
      user: { id: ticket.user.id, fullName: ticket.user.fullName },
    });

    logger.info(
      {
        ticketId: ticket.id,
        eventId: ticket.eventId,
        moderatorId,
      },
      "ticket_validated_online",
    );

    return {
      result: "VALID",
      message: "Entrée validée",
      user: ticket.user,
      event: ticket.event,
    };
  }
}
