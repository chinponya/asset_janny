import { defaultGameServer, fetchVersion, fetchResversion, fetchConfigProto, fetchMetadata } from "./endpoint.ts"
import { decodeMetadata } from "./metadata.ts"
import { buildMappings } from "./mappings.ts"
import { Jobs, ConflictPolicy, buildJobs, processJobs } from "./job.ts"
import { flags } from "./deps.ts"
import { Version, parseVersion } from "./version.ts"
import { resourcesNewerThan } from "./resources.ts"

export type Options = {
    output: string
    max_version: Version | undefined
    min_version: Version | undefined
    jobs: number
    conflict_policy: ConflictPolicy
    help: boolean
    progress: boolean
    dry_run: boolean
    remap: boolean
    dump_mappings: boolean
    dump_metadata: boolean
}

const help_text = `
./asset_janny
    --output=[path]
        directory to which files will be downloaded [default: ./assets]

    --max-version=[version]
        download assets for a specific version (inclusive), instead of the latest one [default: none]
        has to conform to the [major].[minor].[patch] format

    --min-version=[version]
        download assets more recent than this version (exclusive) [default: none]
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
`

export function parse(args: string[]) {
    const parse_options: flags.ParseOptions = {
        default: {
            output: "./assets",
            jobs: 1,
            progress: true,
            "dry-run": false,
            remap: true,
            "dump-mappings": false,
            "dump-metadata": false
        },
        string: ["max-version", "min-version", "output", "on-conflict", "jobs"],
        boolean: ["help", "progress", "dry-run", "dump-mappings", "dump-metadata", "remap"],
        negatable: ["progress", "dump-mappings", "dump-metadata", "remap"],
        unknown: (arg, _key, value) => {
            console.error(`Error: unknown flag: ${arg}=${value}`)
            Deno.exit(1)
        }
    }

    const raw_flags = flags.parse(args, parse_options)

    let jobs: number
    if (typeof raw_flags.jobs == "number") {
        jobs = raw_flags.jobs
    } else {
        jobs = parseInt(raw_flags.jobs)
    }

    let conflict_policy: ConflictPolicy
    switch (raw_flags["on-conflict"]) {
        case "prefix_file":
            conflict_policy = ConflictPolicy.FilePrefix
            break
        case "suffix_file":
            conflict_policy = ConflictPolicy.FileSuffix
            break
        case "prefix_dir":
            conflict_policy = ConflictPolicy.DirectoryPrefix
            break
        case "skip":
            conflict_policy = ConflictPolicy.Skip
            break
        default:
            conflict_policy = ConflictPolicy.FileSuffix
    }

    const options: Options = {
        output: raw_flags.output,
        help: raw_flags.help,
        remap: raw_flags.remap,
        progress: raw_flags.progress,
        conflict_policy: conflict_policy,
        dry_run: raw_flags["dry-run"],
        dump_metadata: raw_flags["dump-metadata"],
        dump_mappings: raw_flags["dump-mappings"],
        jobs: jobs,
        max_version: raw_flags["max-version"] ? parseVersion(raw_flags["max-version"]) : undefined,
        min_version: raw_flags["min-version"] ? parseVersion(raw_flags["min-version"]) : undefined
    }

    return options
}

export async function run(options: Options): Promise<void> {
    if (options.help) {
        console.log(help_text)
        return
    }

    console.log(`running with options: ${JSON.stringify(options)}`)

    if (!options.max_version) {
        const game_version = await fetchVersion(defaultGameServer)
        options.max_version = game_version.version
    }

    let resources = await fetchResversion(defaultGameServer, options.max_version)
    const config_proto = await fetchConfigProto(resources)
    const mappings_bin = await fetchMetadata(resources)

    if (options.min_version) {
        resources = resourcesNewerThan(resources, options.min_version)
    }

    let jobs: Jobs
    if (options.remap) {
        const metadata = decodeMetadata(config_proto, mappings_bin)
        if (options.dump_metadata) {
            const metadata_file_name = "metadata.json"
            console.log(`dumping metadata to ${metadata_file_name}`)
            Deno.writeTextFileSync(metadata_file_name, JSON.stringify(metadata, null, 2))
        }
        const mappings = buildMappings(metadata)
        if (options.dump_mappings) {
            const mappings_file_name = "mappings.json"
            console.log(`dumping mappings to ${mappings_file_name}`)
            Deno.writeTextFileSync("mappings.json", JSON.stringify(mappings, null, 2))
        }
        jobs = buildJobs(resources, options, mappings)
    } else {
        jobs = buildJobs(resources, options)
    }

    await processJobs(jobs, options)
}