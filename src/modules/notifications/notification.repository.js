import { prisma } from "../../config/database.js";
import { BaseRepository } from "../../shared/base/base.repository.js";

export class NotificationRepository extends BaseRepository {
  constructor() {
    super(prisma.notification);
  }

  async findManyByUser(userId, options = {}) {
    const { page = 1, limit = 20 } = options;
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }, // Les plus récentes en premier
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async countByUser(userId) {
    return prisma.notification.count({
      where: { userId },
    });
  }

  // Utilisation de updateMany pour s'assurer qu'on ne modifie que les notifs de cet utilisateur
  async markAllAsRead(userId) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async markAsRead(id, userId) {
    return prisma.notification.updateMany({
      where: { id, userId }, // Double condition anti-IDOR
      data: { isRead: true },
    });
  }

  // Utilisation de deleteMany pour la même raison de sécurité
  async deleteOne(id, userId) {
    return prisma.notification.deleteMany({
      where: { id, userId },
    });
  }

  async findUserPushToken(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });
  }
}
