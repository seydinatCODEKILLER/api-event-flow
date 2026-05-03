import { PaymentService } from "./payment.service.js";

const paymentService = new PaymentService();

export class PaymentController {
  async initiate(req, res, next) {
    try {
      const { eventId, method } = req.validated.body;
      const data = await paymentService.initiate(eventId, req.user.id, method);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async confirm(req, res, next) {
    try {
      const { reference, status, failureReason } = req.validated.body;
      const result = await paymentService.confirm(
        reference,
        req.user.id,
        status,
        failureReason,
      );

      res.status(200).json({ success: result.success, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getDetails(req, res, next) {
    try {
      const data = await paymentService.getPaymentDetails(
        req.validated.params.id,
        req.user.id,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
