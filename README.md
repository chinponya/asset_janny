# Asset Janny
A massively overengineered and janky asset downloader for M\*hjong S\*\*l.

### What does it even do?
- It parses the game metadata from a fucky format to something usable.
- It uses the game metadata to categorize assets and change their chang names to english (where applicable).
- It determines on which server an asset should exist (not every server has them all).
- It resolves conflicts between regional versions of assets, by skipping exact duplicates and renaming everything else.
- It "decrypts" assets (where applicable).
- It filters assets older than a given version if desired, making updates less time consuming.

### Cheat sheet
- Download all assets
```
./asset_janny
```

- ...but skip ones older than game version 0.10.149
```
./asset_janny --min-version=0.10.149
```

- ...but in the original catfood file structure
```
./asset_janny --no-remap
```

- ...but put files for each region in a separate directory
```
./asset_janny --on-conflict=prefix_dir
```

- Just show me the URLs it would download and where
```
./asset_janny --dry-run
```

- Just save this weird magic catfood file with asset metadata 
```
./asset_janny --dry-run --dump-metadata
```

### Usage instructions
When using a binary release, run `./asset_janny --help` to get a list of options, much like this one:

```
./asset_janny
    --output=[path]
        directory to which files will be downloaded [default: ./assets]

    --exact-version=[version]
        download assets for a specific version instead of the latest one [default: none]
        has to conform to the [major].[minor].[patch] format

    --min-version=[version]
        download assets more recent than this version [default: none]
        has to conform to the [major].[minor].[patch] format

    --jobs=[n]
        number of concurrent download jobs [default: 1]

    --on-conflict=prefix_file|suffix_file|prefix_dir|skip
        how conflicting names of files from different regions should be handled [default: suffix_file]
          suffix_file adds [region] to the end of a file name
          prefix_file adds [region] to the beginning of a file name
          prefix_dir will move files to output/[region] directory
          skip will skip the download of conflicting file

        note: only files that have different size will have the policy applied
        files with the same size are assumed to be equivalent and are always skipped

    --progress | --no-progress
        display the progress bar [default: true]

    --dry-run
        do not execute download jobs [default: false]
        implies --no-progress

    --remap | --no-remap
        translate remote file paths according to game's metadata [default: true]
        when false, paths will be written using the same paths as they are served under
        disabling this can be useful as an excape hatch for when the metadata format
        significantly changes, breaking the program

    --dump-metadata | --no-dump-metadata
        write the decoded game metadata file as json [default: false]
        does nothing with --no-remap

    --dump-mappings | --no-dump-mappings
        write URLs and paths they would be saved to [default: false]
        does nothing with --no-remap

    --help
        show this information and exit
```

Running `./asset_janny` with no extra arguments will start the download process into the current directory, with default options.

In order to run this from source, you will need [deno](https://deno.land/).
Use `deno task run` to run the program. `deno task dist` to build a linux  executable and `deno task disk-windows` to build a windows executable.

### Known issues
- Windows build is completely untested. I'd be surprised if it actually works fine.
- Some assets don't seem to exist on any of the servers, so they will throw errors at runtime. That's expected. Please let me know if you aware of some fix for this. It's possible that I just overlooked some edge case.
- The name remapping aspect of the program is strongly tied to the structure of game's metadata format. There's a good chance that an update will break it and the code will need to be updated. Just in case, there's an escape hatch for this exact issue: the `--no-remap` flag.
- It naively determines which assets should be decrypted, by checking that the path contains `extendRes`. Sometimes it mangles unencrypted files instead.