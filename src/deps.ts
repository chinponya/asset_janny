import * as flags from "https://deno.land/std@0.177.0/flags/mod.ts"
import * as streams from "https://deno.land/std@0.177.0/streams/mod.ts"
import * as path from "https://deno.land/std@0.177.0/path/mod.ts"
import * as pool from "https://deno.land/std@0.177.0/async/pool.ts"
import * as progress from "https://deno.land/x/progress@v1.3.7/mod.ts"
import { Random } from "https://deno.land/x/random@v1.1.2/Random.js";
// FIXME npm fetch specifiers are not yet supported in `deno bundle`
// https://github.com/denoland/deno/issues/15960
// once this feature is ready, the line below should be changed to:
// import protobufjs from "npm:protobufjs@7.2.2"
import protobufjs from "https://esm.sh/protobufjs@7.2.2"

export { Random, flags, streams, path, pool, progress, protobufjs }