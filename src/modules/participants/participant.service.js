import { ParticipantRepository } from "./participant.repository.js";
import { EventRepository } from "../events/event.repository.js";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from "../../shared/errors/AppError.js";
import {
  parseParticipantsCsv,
  deduplicateParticipants,
} from "../../shared/utils/csvParser.js";

const participantRepo = new ParticipantRepository();
const eventRepo = new EventRepository();

// ─── Helpers ──────────────────────────────────────────────────

const buildParticipantResponse = (p) => ({
  id: p.id,
  fullName: p.fullName,
  email: p.email ?? null,
  phone: p.phone ?? null,
  ticket: p.tickets?.[0] ?? undefined,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

const assertOrganizerOwnsEvent = async (eventId, organizerId) => {
  const event = await eventRepo.findById(eventId);
  if (!event) throw new NotFoundError("Événement");
  if (event.organizerId !== organizerId) {
    throw new ForbiddenError("Vous n'êtes pas l'organisateur de cet événement");
  }
  return event;
};

// ─── Service ──────────────────────────────────────────────────

export class ParticipantService {
  // ─── Ajouter un participant manuellement ──────────────────────
  async addParticipant(eventId, organizerId, data) {
    const event = await assertOrganizerOwnsEvent(eventId, organizerId);

    if (event.status === "CLOSED") {
      throw new BadRequestError(
        "Impossible d'ajouter un participant à un événement clôturé",
      );
    }

    const { fullName, email, phone } = data;

    // Vérifier la capacité
    const currentCount = await participantRepo.countByEvent(eventId);
    if (currentCount >= event.capacity) {
      throw new BadRequestError(
        `La capacité maximale de l'événement est atteinte (${event.capacity} participants)`,
      );
    }

    // Chercher un participant existant ou en créer un nouveau
    let participant = null;

    if (email) {
      participant = await participantRepo.findByEmail(email);
    }
    if (!participant && phone) {
      participant = await participantRepo.findByPhone(phone);
    }

    if (!participant) {
      participant = await participantRepo.create({ fullName, email, phone });
    }

    // Vérifier qu'il n'a pas déjà un ticket pour cet événement
    const existingTicket = participant.tickets?.find(
      (t) => t.eventId === eventId,
    );
    if (existingTicket) {
      throw new ConflictError(
        "Ce participant a déjà un ticket pour cet événement",
      );
    }

    return buildParticipantResponse(participant);
  }

  // ─── Import CSV ───────────────────────────────────────────────
  async importFromCsv(eventId, organizerId, fileBuffer) {
    const event = await assertOrganizerOwnsEvent(eventId, organizerId);

    if (event.status === "CLOSED") {
      throw new BadRequestError(
        "Impossible d'importer des participants dans un événement clôturé",
      );
    }

    // ─── Parse + validation CSV ───────────────────────────────
    const { valid, invalid, total } = parseParticipantsCsv(fileBuffer);

    // Vérifier la capacité restante
    const currentCount = await participantRepo.countByEvent(eventId);
    const remaining = event.capacity - currentCount;

    if (valid.length > remaining) {
      throw new BadRequestError(
        `Capacité insuffisante : ${remaining} place(s) disponible(s), ${valid.length} participants valides dans le CSV`,
      );
    }

    // ─── Dédoublonnage ────────────────────────────────────────
    const emails = valid.map((p) => p.email).filter(Boolean);
    const phones = valid.map((p) => p.phone).filter(Boolean);

    const existingList = await participantRepo.findExistingByEmailsOrPhones(
      emails,
      phones,
    );

    const { toCreate, skipped } = deduplicateParticipants(valid, existingList);

    // ─── Insertion ────────────────────────────────────────────
    const created =
      toCreate.length > 0
        ? await participantRepo.createMany(toCreate)
        : { count: 0 };

    return {
      total,
      imported: created.count,
      skipped: skipped.length,
      skippedDetails: skipped,
      invalidLines: invalid.length,
      invalidDetails: invalid,
    };
  }

  // ─── Lister les participants d'un événement ───────────────────
  async getParticipants(eventId, userId, role, options = {}) {
    const event = await eventRepo.findById(eventId);
    if (!event) throw new NotFoundError("Événement");

    // Organisateur propriétaire ou modérateur assigné
    if (role === "ORGANIZER" && event.organizerId !== userId) {
      throw new ForbiddenError("Accès non autorisé");
    }
    if (role === "MODERATOR") {
      const assigned = await eventRepo.findModerator(eventId, userId);
      if (!assigned)
        throw new ForbiddenError("Vous n'êtes pas assigné à cet événement");
    }

    const { page = 1, limit = 20, search } = options;

    const [participants, total] = await Promise.all([
      participantRepo.findManyByEvent(eventId, { page, limit, search }),
      participantRepo.countByEvent(eventId, search),
    ]);

    return {
      data: participants.map(buildParticipantResponse),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Détail d'un participant ──────────────────────────────────
  async getParticipantById(participantId, eventId, organizerId) {
    await assertOrganizerOwnsEvent(eventId, organizerId);

    const participant = await participantRepo.findByIdFull(participantId);
    if (!participant) throw new NotFoundError("Participant");

    return participant;
  }

  // ─── Modifier un participant ──────────────────────────────────
  async updateParticipant(participantId, eventId, organizerId, data) {
    await assertOrganizerOwnsEvent(eventId, organizerId);

    const participant = await participantRepo.findById(participantId);
    if (!participant) throw new NotFoundError("Participant");

    // Vérifier unicité email
    if (data.email && data.email !== participant.email) {
      const existing = await participantRepo.findByEmail(data.email);
      if (existing && existing.id !== participantId) {
        throw new ConflictError("Un participant avec cet email existe déjà");
      }
    }

    // Vérifier unicité phone
    if (data.phone && data.phone !== participant.phone) {
      const existing = await participantRepo.findByPhone(data.phone);
      if (existing && existing.id !== participantId) {
        throw new ConflictError("Un participant avec ce téléphone existe déjà");
      }
    }

    return participantRepo.updateParticipant(participantId, {
      ...(data.fullName && { fullName: data.fullName }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
    });
  }

  // ─── Supprimer un participant ─────────────────────────────────
  async deleteParticipant(participantId, eventId, organizerId) {
    await assertOrganizerOwnsEvent(eventId, organizerId);

    const participant = await participantRepo.findById(participantId);
    if (!participant) throw new NotFoundError("Participant");

    await participantRepo.deleteParticipant(participantId);
  }
}
