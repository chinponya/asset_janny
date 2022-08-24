import { defaultGameServer, fetchVersion, fetchResversion, fetchConfigProto, fetchMetadata } from "./endpoint.ts"
import { decodeMetadata } from "./metadata.ts"
import { buildMappings } from "./mappings.ts"
import { Jobs, ConflictPolicy, buildJobs, processJobs } from "./job.ts"
import { flags } from "./deps.ts"
import { Version, parseVersion } from "./version.ts"
import { resourcesNewerThan } from "./resources.ts"

export type Options = {
    output: string
    version: Version | undefined
    from_version: Version | undefined
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
    -o [path] | --output=[path]
        directory to which files will be downloaded [default: .]

    -v [version] | --version=[version]
        download assets for a specific version instead of the latest one [default: none]
        has to conform to the [major].[minor].[patch] format

    -f [version] | --fromversion=[version]
        download assets more recent than this version [default: none]
        has to conform to the [major].[minor].[patch] format

    -j [n] | --jobs=[n]
        number of concurrent download jobs [default: 1]

    --onconflict=prefix_file|suffix_file|prefix_dir|skip
        how conflicting names of files from different regions should be handled [default: suffix_file]
          suffix_file adds [region] to the end of a file name
          prefix_file adds [region] to the beginning of a file name
          prefix_dir will move files to output/[region] directory
          skip will skip the download of conflicting file

        note: only files that have different size will have the policy applied
        files with the same size are assumed to be equivalent and are always skipped

    --progress | --no-progress
        display the progress bar [default: true]

    --dryrun
        do not execute download jobs [default: false]
        implies --no-progress

    --remap | --no-remap
        translate remote file paths according to game's metadata [default: true]
        when false, paths will be written using the same paths as they are served under
        disabling this can be useful as an excape hatch for when the metadata format
        significantly changes, breaking the program

    --dumpmetadata | --no-dumpmetadata
        write the decoded game metadata file as json [default: false]
        does nothing with --no-remap

    --dumpmappings | --no-dumpmappings
        write URLs and paths they would be saved to [default: false]
        does nothing with --no-remap

    --help
        show this information and exit
`

export function parse(args: string[]) {
    const {
        output,
        version,
        fromversion,
        jobs,
        onconflict,
        help,
        progress,
        dryrun,
        remap,
        dumpmetadata,
        dumpmappings
    } = flags.parse(
        args,
        {
            alias: {
                "v": "version",
                "f": "fromversion",
                "j": "jobs",
                "o": "output",
            },
            default: {
                output: ".",
                jobs: 1,
                progress: true,
                dry_run: false,
                remap: true,
                dump_mappings: false,
                dump_metadata: false
            },
            string: ["version", "fromversion", "output", "onconflict"],
            boolean: ["help", "progress", "dryrun", "dumpmappings", "dumpmetadata", "remap"],
            negatable: ["progress", "dumpmappings", "dumpmetadata", "remap"]
        }
    )

    let conflict_policy: ConflictPolicy
    switch (onconflict) {
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
        output,
        help,
        remap,
        progress,
        conflict_policy,
        dry_run: dryrun,
        dump_metadata: dumpmetadata,
        dump_mappings: dumpmappings,
        jobs: typeof (jobs) == "number" ? jobs : 1,
        version: version ? parseVersion(version) : undefined,
        from_version: fromversion ? parseVersion(fromversion) : undefined
    }

    return options
}

export async function run(options: Options): Promise<void> {
    if (options.help) {
        console.log(help_text)
        return
    }

    console.log(`running with options: ${JSON.stringify(options)}`)

    if (!options.version) {
        const game_version = await fetchVersion(defaultGameServer)
        options.version = game_version.version
    }

    let resources = await fetchResversion(defaultGameServer, options.version)

    if (options.from_version) {
        resources = resourcesNewerThan(resources, options.from_version)
    }

    let jobs: Jobs
    if (options.remap) {
        const config_proto = await fetchConfigProto(resources)
        const mappings_bin = await fetchMetadata(resources)
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