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

const buildPublicEventResponse = (event) => {
  const ticketsCount = event._count?.tickets ?? 0;
  return {
    id: event.id,
    title: event.title,
    location: event.location,
    city: event.city,
    startDate: event.startDate,
    endDate: event.endDate ?? null,
    capacity: event.capacity,
    imageUrl: event.imageUrl ?? null,
    isFree: event.isFree,
    price: event.isFree ? null : event.price,
    remainingSpots: Math.max(0, event.capacity - ticketsCount),
    status: event.status,
    isFull: ticketsCount >= event.capacity,
  };
};

export class PublicService {
  async getPublicEvents() {
    const events = await publicRepo.findPublishedEvents(20);
    return events.map(buildPublicEventResponse);
  }

  async getPublicEventById(eventId) {
    const event = await publicRepo.findPublishedEventById(eventId);
    if (!event) throw new NotFoundError("Événement");
    return buildPublicEventResponse(event);
  }

  async registerToEvent(eventId, data) {
    const { fullName, email, phone } = data;

    // 1. Vérifier l'événement
    const event = await publicRepo.findPublishedEventById(eventId);
    if (!event)
      throw new NotFoundError("Événement introuvable ou non disponible");

    if (!event.isFree) {
      throw new BadRequestError(
        "Cet événement est payant. Veuillez vous inscrire via l'application mobile.",
      );
    }

    // 3. Vérification rapide de la capacité
    const ticketsCount = await publicRepo.countValidTicketsByEvent(eventId);
    if (ticketsCount >= event.capacity) {
      throw new BadRequestError("Désolé, cet événement est complet");
    }

    try {
      // 4. Vérifier les doublons
      if (email) {
        const existingByEmail = await publicRepo.findUserByEmailAndEvent(
          email,
          eventId,
        );
        if (existingByEmail)
          throw new ConflictError(
            "Un billet a déjà été envoyé à cet email pour cet événement",
          );
      }
      if (phone) {
        const existingByPhone = await publicRepo.findUserByPhoneAndEvent(
          phone,
          eventId,
        );
        if (existingByPhone)
          throw new ConflictError(
            "Un billet a déjà été envoyé à ce numéro pour cet événement",
          );
      }

      // 5. Créer ou récupérer l'utilisateur
      let user = null;
      if (email) user = await publicRepo.findUserByEmail(email);
      if (!user && phone) user = await publicRepo.findUserByPhone(phone);

      if (!user) {
        user = await publicRepo.createUser({ fullName, email, phone });
      } else if (
        user.status === "PENDING" &&
        user.verificationExpiresAt < new Date()
      ) {
        user = await publicRepo.renewVerificationToken(user.id);
      }

      // 6. Créer le ticket + QR + Cloudinary
      const { ticket } = await ticketService.createTicket(eventId, user.id, {
        addedByOrganizer: false,
      });

      // 7. Envoyer le ticket par email (de façon asynchrone)
      let emailSent = false;
      if (user.email) {
        try {
          // Token d'activation uniquement si PENDING
          const activationToken =
            user.status === "PENDING" ? user.verificationToken : null;
          await ticketService.sendTicketEmailPublic(
            ticket.id,
            activationToken
          );
          emailSent = true;
        } catch (err) {
          logger.warn(
            { err, ticketId: ticket.id },
            "Échec envoi email public — ticket créé",
          );
        }
      }

      return {
        userId: user.id,
        ticketId: ticket.id,
        fullName: user.fullName,
        email: user.email ?? null,
        emailSent,
        event: {
          id: event.id,
          title: event.title,
          location: event.location,
          startDate: event.startDate,
        },
      };
    } catch (error) {
      if (error.code === "P2002") {
        throw new ConflictError(
          "L'événement vient d'être complet ou vous êtes déjà inscrit",
        );
      }
      throw error;
    }
  }
}
