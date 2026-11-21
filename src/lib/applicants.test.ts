import { describe, expect, it } from 'vitest';
import { applicantsFromCsv, firstName, inviteMessage, parseCsv, whatsappLink } from './applicants';

const csv = [
  '﻿"Submission ID","Submitted at","Your login","Promo","Your interests fields","Your whatsapp","Campus"',
  '"a1","2026-11-15 11:48:40","JDoe","2026","Web, UI/UX design","+212600000001","Khouribga"',
  '"a2","2026-11-19 16:32:23","Bad login!","2025","Web","",""',
  '"a3","2026-11-19 17:00:00","jdoe ","2026","Others","+212600000002",""',
  '"a4","2026-11-18 10:00:00","asmith","2024","","",""',
].join('\r\n');

describe('applicants', () => {
  it('parses quoted fields with commas and doubled quotes', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\n1,2,3\n')).toEqual([['a', 'b, c', 'say "hi"'], ['1', '2', '3']]);
  });

  it('reads the Tally export, skips bad logins and keeps the latest submission per login', () => {
    const list = applicantsFromCsv(csv);
    expect(list.map((item) => item.login)).toEqual(['jdoe', 'asmith']);
    expect(list[0]).toMatchObject({ id: 'a3', interests: ['Others'], whatsapp: '+212600000002' });
    expect(list[1].interests).toEqual([]);
  });

  it('returns nothing without a login column', () => {
    expect(applicantsFromCsv('"Name"\n"x"')).toEqual([]);
  });

  it('builds WhatsApp links only for phone numbers', () => {
    expect(whatsappLink('+212 600-000001')).toBe('https://wa.me/212600000001');
    expect(whatsappLink('n/a')).toBeNull();
    expect(whatsappLink('+212600000001', 'Salam Sara,\nhi')).toBe('https://wa.me/212600000001?text=Salam%20Sara%2C%0Ahi');
  });

  it('greets by first name, falling back to the login', () => {
    expect(firstName('Abdellah Agouzoul', 'aagouzou')).toBe('Abdellah');
    expect(firstName(null, 'aagouzou')).toBe('aagouzou');
    expect(inviteMessage('Sara')).toMatch(/^Salam Sara,\nYou filled in the form/);
  });
});
