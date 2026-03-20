# 0.5.0 (unreleased)
breaking changes:
- --dump-mappings and --dump-metadata will now save the file to --output directory instead of current working directory
- --remap/--no-remap option changed to --remap=none|version|metadata
  * --remap=metadata (default) is equivalent to old --remap
  * --remap=version is equivalent to old --no-remap
  * --remap=none is brand new and it will preserve resource version in the file path

features:
- --decrypt/--no-decrypt
    adds control for asset decryption which was previously implicit (enabled by default)

fixes:
- voice lines are once again mapped to the correct location
- spine directories are mapped to a subdirectory of skins

# For older changes see [releases](https://github.com/chinponya/asset_janny/releases)