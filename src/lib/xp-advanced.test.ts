import { describe, expect, it } from 'vitest';
import { advancedCatalog, advancedOptions, advancedTag, type RawCursusProject } from './xp-advanced';

// Made-up XP values: only the shape of 42's cursus project list matters here.
// Offered everywhere unless a test says otherwise; 16 is Khouribga, 75 Rabat, 1 a campus outside 1337.
const p = (slug: string, difficulty: number | null, extra: Partial<RawCursusProject> = {}): RawCursusProject => ({ slug, name: extra.name ?? slug, difficulty, campus: [{ id: 16 }, { id: 75 }, { id: 1 }], ...extra });
const ours = [16, 21, 55, 75];
const catalog = (projects: RawCursusProject[]) => advancedCatalog(projects, ours);

describe('advancedCatalog', () => {
  it('keeps projects after the Common Core that give XP, sorted by name', () => {
    const list = catalog([p('42cursus-malloc', 100, { name: 'malloc' }), p('42cursus-abstract-vm', 200, { name: 'abstract-vm' }), p('42cursus-libft', 10, { name: 'Libft' })]);
    expect(list).toEqual([{ slug: '42cursus-abstract-vm', name: 'abstract-vm', xp: 200, campuses: [16, 75] }, { slug: '42cursus-malloc', name: 'malloc', xp: 100, campuses: [16, 75] }]);
  });
  it('drops exams, retired and zero-XP projects, and Common Core projects under any slug', () => {
    const list = catalog([
      p('exam-rank-02', 0), p('some-exam', 50, { exam: true }), p('42next-exam-rank-06', 50), p('tweets-deprecated', 50), p('42seoul_test2', 50), p('piscine-object', 0), p('java-module-00', null),
      p('42next-push_swap', 50), p('42cursus-call-me-maybe', 50), p('cpp-module-04', 50), p('ft_transcendence', 50), p('42next-born2beroot', 50),
    ]);
    expect(list).toEqual([]);
  });
  it('keeps late projects that older students take after the Common Core', () => {
    expect(catalog([p('agent-smith', 50), p('the-answer-protocol', 60), p('42_collaborative_resume', 70)]).map((project) => project.slug)).toEqual(['agent-smith', 'the-answer-protocol']);
  });
  it('trims names', () => {
    expect(catalog([p('bgp', 50, { name: ' Bgp' })])[0].name).toBe('Bgp');
  });
  it('drops projects no 1337 campus offers', () => {
    expect(catalog([p('fr-alternance-rncp6-1-an', 90, { campus: [{ id: 1 }, { id: 9 }] }), p('no-campus', 90, { campus: [] })])).toEqual([]);
  });
});

describe('advancedTag', () => {
  it('labels piscine modules and work experience', () => {
    expect(advancedTag('piscine-object-module-02-uml')).toBe('Mod');
    expect(advancedTag('cybersecurity-stockholm-malware')).toBe('Mod');
    expect(advancedTag('data-science-3')).toBe('Mod');
    expect(advancedTag('python-2-datatable')).toBe('Mod');
    expect(advancedTag('work-experience-ii')).toBe('Exp');
    expect(advancedTag('apprentissage-1-an-apprentissage-1-an-2')).toBe('Exp');
    expect(advancedTag('apprenticeship-i')).toBe('Exp');
    expect(advancedTag('42cursus-malloc')).toBe('');
  });
});

describe('advancedOptions', () => {
  const all = [16, 21, 55, 75];
  const list = [{ slug: '42cursus-agent-smith', name: 'Agent Smith', xp: 50, campuses: all }, { slug: 'agent-smith', name: 'Agent Smith', xp: 50, campuses: all }, { slug: 'nm', name: 'nm', xp: 40, campuses: all }];
  it('lists a project 42 has twice only once, under the first slug by default', () => {
    expect(advancedOptions(list, () => false, null).map((option) => option.slug)).toEqual(['42cursus-agent-smith', 'nm']);
  });
  it('keeps the slug the student has a record on', () => {
    expect(advancedOptions(list, (slug) => slug === 'agent-smith', null).map((option) => option.slug)).toEqual(['agent-smith', 'nm']);
  });
  it('shows only what the student\'s campus offers, unless they already have a record on it', () => {
    const rabat = { slug: 'apprentissage-1-an-3', name: 'Apprentissage 1 an - 3', xp: 90, campuses: [55, 75] };
    expect(advancedOptions([...list, rabat], () => false, [16]).map((option) => option.slug)).toEqual(['42cursus-agent-smith', 'nm']);
    expect(advancedOptions([rabat], () => false, [75]).map((option) => option.slug)).toEqual(['apprentissage-1-an-3']);
    expect(advancedOptions([rabat], (slug) => slug === rabat.slug, [16]).map((option) => option.slug)).toEqual(['apprentissage-1-an-3']);
    expect(advancedOptions([rabat], () => false, null)).toHaveLength(1);
  });
  it('sends the browser only what it shows', () => {
    expect(advancedOptions(list.slice(2), () => false, null)).toEqual([{ slug: 'nm', name: 'nm', xp: 40, tag: '' }]);
  });
});
