import { prisma } from "../../config/database.js";

export class PaymentRepository {
  // Récupérer un paiement avec ses liaisons
  findByIdAndUser(id, userId) {
    return prisma.payment.findFirst({
      where: { id, userId },
      include: {
        event: { select: { id: true, title: true } },
        ticket: { select: { id: true, status: true } },
      },
    });
  }

  // Trouver un paiement par sa référence (pour le Webhook)
  findByReference(reference) {
    return prisma.payment.findUnique({
      where: { reference },
      include: {
        event: {
          select: { id: true, title: true, price: true, currency: true },
        },
      },
    });
  }

  findExistingTicket(userId, eventId) {
    return prisma.ticket.findUnique({
      where: {
        eventId_userId: { eventId, userId },
      },
      select: { id: true, status: true },
    });
  }

  // Trouver un paiement en attente pour un user/event
  findPendingByUserAndEvent(userId, eventId) {
    return prisma.payment.findFirst({
      where: { userId, eventId, status: "PENDING" },
    });
  }

  // Créer ou mettre à jour la méthode du paiement
  async upsertPendingPayment(
    userId,
    eventId,
    method,
    reference,
    amount,
    currency,
  ) {
    const existing = await this.findPendingByUserAndEvent(userId, eventId);

    if (existing) {
      return prisma.payment.update({
        where: { id: existing.id },
        data: { method, reference, amount, currency },
      });
    }

    return prisma.payment.create({
      data: {
        userId,
        eventId,
        method,
        reference,
        status: "PENDING",
        amount,
        currency,
      },
    });
  }

  // Confirmer le paiement et lier le ticket
  confirmPayment(id, ticketId) {
    return prisma.payment.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        ticketId,
      },
    });
  }

  // Marquer le paiement comme échoué
  failPayment(id, reason) {
    return prisma.payment.update({
      where: { id },
      data: { status: "FAILED", failureReason: reason },
    });
  }

  // Mettre à jour le montant (si créé à 0)
  updateAmount(id, amount, currency) {
    return prisma.payment.update({
      where: { id },
      data: { amount, currency },
    });
  }
}
