import type { ApiScaleTeam } from './fortytwo-api';

/** Match the bot's explicit project metadata; unknown projects cannot prove eligibility. */
export function eligibleEvaluation(row: ApiScaleTeam): boolean {
  if (row.id <= 0 || !row.filled_at || !Number.isFinite(Date.parse(row.filled_at)) || !row.flag || !row.corrector || typeof row.corrector !== 'object' || row.corrector.id <= 0 || !row.corrector.login.trim() || row.corrector.login.toLowerCase() === 'invisible') return false;
  const metadata = [row.team?.project?.name, row.team?.project?.slug, row.team?.project_gitlab_path].filter((value): value is string => !!value?.trim());
  if (!metadata.length) return false;
  return !metadata.some((value) => {
    const words = value.toLowerCase().split(/[^\p{L}\p{N}]+/u);
    return words.some((word, i) => word === 'peervideo' || (word === 'peer' && words[i + 1] === 'video'));
  });
}
