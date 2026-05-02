import { UserService } from "./user.service.js";

const userService = new UserService();

export class UserController {
  async getMe(req, res, next) {
    try {
      const data = await userService.getMe(req.user.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const data = await userService.updateProfile(
        req.user.id,
        req.validated.body,
        req.file,
      );
      res
        .status(200)
        .json({ success: true, message: "Profil mis à jour", data });
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req, res, next) {
    try {
      await userService.deleteAccount(req.user.id);
      res
        .status(200)
        .json({ success: true, message: "Compte supprimé avec succès" });
    } catch (error) {
      next(error);
    }
  }

  async updatePushToken(req, res, next) {
    try {
      await userService.updatePushToken(
        req.user.id,
        req.validated.body.pushToken,
      );
      res.status(200).json({ success: true, message: "Push token mis à jour" });
    } catch (error) {
      next(error);
    }
  }

  async getMyTickets(req, res, next) {
    try {
      const { page, limit } = req.validated.query;
      const result = await userService.getMyTickets(req.user.id, {
        page,
        limit,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getMyEvents(req, res, next) {
    try {
      const { page, limit } = req.validated.query;
      const result = await userService.getMyEvents(req.user.id, {
        page,
        limit,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getMyPayments(req, res, next) {
    try {
      const { page, limit } = req.validated.query;
      const result = await userService.getMyPayments(req.user.id, {
        page,
        limit,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}
