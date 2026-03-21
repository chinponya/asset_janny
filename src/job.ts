import { Options } from "./cli.ts";
import {
  downloadFile,
  GameServer,
  remoteSize,
  resourcePathWithVersion,
  resourceUrl,
} from "./endpoint.ts";
import { mapPath, Mappings } from "./mappings.ts";
import { Resource, Resources } from "./resources.ts";
import { path, pool, progress } from "./deps.ts";
import { isEncrypted } from "./xor.ts";

export enum ConflictPolicy {
  FilePrefix,
  FileSuffix,
  DirectoryPrefix,
  Skip,
}

export enum RemapPolicy {
  None,
  Version,
  Metadata,
}

export type Job = {
  resource: Resource;
  output_directory: string;
  output_path: string;
  decrypt: boolean;
  conflict_policy: ConflictPolicy;
};

export type Jobs = Array<Job>;

export type JobResult = {
  success: boolean;
  resource: Resource;
  url: URL;
  path: string;
};

export type JobResults = Array<JobResult>;

export function buildJob(
  resource: Resource,
  options: Options,
  mappings: Mappings,
): Job {
  let output_path: string;
  switch (options.remap_policy) {
    case RemapPolicy.None:
      output_path = resourcePathWithVersion(resource);
      break;
    case RemapPolicy.Version:
      output_path = resource.path;
      break;
    case RemapPolicy.Metadata:
      output_path = mapPath(resource, mappings);
      break;
  }

  return {
    resource: resource,
    output_directory: options.output,
    output_path: output_path,
    conflict_policy: options.conflict_policy,
    decrypt: options.decrypt,
  };
}

export function buildJobs(
  resources: Resources,
  options: Options,
  mappings: Mappings,
): Jobs {
  console.log(`building jobs for ${resources.length} resources`);
  return resources
    .filter((r) => r.server != GameServer.NONE)
    .map((r) => buildJob(r, options, mappings));
}

export function nativePath(job: Job): string {
  return path.resolve(
    job.output_directory,
    ...job.output_path.split(path.posix.sep),
  );
}

export function resolveConflict(job: Job): Job {
  switch (job.conflict_policy) {
    case ConflictPolicy.FilePrefix:
      return addFilePrefix(job);
    case ConflictPolicy.FileSuffix:
      return addFileSuffix(job);
    case ConflictPolicy.DirectoryPrefix:
      return addDirectoryPrefix(job);
    case ConflictPolicy.Skip:
      return job;
  }
}

function addFileSuffix(job: Job): Job {
  const parsed_path = path.posix.parse(job.output_path);
  const extensionless_path = path.posix.join(parsed_path.dir, parsed_path.name);
  const suffix = ` [${job.resource.language}]`;
  const output_path = extensionless_path + suffix + parsed_path.ext;

  return { ...job, output_path: output_path };
}

function addFilePrefix(job: Job): Job {
  const parsed_path = path.posix.parse(job.output_path);
  const suffix = `[${job.resource.language}] `;
  const output_path = path.posix.join(
    parsed_path.dir,
    suffix + parsed_path.base,
  );

  return { ...job, output_path: output_path };
}

function addDirectoryPrefix(job: Job): Job {
  const output_path = path.posix.join(job.resource.language, job.output_path);
  return { ...job, output_path: output_path };
}

export async function localSize(file_path: string): Promise<number> {
  try {
    const stat = await Deno.stat(file_path);
    return stat.isFile ? stat.size : -1;
  } catch {
    return -1;
  }
}

export async function isDuplicate(
  url: URL,
  file_path: string,
): Promise<boolean> {
  const local_size = await localSize(file_path);
  if (local_size < 0) return false;
  const remote_size = await remoteSize(url);
  return (remote_size > 0 && local_size > 0 && remote_size == local_size);
}

export async function conflictsWithExisting(
  file_path: string,
): Promise<boolean> {
  try {
    await Deno.stat(file_path);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectoryExists(file_path: string): Promise<void> {
  await Deno.mkdir(path.dirname(file_path), { recursive: true });
}

export async function processJob(job: Job): Promise<JobResult> {
  const resource_url = resourceUrl(job.resource);
  let native_path = nativePath(job);
  const result = {
    resource: job.resource,
    url: resource_url,
    path: native_path,
  };

  const uses_skip_policy = job.conflict_policy == ConflictPolicy.Skip;

  if (uses_skip_policy) {
    const is_duplicate = await isDuplicate(resource_url, native_path);
    if (is_duplicate) {
      return { ...result, success: true };
    }
  }

  let conflicts = await conflictsWithExisting(native_path);
  if (conflicts && uses_skip_policy) {
    return { ...result, success: true };
  }

  if (conflicts) {
    job = resolveConflict(job);
    native_path = nativePath(job);
  }

  conflicts = await conflictsWithExisting(native_path);
  if (conflicts) {
    return { ...result, success: false };
  }

  await ensureDirectoryExists(native_path);

  try {
    const success = await downloadFile(resource_url, native_path, job.decrypt);
    return { ...result, success: success };
  } catch {
    return { ...result, success: false };
  }
}

// deno-lint-ignore require-await
export async function dryProcessJob(job: Job): Promise<JobResult> {
  return {
    success: true,
    resource: job.resource,
    url: resourceUrl(job.resource),
    path: nativePath(job),
  };
}

export async function processJobs(
  jobs: Jobs,
  options: Options,
): Promise<JobResults> {
  let bar: progress.default | undefined;
  let logFn;
  let completed = 0;
  if (options.progress && !options.dry_run) {
    bar = new progress.default({
      title: "downloading",
      total: jobs.length,
      clear: true,
      display: ":title :bar :percent :time [eta :eta] :completed/:total",
    });
    logFn = (v: string) => bar?.console(v);
  } else {
    bar = undefined;
    logFn = console.log;
  }

  const processFn = options.dry_run ? dryProcessJob : processJob;
  const results = pool.pooledMap(options.jobs, jobs, processFn);
  const job_results: JobResults = [];
  for await (const job_result of results) {
    job_results.push(job_result);

    if (bar) {
      bar.render(completed++);
    }

    if (options.dry_run) {
      const output = {
        url: job_result.url,
        local_path: job_result.path,
        encrypted: isEncrypted(job_result.url),
        ...job_result.resource,
      };
      logFn(JSON.stringify(output));
    } else if (!job_result.success) {
      logFn(`failed '${job_result.url}' '${job_result.path}'`);
    }
  }

  if (bar) {
    bar.end();
  }

  return job_results;
}
