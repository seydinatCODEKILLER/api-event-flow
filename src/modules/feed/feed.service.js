import { FeedRepository } from "./feed.repository.js";
import { TicketService } from "../tickets/ticket.service.js";
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "../../shared/errors/AppError.js";

const feedRepo = new FeedRepository();
const ticketService = new TicketService();

// Helper pour formater la réponse du feed
const formatFeedEvent = (event) => ({
  id: event.id,
  title: event.title,
  description: event.description,
  location: event.location,
  city: event.city,
  startDate: event.startDate,
  endDate: event.endDate,
  category: event.category,
  imageUrl: event.imageUrl,
  isFree: event.isFree,
  price: event.isFree ? null : event.price,
  currency: event.currency,
  attendeesCount: event._count?.tickets ?? 0, // ← ajouter
  remainingSeats: event.capacity // ← ajouter
    ? Math.max(0, event.capacity - (event._count?.tickets ?? 0))
    : null,
    status: event.status,
});

export class FeedService {
  // ─── Flux principal ──────────────────────────────────────────
  async getFeed(options = {}) {
    const { cursor, limit, ...filters } = options;
    const { data, nextCursor } = await feedRepo.findPublishedEvents({
      cursor,
      limit,
      ...filters,
    });

    return {
      data: data.map(formatFeedEvent),
      nextCursor, // null si plus rien
    };
  }

  // ─── Flux géolocalisé ────────────────────────────────────────
  async getNearby(latitude, longitude, radius, limit) {
    const data = await feedRepo.findNearbyEvents(
      latitude,
      longitude,
      radius,
      limit,
    );

    return {
      data: data.map((e) => ({
        ...formatFeedEvent(e),
        distance: parseFloat(e.distance),
      })),
    };
  }

  // ─── Détail Event + Statut Inscription ───────────────────────
  async getEventDetail(eventId, userId) {
    const event = await feedRepo.findEventDetail(eventId);
    if (!event) throw new NotFoundError("Événement");

    const registration = userId
      ? await feedRepo.checkRegistration(eventId, userId)
      : null;
    const remainingSeats = await feedRepo.getRemainingSeats(
      eventId,
      event.capacity,
    );

    return {
      ...formatFeedEvent(event),
      capacity: event.capacity,
      remainingSeats,
      status: event.status,
      organizer: event.organizer,
      attendeesCount: event._count.tickets,
      isRegistered: !!registration,
      registrationStatus: registration?.status || null,
    };
  }

  // ─── Inscription ─────────────────────────────────────────────
  async register(eventId, userId) {
    const event = await feedRepo.findEventDetail(eventId);
    if (!event) throw new NotFoundError("Événement");

    if (event.organizer.id === userId) {
      throw new BadRequestError(
        "Vous ne pouvez pas vous inscrire à votre propre événement",
      );
    }

    // 1. Vérifier que l'event est ouvert
    if (event.status === "DRAFT" || event.status === "CLOSED") {
      throw new BadRequestError("Cet événement n'accepte plus d'inscriptions");
    }

    // 2. Vérifier les places
    const remainingSeats = await feedRepo.getRemainingSeats(
      eventId,
      event.capacity,
    );
    if (remainingSeats <= 0) {
      throw new BadRequestError("Cet événement est complet");
    }

    // 3. Vérifier si déjà inscrit
    const existingRegistration = await feedRepo.checkRegistration(
      eventId,
      userId,
    );
    if (existingRegistration) {
      throw new ConflictError("Vous êtes déjà inscrit à cet événement");
    }

    // 4. Logique d'inscription
    if (event.isFree) {
      // GRATUIT : Créer le ticket directement via le TicketService
      const { ticket } = await ticketService.createTicket(eventId, userId, {
        addedByOrganizer: false,
      });

      return {
        requiresPayment: false,
        message: "Inscription réussie !",
        ticketId: ticket.id,
      };
    } else {
      // PAYANT : Déléguer la création au Repository
      const payment = await feedRepo.createPaymentIntent({
        userId,
        eventId,
        amount: event.price,
        currency: event.currency,
        method: method ?? "WAVE", // fallback si non fourni
        status: "PENDING",
        reference: `TXN-${Date.now()}-${userId.slice(0, 8)}`,
      });

      return {
        requiresPayment: true,
        message: "Paiement requis pour finaliser l'inscription",
        paymentId: payment.id,
        reference: payment.reference,
        amount: payment.amount,
        currency: payment.currency,
      };
    }
  }
}
