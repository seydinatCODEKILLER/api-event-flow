import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class ParticipantRepository extends BaseRepository {
  constructor() {
    super(prisma.participant);
  }

  findByEmail(email) {
    return prisma.participant.findFirst({
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
    // CORRECTION : On utilise prisma.participant directement et plus "this"
    // pour éviter que le BaseRepository ne double le "where"
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
      },
    });
  }
}
