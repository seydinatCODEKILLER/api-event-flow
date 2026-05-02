import { prisma } from "../../config/database.js";

export class UserRepository {
  // Récupérer le profil sans le mot de passe ni les tokens sensibles
  findById(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        avatarPublicId: true,
        status: true,
        pushToken: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(userId, data) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteUser(userId) {
    return prisma.user.delete({
      where: { id: userId },
    });
  }

  // Mettre à jour le push token Expo
  async updatePushToken(userId, pushToken) {
    return prisma.user.update({
      where: { id: userId },
      data: { pushToken },
    });
  }

  // Historique des tickets de l'utilisateur
  async findUserTickets(userId, options = {}) {
    const { page = 1, limit = 10 } = options;
    return prisma.ticket.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        usedAt: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            title: true,
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

  async countUserTickets(userId) {
    return prisma.ticket.count({ where: { userId } });
  }

  // Événements auxquels l'utilisateur participe (via ses tickets)
  // Pas besoin de distinct car @@unique([eventId, userId]) existe dans Prisma
  async findUserEvents(userId, options = {}) {
    const { page = 1, limit = 10 } = options;
    return prisma.ticket.findMany({
      where: { userId, event: { status: { not: "DRAFT" } } }, // On cache les brouillons
      select: {
        createdAt: true,
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

  async countUserEvents(userId) {
    return prisma.ticket.count({
      where: { userId, event: { status: { not: "DRAFT" } } },
    });
  }

  // user.repository.js — à ajouter
  countActiveEvents(userId) {
    return prisma.event.count({
      where: {
        organizerId: userId,
        status: { in: ["PUBLISHED", "ONGOING"] },
      },
    });
  }

  // Historique des paiements de l'utilisateur
  async findUserPayments(userId, options = {}) {
    const { page = 1, limit = 10 } = options;
    return prisma.payment.findMany({
      where: { userId },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        method: true,
        reference: true,
        completedAt: true,
        createdAt: true,
        event: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async countUserPayments(userId) {
    return prisma.payment.count({ where: { userId } });
  }
}
