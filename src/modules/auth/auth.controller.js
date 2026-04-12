import { AuthService } from "./auth.service.js";

const authService = new AuthService();

export class AuthController {

  async register(req, res, next) {
    try {
      const result = await authService.register(
        req.validated.body,
        req.file
      );
      res.status(201).json({
        success: true,
        message: "Compte créé avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.validated.body;
      const result = await authService.login(email, password, {
        deviceId: req.body.deviceId || null,
        userAgent: req.headers["user-agent"] || null,
        ipAddress: req.ip || null,
      });
      res.status(200).json({
        success: true,
        message: "Connexion réussie",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req, res, next) {
    try {
      const result = await authService.getCurrentUser(req.user.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const result = await authService.updateProfile(
        req.user.id,
        req.validated.body,
        req.file
      );
      res.status(200).json({
        success: true,
        message: "Profil mis à jour avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.validated.body;
      const result = await authService.refreshToken(refreshToken);
      res.status(200).json({
        success: true,
        message: "Token rafraîchi avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const { refreshToken } = req.validated.body;
      await authService.logout(refreshToken);
      res.status(200).json({
        success: true,
        message: "Déconnexion réussie",
      });
    } catch (error) {
      next(error);
    }
  }

  async revokeAllTokens(req, res, next) {
    try {
      await authService.revokeAllTokens(req.user.id);
      res.status(200).json({
        success: true,
        message: "Tous les appareils ont été déconnectés",
      });
    } catch (error) {
      next(error);
    }
  }
}