export function gameMakerReleasesUrl<T extends string>(
  projectId: T,
): `/projects/${T}/gamemaker-releases` {
  return `/projects/${projectId}/gamemaker-releases`;
}
