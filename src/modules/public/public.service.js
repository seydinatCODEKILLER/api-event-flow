import crypto from "crypto";
import { PublicRepository } from "./public.repository.js";
import { TicketService } from "../tickets/ticket.service.js";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "../../shared/errors/AppError.js";
import logger from "../../config/logger.js";

const publicRepo = new PublicRepository();
const ticketService = new TicketService();

// ─── Helpers ──────────────────────────────────────────────────

const buildPublicEventResponse = (event) => {
  const ticketsCount = event._count?.tickets ?? 0;
  return {
    id: event.id,
    title: event.title,
    location: event.location,
    startDate: event.startDate,
    endDate: event.endDate ?? null,
    capacity: event.capacity,
    imageUrl: event.imageUrl ?? null,
    remainingSpots: Math.max(0, event.capacity - ticketsCount),
    status: event.status,
    isFull: ticketsCount >= event.capacity,
  };
};

// ─── Service ──────────────────────────────────────────────────

export class PublicService {
  // ─── Lister les événements publics ───────────────────────────
  async getPublicEvents() {
    const events = await publicRepo.findPublishedEvents(20);
    return events.map(buildPublicEventResponse);
  }

  // ─── Détail d'un événement public ────────────────────────────
  async getPublicEventById(eventId) {
    const event = await publicRepo.findPublishedEventById(eventId);
    if (!event) throw new NotFoundError("Événement");
    return buildPublicEventResponse(event);
  }

  // ─── Inscription self-service ─────────────────────────────────
  async registerToEvent(eventId, data) {
    const { fullName, email, phone } = data;

    // 1. Vérifier que l'événement est PUBLISHED
    const event = await publicRepo.findPublishedEventById(eventId);
    if (!event) {
      throw new NotFoundError(
        "Événement introuvable ou non disponible à l'inscription",
      );
    }

    if (event.status !== "PUBLISHED") {
      throw new BadRequestError(
        "Les inscriptions ne sont pas ouvertes pour cet événement",
      );
    }

    // 2. Vérification rapide de la capacité (optimisation pour rejeter vite)
    const ticketsCount = await publicRepo.countTicketsByEvent(eventId);
    if (ticketsCount >= event.capacity) {
      throw new BadRequestError("Désolé, cet événement est complet");
    }

    // On englobe la création dans un try/catch pour gérer la concurrence (Race Condition)
    try {
      // 3. Vérifier doublon — même email ou téléphone déjà inscrit
      if (email) {
        const existingByEmail = await publicRepo.findParticipantByEmailAndEvent(
          email,
          eventId,
        );
        if (existingByEmail) {
          throw new ConflictError(
            "Vous êtes déjà inscrit à cet événement avec cet email",
          );
        }
      }

      if (phone) {
        const existingByPhone = await publicRepo.findParticipantByPhoneAndEvent(
          phone,
          eventId,
        );
        if (existingByPhone) {
          throw new ConflictError(
            "Vous êtes déjà inscrit à cet événement avec ce numéro de téléphone",
          );
        }
      }

      // 4. Créer ou récupérer le participant
      let participant = null;

      if (email) participant = await publicRepo.findParticipantByEmail(email);
      if (!participant && phone)
        participant = await publicRepo.findParticipantByPhone(phone);

      // Dans registerToEvent — remplacer la création du participant
      if (!participant) {
        const activationToken = crypto.randomUUID();
        participant = await publicRepo.createParticipant({
          fullName,
          email: email || null,
          phone: phone || null,
          status: email ? "ACTIVE" : "PENDING",
          activationToken, // toujours généré — sert pour le lien email
          activationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      }

      // 5. Créer le ticket + générer le QR + upload Cloudinary
      const { ticket } = await ticketService.createTicket(
        eventId,
        participant.id,
      );

      // 6. Envoyer l'email si le participant a un email
      if (participant.email) {
        try {
          await ticketService.sendTicketEmailPublic(
            ticket.id,
            participant.activationToken ?? null,
          );
        } catch (err) {
          logger.warn(
            { err, ticketId: ticket.id },
            "Échec envoi email inscription — ticket créé quand même",
          );
        }
      }

      return {
        participantId: participant.id,
        ticketId: ticket.id,
        fullName: participant.fullName,
        email: participant.email ?? null,
        emailSent: !!participant.email,
        event: {
          id: event.id,
          title: event.title,
          location: event.location,
          startDate: event.startDate,
        },
      };
    } catch (error) {
      // SÉCURITÉ ANTI-OVERBOOKING (Race Condition)
      // Si deux requêtes s'exécutent exactement au même millième,
      // la contrainte Prisma @@unique([eventId, participantId]) déclenchera une erreur P2002.
      if (error.code === "P2002") {
        throw new ConflictError(
          "Une inscription identique est en cours de traitement ou l'événement vient de se completer.",
        );
      }
      // On relance les autres erreurs (NotFound, Conflict doublon, etc.)
      throw error;
    }
  }
}
