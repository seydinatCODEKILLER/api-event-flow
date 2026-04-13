import { TicketService } from "./ticket.service.js";

const ticketService = new TicketService();

export class TicketController {

  async getTickets(req, res, next) {
    try {
      const { page, limit, status } = req.validated.query;
      const result = await ticketService.getTickets(
        req.validated.params.eventId,
        req.user.id,
        req.user.role,
        { page, limit, status }
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

  async getTicketById(req, res, next) {
    try {
      const result = await ticketService.getTicketById(
        req.validated.params.ticketId,
        req.user.id,
        req.user.role
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async sendTicketEmail(req, res, next) {
    try {
      const result = await ticketService.sendTicketEmail(
        req.validated.params.ticketId,
        req.user.id,
        false
      );
      res.status(200).json({
        success: true,
        message: `Ticket envoyé à ${result.to}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async resendTicketEmail(req, res, next) {
    try {
      const result = await ticketService.sendTicketEmail(
        req.validated.params.ticketId,
        req.user.id,
        true
      );
      res.status(200).json({
        success: true,
        message: `Ticket renvoyé à ${result.to}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelTicket(req, res, next) {
    try {
      const result = await ticketService.cancelTicket(
        req.validated.params.ticketId,
        req.user.id
      );
      res.status(200).json({
        success: true,
        message: "Ticket annulé avec succès",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTicketsForSync(req, res, next) {
    try {
      const result = await ticketService.getTicketsForSync(
        req.validated.params.eventId,
        req.user.id
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async validateTicket(req, res, next) {
    try {
      const { qrPayload, deviceId } = req.validated.body;
      const result = await ticketService.validateTicket(
        qrPayload,
        req.user.id,
        deviceId
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