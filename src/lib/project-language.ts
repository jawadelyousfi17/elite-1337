export type ProjectLanguage = 'C' | 'C++' | 'Python' | 'TypeScript';

const C = ['libft', 'ft_printf', 'get_next_line', 'so_long', 'fdf', 'fract-ol', 'pipex', 'minitalk', 'push_swap', 'philosophers', 'minishell', 'cub3d', 'minirt', 'malloc', 'ft_ls', 'ft_ping', 'strace'];
const CPP = ['webserv', 'ft_irc', 'ft_containers'];
const PYTHON = ['a-maze-ing', 'call me maybe', 'fly-in', 'rag against the machine', 'pac-man', 'piscine django', 'python for data science'];
const KNOWN = new Map<string, ProjectLanguage>([...C.map((name) => [name, 'C'] as const), ...CPP.map((name) => [name, 'C++'] as const), ...PYTHON.map((name) => [name, 'Python'] as const), ['ft_transcendence', 'TypeScript']]);

/**
 * The language a project is written in. 42 does not publish it, so this is a hand-kept list; null when a project has
 * no single language (Born2beroot, Inception, NetPractice) or it depends on the student's track (exams).
 */
export function projectLanguage(project: string): ProjectLanguage | null {
  const name = project.trim().toLowerCase();
  if (name.startsWith('cpp module')) return 'C++';
  if (/^python (-|module)/.test(name)) return 'Python';
  return KNOWN.get(name) ?? null;
}
