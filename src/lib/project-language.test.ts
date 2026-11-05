import { describe, expect, it } from 'vitest';
import { projectLanguage } from './project-language';

describe('projectLanguage', () => {
  it('finds the language whatever the name style or case', () => {
    expect(projectLanguage('Libft')).toBe('C');
    expect(projectLanguage('FdF')).toBe('C');
    expect(projectLanguage('CPP Module 09')).toBe('C++');
    expect(projectLanguage('webserv')).toBe('C++');
    expect(projectLanguage('Python - 0 - Starting')).toBe('Python');
    expect(projectLanguage('Python Module 09')).toBe('Python');
    expect(projectLanguage('RAG against the machine')).toBe('Python');
    expect(projectLanguage('ft_transcendence')).toBe('TypeScript');
  });
  it('gives nothing for projects without one language', () => {
    for (const project of ['Born2beroot', 'Inception', 'NetPractice', 'Exam Rank 06', 'Work Experience I', 'Python-like']) expect(projectLanguage(project)).toBeNull();
  });
});
