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
import { TicketService } from "../tickets/ticket.service.js";

const participantRepo = new ParticipantRepository();
const eventRepo = new EventRepository();
const ticketService = new TicketService();

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

    const { ticket, qrBase64 } = await ticketService.createTicket(
      eventId,
      participant.id,
    );

    return {
      ...buildParticipantResponse(participant),
      ticket,
      qrBase64,
    };
  }

  // ─── Import CSV ───────────────────────────────────────────────
  async importFromCsv(eventId, organizerId, fileBuffer) {
    const event = await assertOrganizerOwnsEvent(eventId, organizerId);

    if (event.status === "CLOSED") {
      throw new BadRequestError(
        "Impossible d'importer des participants dans un événement clôturé",
      );
    }

    const { valid, invalid, total } = parseParticipantsCsv(fileBuffer);

    const currentCount = await participantRepo.countByEvent(eventId);
    const remaining = event.capacity - currentCount;

    if (valid.length > remaining) {
      throw new BadRequestError(
        `Capacité insuffisante : ${remaining} place(s) disponible(s), ${valid.length} participants valides dans le CSV`,
      );
    }

    const emails = valid.map((p) => p.email).filter(Boolean);
    const phones = valid.map((p) => p.phone).filter(Boolean);

    // Participants qui existent déjà en base (tous événements confondus)
    const existingParticipants =
      await participantRepo.findExistingByEmailsOrPhones(emails, phones);

    // Participants qui ont DÉJÀ un ticket pour CET événement précis
    const alreadyInEvent =
      await participantRepo.findExistingByEmailsOrPhonesAndEvent(
        emails,
        phones,
        eventId,
      );

    const alreadyInEventEmails = new Set(
      alreadyInEvent.map((p) => p.email).filter(Boolean),
    );
    const alreadyInEventPhones = new Set(
      alreadyInEvent.map((p) => p.phone).filter(Boolean),
    );

    // Participants connus en base mais pas encore dans cet événement → juste créer le ticket
    const existingEmails = new Set(
      existingParticipants.map((p) => p.email).filter(Boolean),
    );
    const existingPhones = new Set(
      existingParticipants.map((p) => p.phone).filter(Boolean),
    );

    const skipped = [];
    const toCreate = [];
    const toAddTicketOnly = []; // ← connus en base, nouveaux dans cet event

    for (const p of valid) {
      const inEvent =
        (p.email && alreadyInEventEmails.has(p.email)) ||
        (p.phone && alreadyInEventPhones.has(p.phone));

      if (inEvent) {
        skipped.push({
          fullName: p.fullName,
          reason: "déjà inscrit à cet événement",
        });
        continue;
      }

      const existsGlobally =
        (p.email && existingEmails.has(p.email)) ||
        (p.phone && existingPhones.has(p.phone));

      if (existsGlobally) {
        // Existe en base mais pas dans cet event → on lui crée juste un ticket
        const existing = existingParticipants.find(
          (e) =>
            (p.email && e.email === p.email) ||
            (p.phone && e.phone === p.phone),
        );
        if (existing) toAddTicketOnly.push(existing);
      } else {
        toCreate.push(p);
      }
    }

    let createdCount = 0;

    // Créer les nouveaux participants + leurs tickets
    if (toCreate.length > 0) {
      await participantRepo.createMany(toCreate);
      createdCount += toCreate.length;

      const emailsToFind = toCreate.map((p) => p.email).filter(Boolean);
      const phonesToFind = toCreate.map((p) => p.phone).filter(Boolean);

      const newParticipants =
        await participantRepo.findExistingByEmailsOrPhones(
          emailsToFind,
          phonesToFind,
        );

      await Promise.allSettled(
        newParticipants.map((p) => ticketService.createTicket(eventId, p.id)),
      );
    }

    // Créer uniquement les tickets pour les participants déjà connus
    if (toAddTicketOnly.length > 0) {
      createdCount += toAddTicketOnly.length;
      await Promise.allSettled(
        toAddTicketOnly.map((p) => ticketService.createTicket(eventId, p.id)),
      );
    }

    return {
      total,
      imported: createdCount,
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
