/** Students credited with a verified vulnerability report, from HACKER_LOGINS (comma-separated). */
export function hackerLogins(): ReadonlySet<string> {
  return new Set((process.env.HACKER_LOGINS ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
}

export const isHacker = (login: string, hackers = hackerLogins()) => hackers.has(login.toLowerCase());
