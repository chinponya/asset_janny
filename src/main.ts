import * as cli from "./cli.ts"

const options = cli.parse(Deno.args)
await cli.run(options)
