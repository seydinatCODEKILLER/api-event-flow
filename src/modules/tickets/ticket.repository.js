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
      where: { eventId, ...(status && { status }) },
      select: {
        id: true,
        qrPayload: true,
        qrUrl: true,
        status: true,
        usedAt: true,
        addedByOrganizer: true,
        createdAt: true,
        participant: {
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

  // ─── Transactions ────────────────────────────────────────────
  validateTicketOnline(ticketId, eventId, moderatorId, deviceId) {
    return prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticketId },
        data: { status: "USED", usedAt: new Date() },
      }),
      prisma.scanLog.create({
        data: {
          ticketId,
          eventId,
          moderatorId,
          deviceId,
          result: "VALID",
          scannedAt: new Date(),
          syncedAt: new Date(), // Scan online = sync immédiat
        },
      }),
    ]);
  }

    async processScanOnline(ticketId, eventId, moderatorId, deviceId, result) {
    return prisma.$transaction(async (tx) => {
      // On ne met à jour le ticket que si la validation est un succès
      if (result === "VALID") {
        await tx.ticket.update({
          where: { id: ticketId },
          data: { status: "USED", usedAt: new Date() },
        });
      }

      // On crée TOUJOURS le ScanLog pour la traçabilité
      await tx.scanLog.create({
        data: {
          ticketId,
          eventId,
          moderatorId,
          deviceId,
          result,
          mode: "ONLINE", // <-- REMARQUE 1 & 2 : Forcé à ONLINE
          scannedAt: new Date(),
          syncedAt: new Date(),
        },
      });
    });
  }
}
