import { defineCollection, z } from "astro:content";

const baseSchema = z.object({
  title: z.string(),
  order: z.number(),
  description: z.string().optional(),
  date: z.date().optional(), // yyyy-mm-dd
  updated: z.date().optional(), // yyyy-mm-dd
  draft: z.boolean().optional(),
});

export const collections = {
  koBook: defineCollection({
    type: "content",
    schema: baseSchema,
  }),
  enBook: defineCollection({
    type: "content",
    schema: baseSchema,
  }),
};
