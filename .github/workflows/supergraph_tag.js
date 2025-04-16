const releasePlease = require('release-please');
const simpleGit = require('simple-git');

module.exports = async ({github, context, token}) => {
  const ghRelease = await releasePlease.GitHub.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    token: token,
  });

  const manifest = await releasePlease.Manifest.fromManifest(
    ghRelease,
    ghRelease.repository.defaultBranch,
    'release-please-config.json',
    '.release-please-manifest.json',
    {}
  );

  const pullRequests = await manifest.buildPullRequests();
  const pullRequest = pullRequests.find((pullRequest) => pullRequest.updates.some((update) => update.path === 'charts/supergraph/Chart.yaml'));
  console.log(`Supergraph Pull Request: ${JSON.stringify(pullRequest)}`);

  const git = simpleGit();

  let lastTag = await git.raw('describe', '--tags', '--abbrev=0', '--match', 'supergraph@v*').catch((err) => undefined);
  if (lastTag !== undefined) {
    lastTag = lastTag.trim();
  }
  console.log(`Last Tag: ${JSON.stringify(lastTag)}`);

  const commitsSince = parseInt((lastTag ? await git.raw('rev-list', `${lastTag}..HEAD`, '--count') : await git.raw('rev-list', '--count', '--all')).trim());
  console.log(`Commits Since: ${commitsSince}`);

  let version = '';
  if (lastTag !== undefined && commitsSince === 0) {
    version = lastTag.split("@v").pop();
    console.log(`Release Version: ${version}`);
  } else if (pullRequest !== undefined) {
    const releaseData = pullRequest.body.releaseData.find((release) => release.component === 'supergraph-schema');
    version = `${releaseData.version.major}.${releaseData.version.minor}.${releaseData.version.patch}-rc${commitsSince}`;
    console.log(`Release Candidate Version: ${version}`);
  } else {
    console.log(`No version to release.`);
  };

  return version
}
