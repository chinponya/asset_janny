import {
  defaultGameServer,
  fetchConfigProto,
  fetchMetadata,
  fetchResversion,
  fetchVersion,
} from "./endpoint.ts";
import { decodeMetadata } from "./metadata.ts";
import { buildMappings } from "./mappings.ts";
import { buildJobs, ConflictPolicy, processJobs, RemapPolicy } from "./job.ts";
import { flags, path } from "./deps.ts";
import { parseVersion, Version } from "./version.ts";
import { resourcesNewerThan } from "./resources.ts";

export type Options = {
  output: string;
  max_version: Version | undefined;
  min_version: Version | undefined;
  jobs: number;
  help: boolean;
  progress: boolean;
  dry_run: boolean;
  conflict_policy: ConflictPolicy;
  remap_policy: RemapPolicy;
  decrypt: boolean;
  dump_mappings: boolean;
  dump_metadata: boolean;
  include_low_quality: boolean;
  include_old_cn_resources: boolean;
};

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

    --progress | --no-progress
        display the progress bar [default: true]

    --dry-run
        do not execute download jobs [default: false]
        implies --no-progress

    --on-conflict=prefix_file|suffix_file|prefix_dir|skip
        how conflicting names of files from different regions should be handled [default: suffix_file]
          'suffix_file' adds [region] to the end of a file name
          'prefix_file' adds [region] to the beginning of a file name
          'prefix_dir' will move files to output/[region] directory
          'skip' will skip the download of conflicting file

        note: only files that have different size will have the policy applied
        files with the same size are assumed to be equivalent and are always skipped

    --remap=none|version|metadata
        how file paths should be transformed before writing local files [default: metadata]
        changing this can be useful as an escape hatch for when the metadata format
        significantly changes, breaking the program
          'none' uses remote paths as is (implies --on-conflict=skip)
          'version' strips version prefix
          'metadata' translates remote file paths according to game's metadata

    --decrypt | --no-decrypt
        whether encrypted files should be decrypted before write [default: true]

    --dump-metadata | --no-dump-metadata
        write the decoded game metadata file as json [default: false]
        does nothing with --no-remap

    --dump-mappings | --no-dump-mappings
        write URLs and paths they would be saved to [default: false]
        does nothing with --no-remap

    --include-low-quality | --no-include-low-quality
        downloads lower quality files when multiple quality variants exist [default: false]

    --include-old-cn-resources | --no-include-old-cn-resources
        downloads CN server resources from before the quality variants were introduced [default: false]
        note: all these resources exist in the new 'lang' directories too

    --help
        show this information and exit
`;

export function parse(args: string[]) {
  const parse_options: flags.ParseOptions = {
    default: {
      output: "./assets",
      jobs: 1,
      progress: true,
      "dry-run": false,
      remap: "metadata",
      decrypt: true,
      "dump-mappings": false,
      "dump-metadata": false,
      "include-low-quality": false,
      "include-old-cn-resources": false,
    },
    string: [
      "max-version",
      "min-version",
      "output",
      "on-conflict",
      "jobs",
      "remap",
    ],
    boolean: [
      "help",
      "progress",
      "dry-run",
      "decrypt",
      "dump-mappings",
      "dump-metadata",
      "include-low-quality",
      "include-old-cn-resources",
    ],
    negatable: ["progress", "decrypt", "dump-mappings", "dump-metadata"],
    unknown: (arg, _key, value) => {
      console.error(`Error: unknown flag: ${arg}=${value}`);
      Deno.exit(1);
    },
  };

  const raw_flags = flags.parse(args, parse_options);

  let jobs: number;
  if (typeof raw_flags.jobs == "number") {
    jobs = raw_flags.jobs;
  } else {
    jobs = parseInt(raw_flags.jobs);
  }

  let conflict_policy: ConflictPolicy;
  switch (raw_flags["on-conflict"]) {
    case "prefix_file":
      conflict_policy = ConflictPolicy.FilePrefix;
      break;
    case "suffix_file":
      conflict_policy = ConflictPolicy.FileSuffix;
      break;
    case "prefix_dir":
      conflict_policy = ConflictPolicy.DirectoryPrefix;
      break;
    case "skip":
      conflict_policy = ConflictPolicy.Skip;
      break;
    default:
      conflict_policy = ConflictPolicy.FileSuffix;
  }

  let remap_policy: RemapPolicy;
  switch (raw_flags["remap"]) {
    case "none":
      remap_policy = RemapPolicy.None;
      conflict_policy = ConflictPolicy.Skip;
      break;
    case "version":
      remap_policy = RemapPolicy.Version;
      break;
    case "metadata":
      remap_policy = RemapPolicy.Metadata;
      break;
    default:
      remap_policy = RemapPolicy.Metadata;
  }

  const options: Options = {
    output: raw_flags.output,
    help: raw_flags.help,
    progress: raw_flags.progress,
    dry_run: raw_flags["dry-run"],
    conflict_policy: conflict_policy,
    remap_policy: remap_policy,
    decrypt: raw_flags.decrypt,
    dump_metadata: raw_flags["dump-metadata"],
    dump_mappings: raw_flags["dump-mappings"],
    jobs: jobs,
    max_version: raw_flags["max-version"]
      ? parseVersion(raw_flags["max-version"])
      : undefined,
    min_version: raw_flags["min-version"]
      ? parseVersion(raw_flags["min-version"])
      : undefined,
    include_low_quality: raw_flags["include-low-quality"],
    include_old_cn_resources: raw_flags["include-old-cn-resources"],
  };

  return options;
}

export async function run(options: Options): Promise<void> {
  if (options.help) {
    console.log(help_text);
    return;
  }

  console.log(`running with options: ${JSON.stringify(options)}`);

  if (!options.max_version) {
    const game_version = await fetchVersion(defaultGameServer);
    options.max_version = game_version.version;
  }

  let resources = await fetchResversion(
    defaultGameServer,
    options.max_version,
    options.include_low_quality,
    options.include_old_cn_resources,
  );
  const config_proto = await fetchConfigProto(resources);
  const mappings_bin = await fetchMetadata(resources);

  if (options.min_version) {
    resources = resourcesNewerThan(resources, options.min_version);
  }

  const metadata = decodeMetadata(config_proto, mappings_bin);
  if (options.dump_metadata) {
    const metadata_file_name = path.join(options.output, "metadata.json");
    console.log(`dumping metadata to ${metadata_file_name}`);
    Deno.writeTextFileSync(
      metadata_file_name,
      JSON.stringify(metadata, null, 2),
    );
  }

  const mappings = buildMappings(metadata);
  if (options.dump_mappings) {
    const mappings_file_name = path.join(options.output, "mappings.json");
    console.log(`dumping mappings to ${mappings_file_name}`);
    Deno.writeTextFileSync(
      mappings_file_name,
      JSON.stringify(mappings, null, 2),
    );
  }

  const jobs = buildJobs(resources, options, mappings);

  await processJobs(jobs, options);
}
