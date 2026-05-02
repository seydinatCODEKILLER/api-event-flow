import { NotificationService } from "./notification.service.js";

const notifService = new NotificationService();

export class NotificationController {
  async getNotifications(req, res, next) {
    try {
      const { page, limit } = req.validated.query;
      const result = await notifService.getNotifications(req.user.id, {
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req, res, next) {
    try {
      await notifService.markAsRead(req.validated.params.id, req.user.id);

      res.status(200).json({
        success: true,
        message: "Notification marquée comme lue",
      });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      await notifService.markAllAsRead(req.user.id);

      res.status(200).json({
        success: true,
        message: "Toutes les notifications ont été marquées comme lues",
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteNotification(req, res, next) {
    try {
      await notifService.deleteNotification(
        req.validated.params.id,
        req.user.id,
      );

      res.status(200).json({
        success: true,
        message: "Notification supprimée avec succès",
      });
    } catch (error) {
      next(error);
    }
  }
}
