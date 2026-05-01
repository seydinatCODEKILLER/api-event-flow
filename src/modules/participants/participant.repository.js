import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class ParticipantRepository extends BaseRepository {
  constructor() {
    super(prisma.participant);
  }

  findByEmail(email) {
    return prisma.participant.findUnique({
      where: { email },
    });
  }

  findByPhone(phone) {
    return prisma.participant.findFirst({
      where: { phone },
    });
  }

  findByIdFull(id) {
    return prisma.participant.findUnique({
      where: { id },
      include: {
        tickets: {
          include: {
            event: {
              select: {
                id: true,
                title: true,
                location: true,
                startDate: true,
                status: true,
                imageUrl: true, // ← ajouter
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  findManyByEvent(eventId, options = {}) {
    const { page, limit, search } = options;

    const where = {
      tickets: { some: { eventId } },
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    return prisma.participant.findMany({
      where,
      include: {
        tickets: {
          where: { eventId },
          select: {
            id: true,
            status: true,
            qrPayload: true,
            usedAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: page && limit ? (page - 1) * limit : undefined,
      take: limit || undefined,
    });
  }

  countByEvent(eventId, search) {
    return prisma.participant.count({
      where: {
        tickets: { some: { eventId } },
        ...(search && {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
    });
  }

  updateParticipant(id, data) {
    return prisma.participant.update({
      where: { id },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  deleteParticipant(id) {
    return prisma.participant.delete({ where: { id } });
  }

  // ─── Bulk insert pour import CSV ──────────────────────────────
  createMany(data) {
    return prisma.participant.createMany({
      data,
      skipDuplicates: true,
    });
  }

  findExistingByEmailsOrPhones(emails, phones) {
    return prisma.participant.findMany({
      where: {
        OR: [
          ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
          ...(phones.length > 0 ? [{ phone: { in: phones } }] : []),
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true, // ← ajouter
        activationToken: true, // ← ajouter
      },
    });
  }

  // participant.repository.js — ajoute cette méthode
  findManyByEmailsOrPhones(emails, phones) {
    return prisma.participant.findMany({
      where: {
        OR: [
          ...(emails.length ? [{ email: { in: emails } }] : []),
          ...(phones.length ? [{ phone: { in: phones } }] : []),
        ],
      },
      select: { id: true },
    });
  }

  // ─── Vérification existence ticket ────────────────────────────
  hasTicketForEvent(eventId, participantId) {
    return prisma.ticket.findFirst({
      where: { eventId, participantId },
      select: { id: true },
    });
  }

  findExistingByEmailsOrPhonesAndEvent(emails, phones, eventId) {
    return prisma.participant.findMany({
      where: {
        tickets: { some: { eventId } },
        OR: [
          ...(emails.length ? [{ email: { in: emails } }] : []),
          ...(phones.length ? [{ phone: { in: phones } }] : []),
        ],
      },
      select: { id: true, email: true, phone: true },
    });
  }

  findTicketsByParticipant(participantId, options = {}) {
    const { page = 1, limit = 10 } = options;

    return prisma.ticket.findMany({
      where: { participantId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            location: true,
            startDate: true,
            status: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  countTicketsByParticipant(participantId) {
    return prisma.ticket.count({
      where: { participantId },
    });
  }
}
