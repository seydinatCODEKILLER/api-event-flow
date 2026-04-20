import { EventRepository } from "./event.repository.js";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../../shared/errors/AppError.js";
import MediaUploader from "../../shared/utils/uploader.js";
import { hashPassword } from "../../shared/utils/hasher.js";


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
  imageUrl: event.imageUrl ?? null,
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

// ─── Service ──────────────────────────────────────────────────

export class EventService {
  // ─── Créer un événement ───────────────────────────────────────
  async createEvent(organizerId, data, file = null) {
    const { title, location, startDate, endDate, capacity } = data;

    if (endDate && new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestError(
        "La date de fin doit être après la date de début",
      );
    }

    const uploader = new MediaUploader();
    let imageUrl = null;
    let imagePublicId = null;

    // 1. Upload l'image si présente
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
      // 2. Créer l'événement avec l'image
      const event = await eventRepo.create({
        title,
        location,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        capacity,
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
  async updateEvent(eventId, organizerId, data, file = null) {
    const event = await assertOwner(eventId, organizerId);

    if (!event) throw new NotFoundError("Événement");

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

    const uploader = new MediaUploader();
    let newImageUrl = null;
    let newImagePublicId = null;

    // 1. Upload la nouvelle image si fournie
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
      // 2. Mettre à jour l'événement
      const updated = await eventRepo.updateEvent(eventId, {
        ...(data.title && { title: data.title }),
        ...(data.location && { location: data.location }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && {
          endDate: endDate ? new Date(endDate) : null,
        }),
        ...(data.capacity && { capacity: data.capacity }),
        ...(data.status && { status: data.status }),
        // Écraser l'image seulement si une nouvelle a été uploadée
        ...(newImageUrl && { imageUrl: newImageUrl }),
        ...(newImagePublicId && { imagePublicId: newImagePublicId }),
      });

      // 3. Supprimer l'ancienne image de Cloudinary si remplacement réussi
      if (newImagePublicId && event.imagePublicId) {
        await uploader.deleteByPublicId(event.imagePublicId).catch(() => {});
      }

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

    if (event.imagePublicId) {
      const uploader = new MediaUploader();
      await uploader.deleteByPublicId(event.imagePublicId).catch(() => {});
    }

    await eventRepo.deleteEvent(eventId);
  }

  // ─── Assigner un modérateur ───────────────────────────────────
  async addModerator(eventId, organizerId, moderatorData, file = null) {
    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");
    if (event.organizerId !== organizerId) {
      throw new ForbiddenError(
        "Vous n'êtes pas l'organisateur de cet événement",
      );
    }

    const { nom, prenom, email, password } = moderatorData;

    // 1. Vérifier si l'email n'est pas déjà utilisé
    const existingUser = await eventRepo.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (existingUser.role === "MODERATOR") {
        const existingAssignment = await eventRepo.findModerator(
          eventId,
          existingUser.id,
        );
        if (existingAssignment) {
          throw new ConflictError(
            "Ce modérateur est déjà assigné à cet événement",
          );
        }
        const assignment = await eventRepo.addModerator(
          eventId,
          existingUser.id,
        );
        return {
          ...assignment.user,
          assignedAt: assignment.assignedAt,
          message: "Modérateur existant assigné avec succès",
        };
      }
      throw new ConflictError(
        "Un compte avec cet email existe déjà avec un rôle différent",
      );
    }

    // 2. Hasher le mot de passe temporaire
    const hashedPassword = await hashPassword(password);

    // 3. Upload l'avatar si fourni
    const uploader = new MediaUploader();
    let avatarUrl = null;
    let avatarPublicId = null;

    if (file) {
      const result = await uploader.upload(
        file,
        "eventflow/avatars",
        `moderator_${Date.now()}`,
      );
      avatarUrl = result.url;
      avatarPublicId = result.public_id;
    }

    // 4. Transaction : Création du compte + Assignation
    try {
      const newModerator = await eventRepo.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            nom,
            prenom,
            email,
            password: hashedPassword,
            role: "MODERATOR",
            avatarUrl,
            avatarPublicId,
          },
        });

        const assignment = await tx.eventModerator.create({
          data: { eventId, userId: user.id },
          include: {
            user: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        });

        return assignment;
      });

      return {
        ...newModerator.user,
        assignedAt: newModerator.assignedAt,
        message:
          "Modérateur créé et assigné avec succès. Partagez ses identifiants de connexion.",
      };
    } catch (error) {
      if (avatarPublicId) {
        await uploader.deleteByPublicId(avatarPublicId).catch(() => {});
      }
      throw error;
    }
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

  async publishEvent(eventId, organizerId) {
    const event = await assertOwner(eventId, organizerId);

    // Règle 1 : Un événement clôturé ne peut pas être publié
    if (event.status === "CLOSED") {
      throw new BadRequestError(
        "Un événement clôturé ne peut plus être publié",
      );
    }

    // Règle 2 : On ne publie pas deux fois (évite les appels inutiles)
    if (event.status === "PUBLISHED") {
      throw new BadRequestError("Cet événement est déjà publié");
    }

    // Transition autorisée : DRAFT -> PUBLISHED (ou ONGOING -> PUBLISHED si on veut permettre la pause)
    const updated = await eventRepo.updateEvent(eventId, {
      status: "PUBLISHED",
    });
    return buildEventResponse(updated);
  }

  // ✅ NOUVEAU : Clôturer un événement ──────────────────────
  async closeEvent(eventId, organizerId) {
    const event = await assertOwner(eventId, organizerId);

    // Règle 1 : On ne clôt pas un événement déjà clôturé
    if (event.status === "CLOSED") {
      throw new BadRequestError("Cet événement est déjà clôturé");
    }

    // Règle 2 : On ne clôt pas un brouillon (il doit être publié au moins une fois)
    if (event.status === "DRAFT") {
      throw new BadRequestError(
        "Impossible de clôturer un brouillon. Publiez l'événement d'abord.",
      );
    }

    // Transition autorisée : PUBLISHED ou ONGOING -> CLOSED
    const updated = await eventRepo.updateEvent(eventId, { status: "CLOSED" });
    return buildEventResponse(updated);
  }
}
