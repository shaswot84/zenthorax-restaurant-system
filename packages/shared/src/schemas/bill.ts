import { z } from 'zod';

export const requestBillSchema = z.object({
  sessionToken: z.string().uuid('Invalid session token'),
});

export const updateBillSchema = z.object({
  discount: z.number().min(0).optional(),
  vat: z.number().min(0).optional(),
  serviceCharge: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
});

export const markBillPaidSchema = z.object({
  paymentMedium: z.enum([
    'Cash',
    'Card',
    'QR',
    'Manual QR Transfer',
    'Bank Transfer',
    'Other',
  ]),
  note: z.string().max(500).optional(),
});

export const markBillCancelledSchema = z.object({
  reason: z.string().min(5, 'Cancellation reason is required').max(500),
});

export const billDownloadFormSchema = z.object({
  customerName: z.string().min(1, 'Name is required').max(100),
  customerPhone: z.string().min(7, 'Valid phone number is required').max(15),
});

export type RequestBillInput = z.infer<typeof requestBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type MarkBillPaidInput = z.infer<typeof markBillPaidSchema>;
export type MarkBillCancelledInput = z.infer<typeof markBillCancelledSchema>;
export type BillDownloadFormInput = z.infer<typeof billDownloadFormSchema>;
