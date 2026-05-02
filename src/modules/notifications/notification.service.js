import { NotificationRepository } from "./notification.repository.js";
import { NotFoundError } from "../../shared/errors/AppError.js";
import { emitToUser } from "../../config/socket.js";
import { sendPushNotification } from "../../shared/utils/expo.push.js";

const notifRepo = new NotificationRepository();

export class NotificationService {
  // ─── Créer et envoyer une notification ────────────────────────
  // Méthode centrale appelée par events, tickets, sync, payments
  async notify({ userId, type, title, body, metadata = null }) {
    // 1. Sauvegarder en DB
    const notification = await notifRepo.create({
      userId,
      type,
      title,
      body,
      metadata,
      isRead: false,
    });

    // 2. Temps réel in-app via Socket.io (si l'user est connecté)
    emitToUser(userId, "notification:new", {
      id: notification.id,
      type,
      title,
      body,
      metadata,
      isRead: false,
      createdAt: notification.createdAt,
    });

    // 3. Push Expo si pushToken disponible (si l'user est hors app)
    const user = await notifRepo.findUserPushToken(userId);
    if (user?.pushToken) {
      sendPushNotification({
        token: user.pushToken,
        title,
        body,
        data: { type, ...(metadata ?? {}) },
      }).catch(() => {}); // fire and forget — ne bloque pas
    }

    return notification;
  }

  // ─── Lister les notifications ─────────────────────────────────
  async getNotifications(userId, options = {}) {
    const { page = 1, limit = 20, unreadOnly = false } = options;

    const [data, counts] = await Promise.all([
      notifRepo.findManyByUser(userId, { page, limit, unreadOnly }),
      notifRepo.countByUser(userId),
    ]);

    return {
      data,
      pagination: {
        total: counts.total,
        unread: counts.unread,
        page,
        limit,
        totalPages: Math.ceil(counts.total / limit),
      },
    };
  }

  // ─── Marquer une notif comme lue ──────────────────────────────
  async markAsRead(notificationId, userId) {
    const result = await notifRepo.markAsRead(notificationId, userId);

    if (result.count === 0) {
      throw new NotFoundError("Notification");
    }

    return { success: true };
  }

  // ─── Marquer toutes les notifs comme lues ─────────────────────
  async markAllAsRead(userId) {
    await notifRepo.markAllAsRead(userId);
    return { success: true };
  }

  // ─── Supprimer une notification ───────────────────────────────
  async deleteNotification(notificationId, userId) {
    const result = await notifRepo.deleteOne(notificationId, userId);

    if (result.count === 0) {
      throw new NotFoundError("Notification");
    }

    return { success: true };
  }
}
