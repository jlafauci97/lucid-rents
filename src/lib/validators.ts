import { z } from "zod";

export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  borough: z
    .enum(["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"])
    .optional(),
  zip: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export const categoryRatingSchema = z.object({
  category_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  subcategory_flags: z.array(z.string()).optional().default([]),
});

export const createReviewSchema = z.object({
  building_id: z.string().uuid(),
  unit_id: z.string().uuid().optional(),
  unit_number: z.string().max(20).optional(),
  overall_rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(200),
  body: z.string().min(10).max(5000),
  category_ratings: z.array(categoryRatingSchema).min(1),
  move_in_date: z.string().date().optional(),
  move_out_date: z.string().date().optional(),
  rent_amount: z.number().int().positive().optional(),
  lease_type: z
    .enum(["rent_stabilized", "market_rate", "rent_controlled"])
    .optional(),
});

export const updateReviewSchema = createReviewSchema
  .partial()
  .omit({ building_id: true });

export const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional().or(z.literal("")),
});

export type SearchParams = z.infer<typeof searchSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
