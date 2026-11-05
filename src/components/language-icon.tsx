import { FolderKanban, FileLangC, FileLangCpp, FileLangPy, FileLangTs } from '@/components/icons';
import { projectLanguage, type ProjectLanguage } from '@/lib/project-language';

const ICONS = { C: FileLangC, 'C++': FileLangCpp, Python: FileLangPy, TypeScript: FileLangTs } satisfies Record<ProjectLanguage, unknown>;

/** Language of a project at a glance; projects without one get a plain project icon, so every row has the same start. */
export function LanguageIcon({ project }: { project: string }) {
  const language = projectLanguage(project), Icon = language ? ICONS[language] : FolderKanban;
  return <span className="st-lang" title={language ?? undefined}><Icon size={16} aria-label={language ?? undefined}/></span>;
}
