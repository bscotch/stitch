import {
  parseMonorepoConventionalCommits,
  renderMonorepoConventionalCommits,
} from '@bscotch/workspaces';

const parsed = await parseMonorepoConventionalCommits('.', {
  types: [
    { pattern: /^fix|bug(fix)?|perf(ormance)$/, group: 'Fixes' },
    { pattern: /^feat(ure)?$/, group: 'Features' },
    { pattern: /^docs$/, group: 'Docs' },
  ],
});

await renderMonorepoConventionalCommits(
  parsed,
  (project, versions) => {
    if (project.isRoot) return;
    const title = `# ${
      project.package.displayName || project.package.name
    } Changelog`;
    const versionStrings = versions.map((version) => {
      const header = `## ${version.version} (${
        version.date.toISOString().split('T')[0]
      })`;
      const groups = Object.keys(version.groups).sort();
      const sections = groups.map((group) => {
        const changes = version.groups[group];
        const commits = changes
          .map((commit) => `- ${commit.variables.description}`)
          .join('\n');
        return `### ${group}\n\n${commits}`;
      });
      return `${header}\n\n${sections.join('\n\n')}`;
    });
    return `${title}\n\n${versionStrings.join('\n\n')}`;
  },
  { filename: 'CHANGELOG.md' },
);
