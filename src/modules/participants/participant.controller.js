import { ParticipantService } from "./participant.service.js";

const participantService = new ParticipantService();

export class ParticipantController {
  async addParticipant(req, res, next) {
    try {
      const result = await participantService.addParticipant(
        req.validated.params.eventId,
        req.user.id,
        req.validated.body,
      );
      res.status(201).json({
        success: true,
        message: "Participant ajouté avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async importFromCsv(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          code: "BAD_REQUEST",
          message: "Aucun fichier CSV fourni",
        });
      }

      const result = await participantService.importFromCsv(
        req.validated.params.eventId,
        req.user.id,
        req.file.buffer,
      );

      res.status(200).json({
        success: true,
        message: `${result.imported} participant(s) importé(s) avec succès`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getParticipants(req, res, next) {
    try {
      const { page, limit, search } = req.validated.query;
      const result = await participantService.getParticipants(
        req.validated.params.eventId,
        req.user.id,
        req.user.role,
        { page, limit, search },
      );
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async getParticipantById(req, res, next) {
    try {
      const result = await participantService.getParticipantById(
        req.validated.params.participantId,
        req.validated.params.eventId,
        req.user.id,
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateParticipant(req, res, next) {
    try {
      const result = await participantService.updateParticipant(
        req.validated.params.participantId,
        req.validated.params.eventId,
        req.user.id,
        req.validated.body,
      );
      res.status(200).json({
        success: true,
        message: "Participant mis à jour avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteParticipant(req, res, next) {
    try {
      await participantService.deleteParticipant(
        req.validated.params.participantId,
        req.validated.params.eventId,
        req.user.id,
      );
      res.status(200).json({
        success: true,
        message: "Participant supprimé avec succès",
      });
    } catch (error) {
      next(error);
    }
  }
}
