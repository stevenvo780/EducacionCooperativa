/**
 * Schemas locales para los endpoints UI git nuevos. Una vez publicado el
 * paquete `@agora/contracts` con estos schemas, este archivo puede
 * sustituirse por re-exports.
 */
import { z } from 'zod';

export const gitGraphCommitSchema = z.object({
  sha: z.string(),
  shortSha: z.string(),
  parents: z.array(z.string()),
  message: z.string(),
  authorName: z.string(),
  authorEmail: z.string(),
  date: z.string(),
  htmlUrl: z.string(),
  refs: z.array(z.string()).default([])
});

export const gitGraphResponseSchema = z.object({
  repoFullName: z.string(),
  defaultBranch: z.string(),
  commits: z.array(gitGraphCommitSchema)
});

export const gitDiffFileSchema = z.object({
  path: z.string(),
  oldPath: z.string().optional(),
  status: z.union([
    z.literal('added'),
    z.literal('removed'),
    z.literal('modified'),
    z.literal('renamed')
  ]),
  additions: z.number(),
  deletions: z.number(),
  patch: z.string()
});

export const gitDiffResponseSchema = z.object({
  base: z.string(),
  head: z.string(),
  files: z.array(gitDiffFileSchema),
  stats: z.object({
    totalAdditions: z.number(),
    totalDeletions: z.number(),
    totalFiles: z.number()
  }),
  truncated: z.boolean().default(false)
});

export const gitRevertResponseSchema = z.object({
  ok: z.boolean(),
  newSha: z.string().optional(),
  message: z.string().optional(),
  filesChanged: z.number().optional(),
  conflicts: z.array(z.string()).optional(),
  error: z.string().optional()
});

export const gitCheckoutResponseSchema = z.object({
  ok: z.boolean(),
  branch: z.string().optional(),
  sha: z.string().optional(),
  htmlUrl: z.string().optional(),
  treeSize: z.number().optional(),
  files: z.array(z.string()).optional(),
  error: z.string().optional()
});

export type GitGraphCommit = z.infer<typeof gitGraphCommitSchema>;
export type GitGraphResponse = z.infer<typeof gitGraphResponseSchema>;
export type GitDiffFile = z.infer<typeof gitDiffFileSchema>;
export type GitDiffResponse = z.infer<typeof gitDiffResponseSchema>;
export type GitRevertResponse = z.infer<typeof gitRevertResponseSchema>;
export type GitCheckoutResponse = z.infer<typeof gitCheckoutResponseSchema>;
