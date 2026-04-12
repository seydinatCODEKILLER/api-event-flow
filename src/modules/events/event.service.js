import { EventRepository } from "./event.repository.js";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../../shared/errors/AppError.js";

const eventRepo = new EventRepository();

// ─── Helpers ──────────────────────────────────────────────────

const buildEventResponse = (event) => ({
  id: event.id,
  title: event.title,
  location: event.location,
  startDate: event.startDate,
  endDate: event.endDate ?? null,
  capacity: event.capacity,
  status: event.status,
  organizer: event.organizer ?? undefined,
  moderators:
    event.moderators?.map((m) => ({
      ...m.user,
      assignedAt: m.assignedAt,
    })) ?? undefined,
  ticketsCount: event._count?.tickets ?? undefined,
  scansCount: event._count?.scanLogs ?? undefined,
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
});

// ─── Service ──────────────────────────────────────────────────

export class EventService {
  // ─── Créer un événement ───────────────────────────────────────
  async createEvent(organizerId, data) {
    const { title, location, startDate, endDate, capacity } = data;

    if (endDate && new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestError(
        "La date de fin doit être après la date de début",
      );
    }

    const event = await eventRepo.create({
      title,
      location,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      capacity,
      organizerId,
    });

    return buildEventResponse(event);
  }

  // ─── Lister les événements ────────────────────────────────────
  async getEvents(organizerId, options = {}) {
    const { page = 1, limit = 10, status } = options;

    const [events, total] = await Promise.all([
      eventRepo.findManyByOrganizer(organizerId, { page, limit, status }),
      eventRepo.countByOrganizer(organizerId, status),
    ]);

    return {
      data: events.map(buildEventResponse),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Détail d'un événement ────────────────────────────────────
  async getEventById(eventId, userId, role) {
    const event = await eventRepo.findByIdFull(eventId);
    if (!event) throw new NotFoundError("Événement");

    // Vérifier accès : organisateur propriétaire ou modérateur assigné
    if (role === "ORGANIZER" && event.organizerId !== userId) {
      throw new ForbiddenError("Accès non autorisé à cet événement");
    }

    if (role === "MODERATOR") {
      const assigned = event.moderators.some((m) => m.userId === userId);
      if (!assigned)
        throw new ForbiddenError("Vous n'êtes pas assigné à cet événement");
    }

    return buildEventResponse(event);
  }

  // ─── Modifier un événement ────────────────────────────────────
  async updateEvent(eventId, organizerId, data) {
    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");
    if (event.organizerId !== organizerId) {
      throw new ForbiddenError(
        "Vous n'êtes pas l'organisateur de cet événement",
      );
    }

    if (event.status === "CLOSED") {
      throw new BadRequestError(
        "Un événement clôturé ne peut plus être modifié",
      );
    }

    const { startDate, endDate } = data;
    const resolvedStart = startDate ? new Date(startDate) : event.startDate;
    const resolvedEnd = endDate ? new Date(endDate) : event.endDate;

    if (resolvedEnd && resolvedEnd <= resolvedStart) {
      throw new BadRequestError(
        "La date de fin doit être après la date de début",
      );
    }

    const updated = await eventRepo.updateEvent(eventId, {
      ...(data.title && { title: data.title }),
      ...(data.location && { location: data.location }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && {
        endDate: endDate ? new Date(endDate) : null,
      }),
      ...(data.capacity && { capacity: data.capacity }),
      ...(data.status && { status: data.status }),
    });

    return buildEventResponse(updated);
  }

  // ─── Supprimer un événement ───────────────────────────────────
  async deleteEvent(eventId, organizerId) {
    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");
    if (event.organizerId !== organizerId) {
      throw new ForbiddenError(
        "Vous n'êtes pas l'organisateur de cet événement",
      );
    }

    if (event.status === "ONGOING") {
      throw new BadRequestError(
        "Un événement en cours ne peut pas être supprimé",
      );
    }

    await eventRepo.deleteEvent(eventId);
  }

  // ─── Assigner un modérateur ───────────────────────────────────
  async addModerator(eventId, organizerId, moderatorId) {
    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");
    if (event.organizerId !== organizerId) {
      throw new ForbiddenError(
        "Vous n'êtes pas l'organisateur de cet événement",
      );
    }

    // Vérifier que le modérateur existe et a le bon rôle
    const moderator = await eventRepo.prisma.user.findUnique({
      where: { id: moderatorId },
      select: { id: true, role: true, nom: true, prenom: true},
    });

    if (!moderator) throw new NotFoundError("Modérateur");
    if (moderator.role !== "MODERATOR") {
      throw new BadRequestError("Cet utilisateur n'est pas un modérateur");
    }

    // Vérifier qu'il n'est pas déjà assigné
    const existing = await eventRepo.findModerator(eventId, moderatorId);
    if (existing) {
      throw new ConflictError("Ce modérateur est déjà assigné à cet événement");
    }

    const assignment = await eventRepo.addModerator(eventId, moderatorId);

    return {
      ...assignment.user,
      assignedAt: assignment.assignedAt,
    };
  }

  // ─── Retirer un modérateur ────────────────────────────────────
  async removeModerator(eventId, organizerId, moderatorId) {
    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");
    if (event.organizerId !== organizerId) {
      throw new ForbiddenError(
        "Vous n'êtes pas l'organisateur de cet événement",
      );
    }

    const existing = await eventRepo.findModerator(eventId, moderatorId);
    if (!existing) {
      throw new NotFoundError("Assignation");
    }

    await eventRepo.removeModerator(eventId, moderatorId);
  }

  // ─── Lister les modérateurs ───────────────────────────────────
  async getModerators(eventId, userId, role) {
    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");

    if (role === "ORGANIZER" && event.organizerId !== userId) {
      throw new ForbiddenError("Accès non autorisé");
    }

    return eventRepo.findModerators(eventId);
  }
}
