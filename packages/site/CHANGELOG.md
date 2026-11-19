# @bscotch/stitch-site Changelog

## 0.10.0 (2026-01-07)

### Features

- Updated all dependencies.

## 0.9.2 (2025-07-15)

### Fixes

- While GameMaker release notes are still fetched for compatibility purposes, they are no longer displayed anywhere since they've been moved out of the official feeds.

## 0.9.1 (2024-10-02)

### Fixes

- Added head content to all site pages
- Improved styling on the new BBCode generator page

## 0.9.0 (2024-10-01)

### Features

- Added a page for converting Markdown to Steam BBCode

## 0.8.1 (2024-09-13)

### Fixes

- Resolved a bunch of issues with the SteamRegions bookmarklet
- Resolved issues with the date pickers for Steam URL date ranges

## 0.8.0 (2024-08-03)

### Features

- Added language-specific store page links

### Fixes

- Made UTM links update on keyup so they're more dynamic

## 0.7.0 (2024-06-17)

### Features

- Added the new Chrome extension features as bookmarklets

## 0.6.0 (2024-04-22)

### Features

- Added SBV to TSV converter

### Fixes

- Resolved issue with missing Stitch logo

## 0.5.0 (2024-04-19)

### Features

- Added a utility page for getting YouTube SBV files from spreadsheets

## 0.4.0 (2023-10-05)

### Features

- Added bookmarklet for Steam Regions
- Added links for Steam Regions & Countries pages

## 0.3.0 (2023-10-05)

### Features

- Added CTA to header
- Added a support banner
- Integrated the new steam tools into the GitHub site

### Fixes

- Added warning colors
- Fixed sorting issue in Steam Traffic comparison summary results
- Resolved dumb footer styling on wide views
- Updated CTA UTM link now that it is on every Stitch site page
- Resolved a bunch of mobile styling issues

## 0.2.0 (2023-09-20)

### Features

- Bumped all deps

## 0.1.1 (2023-08-15)

### Fixes

- Resolved minor alt-text mistake
- Updated all deps

## 0.1.0 (2023-07-10)

### Features

- Release feed preferences are now stored
- Drafted the unified feed browser
- Added creation of the unified feed to the site builder
- Added more detail to the Stitch site
- Finished landing page draft

### Fixes

- Improved robustness of the site
- Removed client-side nav to the feed since it breaks in prod
- Resolved a relative path error
- Resolved issue with the unified feed not being written to disk in CI
- Resolved base path issue with landing page links
- Removed legacy import of Google Font
- Made the releases page presentable
- Added use of the release notes cache to future builds
- Resolved order of ops problem in build script
- Resolved import issue in build script
- Improved the landing page styling
- Resolved issues related to GitHub pages using a folder as root URL