# Stitch Changelog

Major changes to functionality are documented here.

## v10.0.0

- The `Gms2Project` class has been renamed to `StitchProject`. Aliases are still exported to maintain backwards compatibility, but are flagged as deprecated. For most use cases the aliases will be sufficient to keep your code working.
- 💥 _Many_ methods have been converted from synchronous to asynchronous, now returning a promise. Most importantly, you can no longer create a `StitchProject` (a.k.a. `Gms2Project`) instance directly, you'll need to use the async static method `StitchProject.load()`. **This is a breaking change,** and there is no way to make it backwards compatible. This change was made to prevent Stitch from blocking the main thread while it performs its tasks, so that overall performance of applications using Stitch can be improved.
