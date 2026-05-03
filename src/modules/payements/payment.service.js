import { PaymentRepository } from "./payment.repository.js";
import { EventRepository } from "../events/event.repository.js";
import { TicketService } from "../tickets/ticket.service.js";
import { NotificationService } from "../notifications/notification.service.js";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "../../shared/errors/AppError.js";

const paymentRepo = new PaymentRepository();
const eventRepo = new EventRepository();
const ticketService = new TicketService();
const notifService = new NotificationService();

export class PaymentService {
  // ─── 1. Initier le paiement ──────────────────────────────────
  async initiate(eventId, userId, method) {
    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");

    if (event.isFree) {
      throw new BadRequestError("Cet événement est gratuit.");
    }

    if (event.status === "CLOSED") {
      throw new BadRequestError("Cet événement est clôturé.");
    }

    // Vérifier si l'user a déjà un ticket valide
    const existingTicket = await paymentRepo.findExistingTicket(
      userId,
      eventId,
    );
    if (existingTicket) {
      throw new ConflictError("Vous êtes déjà inscrit à cet événement");
    }

    const reference = `TXN-${Date.now()}-${userId.slice(0, 8)}`;
    const payment = await paymentRepo.upsertPendingPayment(
      userId,
      eventId,
      method,
      reference,
      event.price,
      event.currency,
    );

    return {
      paymentId: payment.id,
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
    };
  }

  // ─── 2. Confirmer le paiement (Webhook) ─────────────────────
  async confirm(reference, userId, status, failureReason = null) {
    const payment = await paymentRepo.findByReference(reference);
    if (!payment) throw new NotFoundError("Paiement");

    if (payment.userId !== userId) {
      throw new ForbiddenError("Accès non autorisé à ce paiement");
    }

    // IDEMPOTENCE : Si déjà traité, on ne fait rien
    if (payment.status === "COMPLETED" || payment.status === "REFUNDED") {
      return { success: true, message: "Paiement déjà traité", data: payment };
    }

    if (status === "FAILED") {
      await paymentRepo.failPayment(
        payment.id,
        failureReason || "Paiement échoué par l'opérateur",
      );
      return { success: false, message: "Paiement marqué comme échoué" };
    }

    if (status === "COMPLETED") {
      if (payment.ticketId) {
        return {
          success: true,
          message: "Paiement déjà traité",
          data: payment,
        };
      }
      // 1. Créer le ticket (gère le QR, Cloudinary, Notif, etc.)
      const { ticket } = await ticketService.createTicket(
        payment.eventId,
        payment.userId,
        { addedByOrganizer: false },
      );

      // 2. Mettre à jour le paiement avec l'ID du ticket créé
      const confirmedPayment = await paymentRepo.confirmPayment(
        payment.id,
        ticket.id,
      );

      // 3. Notification de confirmation
      notifService
        .notify({
          userId: payment.userId,
          type: "INSCRIPTION_CONFIRMED",
          title: "Paiement validé",
          body: `Votre paiement pour "${payment.event.title}" a réussi. Votre ticket est prêt.`,
          metadata: {
            eventId: payment.eventId,
            ticketId: ticket.id,
            paymentId: payment.id,
          },
        })
        .catch(() => {});

      return {
        success: true,
        message: "Paiement confirmé et ticket généré",
        data: confirmedPayment,
      };
    }
  }

  // ─── 3. Obtenir les détails d'un paiement ───────────────────
  async getPaymentDetails(paymentId, userId) {
    const payment = await paymentRepo.findByIdAndUser(paymentId, userId);
    if (!payment) throw new NotFoundError("Paiement");

    return payment;
  }
}
