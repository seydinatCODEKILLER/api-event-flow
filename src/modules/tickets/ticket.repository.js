import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class TicketRepository extends BaseRepository {
  constructor() {
    super(prisma.ticket);
  }

  findByIdFull(id) {
    return prisma.ticket.findUnique({
      where: { id },
      include: {
        participant: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            location: true,
            startDate: true,
            status: true,
            organizerId: true,
          },
        },
        emailLogs: {
          select: {
            id: true,
            status: true,
            type: true,
            to: true,
            error: true,
            sentAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  findByEventAndParticipant(eventId, participantId) {
    return prisma.ticket.findUnique({
      where: {
        eventId_participantId: { eventId, participantId },
      },
    });
  }

  findManyByEvent(eventId, options = {}) {
    const { page, limit, status } = options;

    return prisma.ticket.findMany({
      where: {
        eventId,
        ...(status && { status }),
      },
      include: {
        participant: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        emailLogs: {
          select: { status: true, type: true, sentAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip: page && limit ? (page - 1) * limit : undefined,
      take: limit || undefined,
    });
  }

  countByEvent(eventId, status) {
    return prisma.ticket.count({
      where: {
        eventId,
        ...(status && { status }),
      },
    });
  }

  updateTicket(id, data) {
    return prisma.ticket.update({
      where: { id },
      data,
    });
  }

  cancelTicket(id) {
    return prisma.ticket.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  }

  findManyActiveByEvent(eventId) {
    return prisma.ticket.findMany({
      where: { eventId, status: "ACTIVE" },
      select: {
        id: true,
        qrPayload: true,
        qrUrl: true,
        status: true,
        participantId: true,
        participant: {
          select: { fullName: true },
        },
      },
    });
  }

  // ─── Email logs ───────────────────────────────────────────────

  createEmailLog(data) {
    return prisma.emailLog.create({ data });
  }

  updateEmailLog(id, data) {
    return prisma.emailLog.update({ where: { id }, data });
  }

  findLastEmailLog(ticketId) {
    return prisma.emailLog.findFirst({
      where: { ticketId },
      orderBy: { createdAt: "desc" },
    });
  }
}
