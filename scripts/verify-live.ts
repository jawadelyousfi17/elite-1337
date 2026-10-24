import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
async function main() {
  const { campusIds, cursusId, excludedUserIds } = await import('../src/lib/config');
  const { fortyTwoApi } = await import('../src/lib/fortytwo-api');
  const { classifyPopulation } = await import('../src/lib/ranking');
  const sources = await Promise.all(campusIds().map(async (campusId) => ({ campusId, records: await fortyTwoApi.cursusUsers(campusId, cursusId()) })));
  const { students, exclusions } = classifyPopulation(sources, cursusId(), excludedUserIds());
  console.log(JSON.stringify({ complete: true, campuses: sources.map(({ campusId, records }) => ({ campusId, cursusRecords: records.length })), eligibleStudents: students.length, hasUniqueGlobalEntries: new Set(students.map((student) => student.id)).size === students.length, unknownCohorts: students.filter((student) => !student.commonCoreEntryYear).length, cohortsDifferingFromPoolYear: students.filter((student) => student.poolYear && student.commonCoreEntryYear && student.poolYear !== student.commonCoreEntryYear).length, exclusions }));
}
main().catch((error) => { console.error(error instanceof Error ? `${error.name}: ${error.message}` : '42 verification failed'); process.exitCode = 1; });
