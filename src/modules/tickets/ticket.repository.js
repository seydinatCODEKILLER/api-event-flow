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
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
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

  // <- MODIF : Renommage de la méthode et du where (Prisma @@unique)
  findByEventAndUser(eventId, userId) {
    return prisma.ticket.findUnique({
      where: {
        eventId_userId: { eventId, userId },
      },
    });
  }

  findManyByEvent(eventId, options = {}) {
    const { page, limit, status } = options;
    return prisma.ticket.findMany({
      where: { eventId, ...(status && { status }) },
      select: {
        id: true,
        qrPayload: true,
        qrUrl: true,
        status: true,
        usedAt: true,
        addedByOrganizer: true,
        createdAt: true,
        user: {
          // <- MODIF : participant -> user
          select: { id: true, fullName: true, email: true, phone: true },
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
        userId: true, // <- MODIF : participantId -> userId
        user: {
          // <- MODIF : participant -> user
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

  // ─── Transactions ────────────────────────────────────────────
  async processScanOnline(ticketId, eventId, moderatorId, deviceId, result) {
    return prisma.$transaction(async (tx) => {
      if (result === "VALID") {
        await tx.ticket.update({
          where: { id: ticketId },
          data: { status: "USED", usedAt: new Date() },
        });
      }

      await tx.scanLog.create({
        data: {
          ticketId,
          eventId,
          moderatorId,
          deviceId,
          result,
          mode: "ONLINE",
          scannedAt: new Date(),
          syncedAt: new Date(),
        },
      });
    });
  }
}
