import * as flags from "https://deno.land/std@0.152.0/flags/mod.ts"
import * as streams from "https://deno.land/std@0.152.0/streams/mod.ts";
import * as path from "https://deno.land/std@0.152.0/path/mod.ts"
import * as pool from "https://deno.land/std@0.152.0/async/pool.ts"
import * as progress from "https://deno.land/x/progress@v1.2.8/mod.ts"
// XHR polyfill, required for protobufjs to work
import "https://deno.land/x/xhr@0.2.1/mod.ts"
import protobufjs from "https://esm.sh/protobufjs@7.0.0"

export { flags, streams, path, pool, progress, protobufjs }