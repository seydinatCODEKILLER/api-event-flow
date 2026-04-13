import { PublicService } from "./public.service.js";

const publicService = new PublicService();

export class PublicController {

  async getPublicEvents(req, res, next) {
    try {
      const result = await publicService.getPublicEvents();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPublicEventById(req, res, next) {
    try {
      const result = await publicService.getPublicEventById(
        req.validated.params.eventId
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async registerToEvent(req, res, next) {
    try {
      const result = await publicService.registerToEvent(
        req.validated.params.eventId,
        req.validated.body
      );
      res.status(201).json({
        success: true,
        message: result.emailSent
          ? "Inscription réussie ! Vérifiez votre email pour votre ticket."
          : "Inscription réussie ! Conservez votre identifiant de ticket.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}