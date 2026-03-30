import { z } from "zod";

export const searchSchema = z.object({
  q: z.string().max(200).optional().default(""),
  borough: z
    .enum(["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"])
    .optional(),
  zip: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  sort: z
    .enum(["relevance", "score-desc", "score-asc", "violations-desc", "reviews-desc"])
    .optional()
    .default("relevance"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
}).refine((data) => data.q || data.zip, {
  message: "Either q or zip must be provided",
});

export const categoryRatingSchema = z.object({
  category_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  subcategory_flags: z.array(z.string()).optional().default([]),
});

export const createReviewSchema = z.object({
  building_id: z.string().uuid(),
  unit_id: z.string().uuid().optional(),
  unit_number: z.string().min(1).max(20),
  reviewer_display_preference: z.enum(["name", "anonymous"]),
  title: z.string().min(1).max(200),
  body: z.string().min(10).max(5000),
  pro_tags: z.array(z.string()).min(1),
  con_tags: z.array(z.string()).min(1),
  category_ratings: z.array(categoryRatingSchema).min(1),
  move_in_date: z.string().date(),
  move_out_date: z.string().date().optional(),
  rent_amount: z.number().int().positive(),
  lease_type: z.enum(["rent_stabilized", "market_rate", "rent_controlled", "rso", "rlto"]),
  landlord_name: z.string().max(200).optional(),
  would_recommend: z.boolean(),
  is_pet_friendly: z.boolean().optional(),
  photo_paths: z.array(z.string()).max(5).optional(),
  amenities: z.array(z.object({
    amenity: z.string(),
    category: z.string(),
    confirmed: z.boolean(),
  })).optional(),
});

export const updateReviewSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(10).max(5000).optional(),
  pro_tags: z.array(z.string()).optional(),
  con_tags: z.array(z.string()).optional(),
  category_ratings: z.array(categoryRatingSchema).optional(),
  move_in_date: z.string().date().optional(),
  move_out_date: z.string().date().optional(),
  rent_amount: z.number().int().positive().optional(),
  lease_type: z.enum(["rent_stabilized", "market_rate", "rent_controlled", "rso", "rlto"]).optional(),
  landlord_name: z.string().max(200).optional(),
  would_recommend: z.boolean().optional(),
  is_pet_friendly: z.boolean().optional(),
  reviewer_display_preference: z.enum(["name", "anonymous"]).optional(),
});

export const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional().or(z.literal("")),
});

export type SearchParams = z.infer<typeof searchSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
