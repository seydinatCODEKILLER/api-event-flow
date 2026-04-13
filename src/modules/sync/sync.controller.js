import { SyncService } from "./sync.service.js";

const syncService = new SyncService();

export class SyncController {
  async syncScans(req, res, next) {
    try {
      const { eventId } = req.validated.params;
      const { deviceId, scans } = req.validated.body;

      const result = await syncService.syncScans(
        eventId,
        req.user.id,
        deviceId,
        scans,
      );

      res.status(200).json({
        success: true,
        message: `Synchronisation terminée — ${result.valid} validé(s), ${result.conflict} conflit(s)`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSyncReport(req, res, next) {
    try {
      const result = await syncService.getSyncReport(
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

  async getEventStats(req, res, next) {
    try {
      const result = await syncService.getEventStats(
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
}
