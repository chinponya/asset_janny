import { appendUrlPath } from "./util.ts"
import { Version, parseVersion, versionToString } from "./version.ts"
import { Language, Resource, Resources, serverForLanguage, languageOfResourcePath, findConfigProtoResource, findMetadataResource, compareByLanguage } from "./resources.ts"
import { isEncrypted, Decryptor } from "./xor.ts"
import { Random, protobufjs, streams } from "./deps.ts"

const headers = new Headers({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36"
})

export enum GameServer {
    EN = "en",
    KR = "kr",
    CN = "chs_t",
    JP = "jp"
}

export const defaultGameServer = GameServer.EN

type GameVersion = {
    version: Version,
    force_version: Version,
    code: string
}

type ResversionJson = Record<"res", Record<string, Record<"prefix", string>>>


export function gameServerUrl(game_server: GameServer): URL {
    switch (game_server) {
        case GameServer.EN:
            return new URL("https://mahjongsoul.game.yo-star.com")
        case GameServer.KR:
            return new URL("https://mahjongsoul.game.yo-star.com")
        case GameServer.CN:
            return new URL("https://game.maj-soul.com/1")
        case GameServer.JP:
            return new URL("https://game.mahjongsoul.com")
    }
}
export function versionUrl(server: GameServer): URL {
    const new_url = appendUrlPath(
        gameServerUrl(server),
        "version.json"
    )
    const random = new Random()
    const random_value = random.string(16, Random.NUMBERS)
    new_url.searchParams.set("randv", random_value)
    return new_url
}

export function resversionUrl(server: GameServer, version: Version): URL {
    return appendUrlPath(
        gameServerUrl(server),
        `resversion${versionToString(version)}.json`
    )
}

export function resourceUrl(resource: Resource): URL {
    const server = serverForLanguage(resource.language)
    return appendUrlPath(
        gameServerUrl(server),
        `v${versionToString(resource.version)}/${resource.path}`
    )
}

export async function fetchVersion(game_server: GameServer): Promise<GameVersion> {
    console.log("fetching game version")
    const url = versionUrl(game_server)
    const response = await fetch(url, { headers: headers })
    const response_json: Record<string, string> = await response.json()
    const game_version: GameVersion = {
        version: parseVersion(response_json["version"]),
        force_version: parseVersion(response_json["force_version"]),
        code: response_json["code"],
    }
    return game_version
}

export async function fetchResversion(server: GameServer, version: Version): Promise<Resources> {
    console.log(`fetching resversion for ${versionToString(version)}`)
    const url = resversionUrl(server, version)
    const response = await fetch(url, { headers: headers })
    const response_json: ResversionJson = await response.json()
    const resources: Resources = Object.entries(response_json["res"])
        .map(([key, value]) => {
            return {
                language: languageOfResourcePath(key),
                path: key,
                version: parseVersion(value["prefix"])
            }
        })

    resources.sort(compareByLanguage)

    return resources
}

export async function fetchConfigProto(resources: Resources): Promise<protobufjs.Root> {
    const configProtoResource = findConfigProtoResource(resources)
    // HACK this rewrites the URL to use the default server (EN),
    // but this information should be taken from somewhere else
    configProtoResource.language = Language.EN
    const url = resourceUrl(configProtoResource)
    const response = await fetch(url, { headers: headers })
    const text_body = await response.text()
    const config_proto = protobufjs.parse(text_body, { keepCase: true }).root
    return config_proto
}

export async function fetchMetadata(resources: Resources): Promise<Uint8Array> {
    console.log("fetching game metadata")
    const mappingsResource = findMetadataResource(resources)
    // HACK this rewrites the URL to use the default server (EN),
    // but this information should be taken from somewhere else
    mappingsResource.language = Language.EN
    const url = resourceUrl(mappingsResource)
    const response = await fetch(url, { headers: headers })
    const response_blob = await response.arrayBuffer()
    return new Uint8Array(response_blob)
}

function parseCfHeader(header: string): Record<string, string> {
    return header
        .split(",")
        .map(v => v.split("="))
        .reduce((acc: Record<string, string>, values) => {
            acc[decodeURIComponent(values[0].trim())] = decodeURIComponent(values[1].trim());
            return acc;
        }, {});
}

export async function remoteSize(url: URL): Promise<number> {
    try {
        const response = await fetch(url, { method: "head", headers: headers })

        if (!response.ok) {
            return -1
        }

        const cf_header = response.headers.get("cf-polished")
        if (cf_header) {
            const parsed_cf_headers = parseCfHeader(cf_header)
            const size = parseInt(parsed_cf_headers["origSize"] || "")
            if (!isNaN(size)) {
                return size
            }
        }

        const content_length = response.headers.get("content-length")
        if (content_length) {
            const size = parseInt(content_length || "")
            if (!isNaN(size)) {
                return size
            }
        }
        
        return -1
    } catch {
        return -1
    }

}

export async function downloadFile(url: URL, path: string): Promise<boolean> {
    const response = await fetch(url)
    if (response.ok && response.body) {
        const file = await Deno.open(path, { write: true, create: true })
        const writable_stream = streams.writableStreamFromWriter(file)
        if (isEncrypted(url)) {
            await response.body.pipeThrough(Decryptor()).pipeTo(writable_stream)
        } else {
            await response.body.pipeTo(writable_stream)
        }

        try {
            file.close()
        } catch {
            // unsure if this is necessary
        }
        return true
    } else {
        return false
    }
}