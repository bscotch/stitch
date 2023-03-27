const dotenv = require('dotenv');

dotenv.config();

/** @type {import('@electron-forge/shared-types').ForgeConfigMaker} */
const squirrelMaker = {
  name: '@electron-forge/maker-squirrel',
  /** @type {import('@electron-forge/maker-squirrel').MakerSquirrelConfig } */
  config: {
    name: 'Stitch',
    title: 'Stitch',
    exe: 'Stitch.exe',
    description: 'A tool for managing GameMaker and GameMaker projects.',
    authors: 'Butterscotch Shenanigans',
    setupIcon: 'assets/stitch-logo.ico',
    setupExe: 'StitchSetup.exe',
    certificateFile: './cert.pfx',
    certificatePassword: process.env.CODESIGN_PASSWORD,
  },
  /** @type {import('electron-packager').OfficialPlatform[]} */
  platforms: ['win32'],
};

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
module.exports = {
  packagerConfig: {
    name: 'Stitch',
    icon: 'assets/stitch-logo.ico',
    win32metadata: {
      CompanyName: 'Butterscotch Shenanigans',
      ProductName: 'Stitch',
    },
    // ignore(path) {
    //   const isIncluded =
    //     !path ||
    //     allowedPathRoots.some((allowedPath) => path.startsWith(allowedPath));
    //   console.log(isIncluded, path);
    //   if (isIncluded) {
    //     return false;
    //   }
    //   return true;
    // },
  },
  makers: [squirrelMaker],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'bscotch',
          name: 'stitch',
        },
      },
    },
  ],
};
