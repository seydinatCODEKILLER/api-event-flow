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
            nom: true,
            prenom: true,
            email: true,
            avatarUrl: true,
          },
        },
        moderators: {
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
      orderBy: { startDate: "desc" },
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
          select: { id: true, nom: true, prenom: true, email: true, avatarUrl: true },
        },
        _count: {
          select: { tickets: true },
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
          select: { id: true, nom: true, prenom: true, email: true, avatarUrl: true },
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
          select: { id: true, nom: true, prenom: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  removeModerator(eventId, userId) {
    return prisma.eventModerator.delete({
      where: { eventId_userId: { eventId, userId } },
    });
  }
}
