import { pathy } from '@bscotch/pathy';
import { expect } from 'chai';
import { AssetSourcesConfig } from './AssetSourcesConfig.js';
import { isDeletedAsset } from './assetSource.types.js';

const tempDir = pathy('tmp');
const audioSampleDir = pathy('audio', 'samples');
const audioExts = ['mp3', 'wav'];
const audioSampleNumbers = [1, 2];
const audioSampleNames = audioExts
  .map((ext) => audioSampleNumbers.map((n) => `audio-${n}.${ext}`))
  .flat();
const audioSamplePaths = audioSampleNames.map((name) =>
  audioSampleDir.join(name),
);

async function resetTmpFolder(subpath: string) {
  const path = tempDir.join(subpath);
  await path.delete({ recursive: true });
  await path.ensureDirectory();
  return path;
}

async function resetAudioSamples(subpath: string) {
  const path = await resetTmpFolder(subpath);
  await Promise.all(audioSamplePaths.map((p) => p.copy(path.join(p.basename))));
  const config = AssetSourcesConfig.from(path);
  const audioSource = await config.addAudioSource();
  await config.refreshAudioSource(audioSource.id);
  return config;
}

xdescribe('Over Google Drive', function () {
  it('can process', async function () {
    const config = AssetSourcesConfig.from(
      'G:.shortcut-targets-by-id\\1FyVSTos8dSRAu3S-H8JUGKoqTaPI1LIQ\\SoundVac',
    );
    await config.addAudioSource();
  });
});

xdescribe('Stitch Source Config', function () {
  it('can create a Stitch Source Config', async function () {
    const config = await resetAudioSamples('create');
    expect(config.path.basename).to.equal(AssetSourcesConfig.basename);
    const configContent = await config.path.read();
    expect(configContent.sources).to.have.lengthOf(1);
    const source = configContent.sources[0];
    expect(source.files.length).to.equal(audioSampleNames.length);
    expect(source.files.every((f) => !f.importable)).to.be.true;
    expect(source.files.every((f) => f.version === 0)).to.be.true;
  });

  it('can mark a file as importable', async function () {
    const config = await resetAudioSamples('mark-importable');
    const source = (await config.listSources())[0];
    const audioFile = source.files[0];

    await config.toggleImportable(source.id, audioFile.id, true);
    const [audioSource] = await config.findSource(source.id);
    const matchingFile = audioSource.files.find((f) => f.id === audioFile.id);
    expect(matchingFile).to.exist;
    expect(matchingFile!.importable).to.be.true;
  });

  it('can detect file changes', async function () {
    const config = await resetAudioSamples('detect-changes');
    const [source] = await config.listSources();
    // Swap filenames so that we detect "changes"
    for (let idx = audioSampleNumbers.length - 1; idx >= 0; idx -= 1) {
      const sampleNumber = audioSampleNumbers[idx];
      for (const file of source.files) {
        const matcher = new RegExp(`(audio-)${sampleNumber}\\.(mp3|wav)`);
        if (file.path.match(matcher)) {
          const newPath = config.dir.join(
            file.path.replace(matcher, `$1${sampleNumber + 1}.$2`),
          );
          await pathy(file.path, config.dir).copy(newPath);
          // Also toggle importable on #2, since it's the one that gets
          // replaced, so we can set that it gets unset.
          if (sampleNumber === 2) {
            await config.toggleImportable(source.id, file.id, false);
          }
        }
      }
    }
    await config.refreshAudioSource(source.id);
    const [refreshedSource] = await config.findSource(source.id);
    const refreshedFiles = refreshedSource.files;
    expect(refreshedFiles.length).to.equal(
      source.files.length + audioExts.length,
    );
    expect(refreshedFiles.every((f) => f.importable)).to.be.false;
    expect(
      refreshedFiles.every((f) => {
        // If idx is 2, we should have a version bump
        return f.path.match(/audio-2\.(mp3|wav)/)
          ? f.version === 1
          : f.version === 0;
      }),
    ).to.be.true;
  });

  it('can detect deleted files', async function () {
    const config = await resetAudioSamples('deletions');
    const source = (await config.listSources())[0];
    const files = source.files;
    for (const file of files) {
      if (file.path.match(/audio-2\.(mp3|wav)/)) {
        await pathy(file.path, config.dir).delete();
      }
    }
    await config.refreshAudioSource(source.id);
    const [refreshedSource] = await config.findSource(source.id);
    const refreshedFiles = refreshedSource.files;
    expect(refreshedFiles.length).to.equal(files.length);
    expect(
      refreshedFiles.every((f) => isDeletedAsset(f) || !f.path.match(/-2\./)),
    ).to.be.true;
  });
});
