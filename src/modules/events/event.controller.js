import { EventService } from "./event.service.js";

const eventService = new EventService();

export class EventController {
  async createEvent(req, res, next) {
    try {
      const result = await eventService.createEvent(
        req.user.id,
        req.validated.body,
        req.file
      );
      res.status(201).json({
        success: true,
        message: "Événement créé avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEvents(req, res, next) {
    try {
      const { page, limit, status } = req.validated.query;
      const result = await eventService.getEvents(req.user.id, {
        page,
        limit,
        status,
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

  async getEventById(req, res, next) {
    try {
      const result = await eventService.getEventById(
        req.validated.params.id,
        req.user.id,
        req.user.role,
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateEvent(req, res, next) {
    try {
      const result = await eventService.updateEvent(
        req.validated.params.id,
        req.user.id,
        req.validated.body,
        req.file
      );
      res.status(200).json({
        success: true,
        message: "Événement mis à jour avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteEvent(req, res, next) {
    try {
      await eventService.deleteEvent(req.validated.params.id, req.user.id);
      res.status(200).json({
        success: true,
        message: "Événement supprimé avec succès",
      });
    } catch (error) {
      next(error);
    }
  }

  async addModerator(req, res, next) {
    try {
      const result = await eventService.addModerator(
        req.validated.params.id,
        req.user.id,
        req.validated.body.moderatorId,
      );
      res.status(201).json({
        success: true,
        message: "Modérateur assigné avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeModerator(req, res, next) {
    try {
      await eventService.removeModerator(
        req.validated.params.eventId,
        req.user.id,
        req.validated.params.moderatorId,
      );
      res.status(200).json({
        success: true,
        message: "Modérateur retiré avec succès",
      });
    } catch (error) {
      next(error);
    }
  }

  async getModerators(req, res, next) {
    try {
      const result = await eventService.getModerators(
        req.validated.params.id,
        req.user.id,
        req.user.role,
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
