import { prisma } from "../../config/database.js";

export class PublicRepository {

  findPublishedEvents(limit = 20) {
    return prisma.event.findMany({
      where: {
        status: { in: ["PUBLISHED", "ONGOING"] },
      },
      select: {
        id: true,
        title: true,
        location: true,
        startDate: true,
        imageUrl: true,
        endDate: true,
        capacity: true,
        status: true,
        _count: {
          select: { tickets: true },
        },
      },
      orderBy: { startDate: "asc" },
      take: limit,
    });
  }

  findPublishedEventById(id) {
    return prisma.event.findFirst({
      where: {
        id,
        status: { in: ["PUBLISHED", "ONGOING"] },
      },
      select: {
        id: true,
        title: true,
        location: true,
        startDate: true,
        imageUrl: true,
        endDate: true,
        capacity: true,
        status: true,
        _count: {
          select: { tickets: true },
        },
      },
    });
  }

  countTicketsByEvent(eventId) {
    return prisma.ticket.count({
      where: {
        eventId,
        status: { in: ["ACTIVE", "USED"] },
      },
    });
  }

  findParticipantByEmailAndEvent(email, eventId) {
    return prisma.participant.findFirst({
      where: {
        email,
        tickets: { some: { eventId } },
      },
    });
  }

  findParticipantByPhoneAndEvent(phone, eventId) {
    return prisma.participant.findFirst({
      where: {
        phone,
        tickets: { some: { eventId } },
      },
    });
  }

  findParticipantByEmail(email) {
    return prisma.participant.findFirst({ where: { email } });
  }

  findParticipantByPhone(phone) {
    return prisma.participant.findFirst({ where: { phone } });
  }

  createParticipant(data) {
    return prisma.participant.create({ data });
  }
}