import { EventRepository } from "./event.repository.js";
import { NotificationService } from "../notifications/notification.service.js";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../../shared/errors/AppError.js";
import MediaUploader from "../../shared/utils/uploader.js";
import { emitToEvent } from "../../config/socket.js";

const eventRepo = new EventRepository();
const notifService = new NotificationService();

// ─── Helpers ──────────────────────────────────────────────────

const buildEventResponse = (event) => ({
  id: event.id,
  title: event.title,
  description: event.description ?? null,
  location: event.location,
  city: event.city ?? null,
  latitude: event.latitude ?? null,
  longitude: event.longitude ?? null,
  category: event.category,
  startDate: event.startDate,
  endDate: event.endDate ?? null,
  capacity: event.capacity,
  status: event.status,
  imageUrl: event.imageUrl ?? null,
  isFree: event.isFree,
  price: event.isFree ? null : (event.price ?? null),
  currency: event.currency,
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

const assertOwner = async (eventId, organizerId) => {
  const event = await eventRepo.findById(eventId);
  if (!event) throw new NotFoundError("Événement");
  if (event.organizerId !== organizerId) {
    throw new ForbiddenError("Vous n'êtes pas l'organisateur de cet événement");
  }
  return event;
};

// ─── Helper : notifier tous les inscrits d'un event ───────────
const notifyAllAttendees = async (eventId, { type, title, body }) => {
  const userIds = await eventRepo.findAttendeeIds(eventId);
  await Promise.allSettled(
    userIds.map((userId) =>
      notifService.notify({ userId, type, title, body, metadata: { eventId } }),
    ),
  );
};

// ─── Service ──────────────────────────────────────────────────

export class EventService {
  // ─── Créer un événement ───────────────────────────────────────
  async createEvent(organizerId, data, file = null) {
    const {
      title,
      description,
      location,
      city,
      latitude,
      longitude,
      category,
      startDate,
      endDate,
      capacity,
      isFree,
      price,
      currency,
      status,
    } = data;

    if (endDate && new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestError(
        "La date de fin doit être après la date de début",
      );
    }

    const uploader = new MediaUploader();
    let imageUrl = null;
    let imagePublicId = null;

    if (file) {
      const result = await uploader.upload(
        file,
        "eventflow/events",
        `event_${Date.now()}`,
      );
      imageUrl = result.url;
      imagePublicId = result.public_id;
    }

    try {
      const event = await eventRepo.create({
        title,
        description: description ?? null,
        location,
        city: city ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        category,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        capacity,
        isFree: isFree ?? true,
        price: isFree ? null : (price ?? null),
        currency: currency ?? "XOF",
        status: status ?? "DRAFT",
        organizerId,
        imageUrl,
        imagePublicId,
      });

      return buildEventResponse(event);
    } catch (error) {
      if (imagePublicId) {
        await uploader.deleteByPublicId(imagePublicId).catch(() => {});
      }
      throw error;
    }
  }

  // ─── Lister mes événements créés ──────────────────────────────
  async getEvents(organizerId, options = {}) {
    const { page = 1, limit = 10, status } = options;

    const [events, total] = await Promise.all([
      eventRepo.findManyByOrganizer(organizerId, { page, limit, status }),
      eventRepo.countByOrganizer(organizerId, status),
    ]);

    return {
      data: events.map(buildEventResponse),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Détail d'un événement ────────────────────────────────────
  async getEventById(eventId) {
    const event = await eventRepo.findByIdFull(eventId);
    if (!event) throw new NotFoundError("Événement");
    return buildEventResponse(event);
  }

  // ─── Modifier un événement ────────────────────────────────────
  async updateEvent(eventId, organizerId, data, file = null) {
    const event = await assertOwner(eventId, organizerId);

    if (event.status === "CLOSED") {
      throw new BadRequestError(
        "Un événement clôturé ne peut plus être modifié",
      );
    }

    const { startDate, endDate } = data;
    const resolvedStart = startDate ? new Date(startDate) : event.startDate;
    const resolvedEnd =
      endDate !== undefined
        ? endDate
          ? new Date(endDate)
          : null
        : event.endDate;

    if (resolvedEnd && resolvedEnd <= resolvedStart) {
      throw new BadRequestError(
        "La date de fin doit être après la date de début",
      );
    }

    const uploader = new MediaUploader();
    let newImageUrl = null;
    let newImagePublicId = null;

    if (file) {
      const result = await uploader.upload(
        file,
        "eventflow/events",
        `event_${eventId}_${Date.now()}`,
      );
      newImageUrl = result.url;
      newImagePublicId = result.public_id;
    }

    try {
      const updateData = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.location !== undefined) updateData.location = data.location;
      if (data.city !== undefined) updateData.city = data.city;
      if (data.latitude !== undefined) updateData.latitude = data.latitude;
      if (data.longitude !== undefined) updateData.longitude = data.longitude;
      if (data.category !== undefined) updateData.category = data.category;
      if (startDate !== undefined) updateData.startDate = new Date(startDate);
      if (endDate !== undefined)
        updateData.endDate = endDate ? new Date(endDate) : null;
      if (data.capacity !== undefined) updateData.capacity = data.capacity;
      if (data.isFree !== undefined) {
        updateData.isFree = data.isFree;
        updateData.price = data.isFree ? null : (data.price ?? event.price);
      }
      if (data.currency !== undefined) updateData.currency = data.currency;
      if (newImageUrl) updateData.imageUrl = newImageUrl;
      if (newImagePublicId) updateData.imagePublicId = newImagePublicId;

      const updated = await eventRepo.updateEvent(eventId, updateData);

      if (newImagePublicId && event.imagePublicId) {
        await uploader.deleteByPublicId(event.imagePublicId).catch(() => {});
      }

      // ── Notifier tous les inscrits — fire and forget ──────────
      notifyAllAttendees(eventId, {
        type: "EVENT_UPDATED",
        title: "Événement modifié",
        body: `"${event.title}" a été mis à jour`,
      }).catch(() => {});

      emitToEvent(eventId, "event:updated", { eventId, status: "UPDATED" });

      return buildEventResponse(updated);
    } catch (error) {
      if (newImagePublicId) {
        await uploader.deleteByPublicId(newImagePublicId).catch(() => {});
      }
      throw error;
    }
  }

  // ─── Supprimer un événement ───────────────────────────────────
  async deleteEvent(eventId, organizerId) {
    const event = await assertOwner(eventId, organizerId);

    if (event.status === "ONGOING") {
      throw new BadRequestError(
        "Un événement en cours ne peut pas être supprimé",
      );
    }

    // ── Notifier tous les inscrits avant suppression ───────────
    await notifyAllAttendees(eventId, {
      type: "EVENT_CANCELLED",
      title: "Événement annulé",
      body: `"${event.title}" a été annulé`,
    }).catch(() => {});

    if (event.imagePublicId) {
      const uploader = new MediaUploader();
      await uploader.deleteByPublicId(event.imagePublicId).catch(() => {});
    }

    await eventRepo.deleteEvent(eventId);
  }

  // ─── Assigner un modérateur ───────────────────────────────────
  async addModerator(eventId, organizerId, data) {
    const event = await assertOwner(eventId, organizerId);
    const { email } = data;

    const user = await eventRepo.findUserByEmail(email);
    if (!user) throw new NotFoundError("Aucun compte trouvé avec cet email");
    if (user.status === "PENDING") {
      throw new BadRequestError("Ce compte n'a pas encore vérifié son email");
    }
    if (user.id === organizerId) {
      throw new BadRequestError(
        "Vous ne pouvez pas vous assigner comme modérateur",
      );
    }

    const existingAssignment = await eventRepo.findModerator(eventId, user.id);
    if (existingAssignment) {
      throw new ConflictError("Ce modérateur est déjà assigné à cet événement");
    }

    const assignment = await eventRepo.addModerator(eventId, user.id);

    // ── Notifier le modérateur ────────────────────────────────
    notifService
      .notify({
        userId: user.id,
        type: "MODERATOR_ASSIGNED",
        title: "Vous êtes modérateur",
        body: `Vous avez été assigné comme modérateur pour "${event.title}"`,
        metadata: { eventId },
      })
      .catch(() => {});

    return {
      ...assignment.user,
      assignedAt: assignment.assignedAt,
    };
  }

  // ─── Retirer un modérateur ────────────────────────────────────
  async removeModerator(eventId, organizerId, moderatorId) {
    await assertOwner(eventId, organizerId);

    const existing = await eventRepo.findModerator(eventId, moderatorId);
    if (!existing) throw new NotFoundError("Assignation");

    await eventRepo.removeModerator(eventId, moderatorId);
  }

  // ─── Lister les modérateurs ───────────────────────────────────
  async getModerators(eventId) {
    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");
    return eventRepo.findModerators(eventId);
  }

  // ─── Publier un événement ─────────────────────────────────────
  async publishEvent(eventId, organizerId) {
    const event = await assertOwner(eventId, organizerId);

    if (event.status === "CLOSED") {
      throw new BadRequestError(
        "Un événement clôturé ne peut plus être publié",
      );
    }
    if (event.status === "PUBLISHED") {
      throw new BadRequestError("Cet événement est déjà publié");
    }

    const updated = await eventRepo.updateEvent(eventId, {
      status: "PUBLISHED",
    });
    return buildEventResponse(updated);
  }

  // ─── Clôturer un événement ────────────────────────────────────
  async closeEvent(eventId, organizerId) {
    const event = await assertOwner(eventId, organizerId);

    if (event.status === "CLOSED") {
      throw new BadRequestError("Cet événement est déjà clôturé");
    }
    if (event.status === "DRAFT") {
      throw new BadRequestError(
        "Impossible de clôturer un brouillon. Publiez l'événement d'abord.",
      );
    }

    const updated = await eventRepo.updateEvent(eventId, { status: "CLOSED" });

    // ── Notifier tous les inscrits ────────────────────────────
    notifyAllAttendees(eventId, {
      type: "EVENT_CANCELLED",
      title: "Événement clôturé",
      body: `"${event.title}" a été clôturé`,
    }).catch(() => {});

    emitToEvent(eventId, "event:closed", { eventId, status: "CLOSED" });

    return buildEventResponse(updated);
  }

  // ─── Stats d'un événement ─────────────────────────────────────
  async getEventStats(eventId) {
    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");

    const [ticketStats, scanStats] = await Promise.all([
      eventRepo.getTicketStats(eventId),
      eventRepo.getScanStats(eventId),
    ]);

    const tickets = { ACTIVE: 0, USED: 0, CANCELLED: 0 };
    ticketStats.forEach((t) => {
      tickets[t.status] = t._count.status;
    });

    const scans = { VALID: 0, ALREADY_USED: 0, INVALID: 0, CONFLICT: 0 };
    const byMode = { ONLINE: 0, OFFLINE: 0 };
    scanStats.forEach((s) => {
      scans[s.result] = (scans[s.result] || 0) + s._count.result;
      byMode[s.mode] = (byMode[s.mode] || 0) + s._count.result;
    });

    const totalTickets = tickets.ACTIVE + tickets.USED + tickets.CANCELLED;
    const attendanceRate =
      totalTickets > 0
        ? Math.round((tickets.USED / totalTickets) * 100 * 10) / 10
        : 0;

    return {
      capacity: event.capacity,
      remainingSeats: Math.max(
        0,
        event.capacity - tickets.ACTIVE - tickets.USED,
      ),
      tickets: { total: totalTickets, ...tickets },
      scans: {
        total: Object.values(scans).reduce((a, b) => a + b, 0),
        ...scans,
        byMode,
      },
      attendanceRate,
    };
  }

  // ─── Tickets d'un événement ───────────────────────────────────
  async getEventTickets(eventId, options = {}) {
    const { page = 1, limit = 20, status } = options;

    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");

    const [tickets, total] = await Promise.all([
      eventRepo.findTickets(eventId, { page, limit, status }),
      eventRepo.countTickets(eventId, status),
    ]);

    return {
      data: tickets.map((t) => ({
        id: t.id,
        status: t.status,
        qrUrl: t.qrUrl ?? null,
        usedAt: t.usedAt ?? null,
        addedByOrganizer: t.addedByOrganizer,
        createdAt: t.createdAt,
        user: t.user,
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Participants d'un événement ──────────────────────────────
  // Dans event.service.js -> getEventParticipants
  async getEventParticipants(eventId, options = {}) {
    const { page = 1, limit = 20, search } = options;

    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");

    // Modification ici : utiliser findMany avec distinct sur userId
    const [participants, total] = await Promise.all([
      eventRepo.findParticipants(eventId, { page, limit, search }),
      eventRepo.countDistinctParticipants(eventId, search),
    ]);

    // Tu n'as plus besoin du Set, Prisma renvoie déjà les users uniques !
    return {
      data: participants,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
