import crypto from "crypto";
import { prisma } from "../../config/database.js";
import { hashPassword } from "../../shared/utils/hasher.js";

export class PublicRepository {
  // ─── Events ─────────────────────────────────────────────────
  findPublishedEvents(limit = 20) {
    return prisma.event.findMany({
      where: { status: { in: ["PUBLISHED", "ONGOING"] } },
      select: {
        id: true,
        title: true,
        location: true,
        city: true,
        startDate: true,
        endDate: true,
        capacity: true,
        status: true,
        imageUrl: true,
        isFree: true,
        price: true,
        currency: true,
        _count: { select: { tickets: true } },
      },
      orderBy: { startDate: "asc" },
      take: limit,
    });
  }

  findPublishedEventById(id) {
    return prisma.event.findFirst({
      where: { id, status: { in: ["PUBLISHED", "ONGOING"] } },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        city: true,
        startDate: true,
        endDate: true,
        capacity: true,
        status: true,
        imageUrl: true,
        isFree: true,
        price: true,
        currency: true,
        _count: { select: { tickets: true } },
      },
    });
  }

  countValidTicketsByEvent(eventId) {
    return prisma.ticket.count({
      where: { eventId, status: { in: ["ACTIVE", "USED"] } },
    });
  }

  // ─── Users (Anciennement Participant) ───────────────────────
  findUserByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  }

  findUserByPhone(phone) {
    return prisma.user.findFirst({ where: { phone } });
  }

  findUserByEmailAndEvent(email, eventId) {
    return prisma.user.findFirst({
      where: { email, tickets: { some: { eventId } } },
    });
  }

  findUserByPhoneAndEvent(phone, eventId) {
    return prisma.user.findFirst({
      where: { phone, tickets: { some: { eventId } } },
    });
  }

  // Crée un compte "Public" (sans mot de passe choisi par l'user)
  async createUser(data) {
    const hashedPassword = await hashPassword(
      crypto.randomBytes(20).toString("hex"),
    );

    return prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email || null,
        phone: data.phone || null,
        password: hashedPassword,
        status: "PENDING",
        verificationToken: crypto.randomUUID(),
        verificationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  renewVerificationToken(userId) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        verificationToken: crypto.randomUUID(),
        verificationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }
}
