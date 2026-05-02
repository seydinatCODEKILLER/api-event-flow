import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class EventRepository extends BaseRepository {
  constructor() {
    super(prisma.event);
  }

  // ─── Events ───────────────────────────────────────────────────

  findByIdFull(id) {
    return prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
        moderators: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: { tickets: true, scanLogs: true },
        },
      },
    });
  }

  findManyByOrganizer(organizerId, options = {}) {
    const { page, limit, status } = options;

    return prisma.event.findMany({
      where: {
        organizerId,
        ...(status && { status }),
      },
      include: {
        _count: {
          select: { tickets: true, scanLogs: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: page && limit ? (page - 1) * limit : undefined,
      take: limit || undefined,
    });
  }

  countByOrganizer(organizerId, status) {
    return prisma.event.count({
      where: {
        organizerId,
        ...(status && { status }),
      },
    });
  }

  updateEvent(id, data) {
    return prisma.event.update({
      where: { id },
      data,
      include: {
        organizer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: { tickets: true, scanLogs: true },
        },
      },
    });
  }

  deleteEvent(id) {
    return prisma.event.delete({ where: { id } });
  }

  // ─── Moderators ───────────────────────────────────────────────

  findModerator(eventId, userId) {
    return prisma.eventModerator.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
  }

  findModerators(eventId) {
    return prisma.eventModerator.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });
  }

  addModerator(eventId, userId) {
    return prisma.eventModerator.create({
      data: { eventId, userId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  removeModerator(eventId, userId) {
    return prisma.eventModerator.delete({
      where: { eventId_userId: { eventId, userId } },
    });
  }

  // ─── Users ────────────────────────────────────────────────────

  findUserByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        avatarUrl: true,
      },
    });
  }

  // ─── Stats ────────────────────────────────────────────────────

  getTicketStats(eventId) {
    return prisma.ticket.groupBy({
      by: ["status"],
      where: { eventId },
      _count: { status: true },
    });
  }

  countScans(eventId) {
    return prisma.scanLog.count({ where: { eventId } });
  }

  // Ajouter dans la classe EventRepository

  // ─── Tickets d'un événement ───────────────────────────────────

  findTickets(eventId, options = {}) {
    const { page, limit, status } = options;

    return prisma.ticket.findMany({
      where: {
        eventId,
        ...(status && { status }),
      },
      select: {
        id: true,
        status: true,
        qrUrl: true,
        usedAt: true,
        addedByOrganizer: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: page && limit ? (page - 1) * limit : undefined,
      take: limit || undefined,
    });
  }

  countTickets(eventId, status) {
    return prisma.ticket.count({
      where: {
        eventId,
        ...(status && { status }),
      },
    });
  }

  // ─── Participants d'un événement ──────────────────────────────
  // Un participant = un User distinct qui possède au moins un ticket

  findParticipants(eventId, options = {}) {
    const { page, limit, search } = options;

    const where = {
      eventId,
      user: {
        ...(search && {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        }),
      },
    };

    return prisma.ticket.findMany({
      where,
      select: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: page && limit ? (page - 1) * limit : undefined,
      take: limit || undefined,
    });
  }

  countDistinctParticipants(eventId, search) {
    return prisma.ticket
      .findMany({
        where: {
          eventId,
          ...(search && {
            user: {
              OR: [
                { fullName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
              ],
            },
          }),
        },
        distinct: ["userId"],
      })
      .then((r) => r.length);
  }

  getScanStats(eventId) {
    return prisma.scanLog.groupBy({
      by: ["result", "mode"],
      where: { eventId },
      _count: { result: true },
    });
  }

  // event.repository.js — à ajouter
  async findAttendeeIds(eventId) {
    const tickets = await prisma.ticket.findMany({
      where: { eventId, status: { in: ["ACTIVE", "USED"] } },
      select: { userId: true },
    });
    return tickets.map((t) => t.userId);
  }
}
