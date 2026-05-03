import { FeedService } from "./feed.service.js";

const feedService = new FeedService();

export class FeedController {
  async getFeed(req, res, next) {
    try {
      const { cursor, limit, category, city, search, isFree } =
        req.validated.query;
      const result = await feedService.getFeed({
        cursor,
        limit,
        category,
        city,
        search,
        isFree,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getNearby(req, res, next) {
    try {
      const { latitude, longitude, radius, limit } = req.validated.query;
      const result = await feedService.getNearby(
        latitude,
        longitude,
        radius,
        limit,
      );
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getEventDetail(req, res, next) {
    try {
      const result = await feedService.getEventDetail(
        req.validated.params.id,
        req.user.id,
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async register(req, res, next) {
    try {
      const result = await feedService.register(
        req.validated.params.id,
        req.user.id,
        req.validated.body?.method ?? null,
      );
      const statusCode = result.requiresPayment ? 201 : 200;
      res.status(statusCode).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
