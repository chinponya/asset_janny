import { Version, compareVersion } from "./version.ts"
import { GameServer } from "./endpoint.ts"

export enum Language {
    EN = "en",
    CHS = "chs",
    CHS_T = "chs_t",
    JP = "jp",
    KR = "kr",
}

const languageOrder = Object.values(Language)

export type Resource = {
    language: Language,
    path: string
    version: Version
}

export type Resources = Array<Resource>

export function languageOfResourcePath(path: string): Language {
    const lang = path.split("/")[0]
    switch (lang) {
        case "en":
            return Language.EN
        case "kr":
            return Language.KR
        case "jp":
            return Language.JP
        case "chs_t":
            return Language.CHS_T
        default:
            return Language.CHS
    }
}

export function resourcePrefixForLanguage(language: Language): string {
    if (language == Language.CHS) {
        return ""
    } else {
        return `${language}/`
    }
}

export function prefixOfResourcePath(path: string): string {
    const language = languageOfResourcePath(path)
    return resourcePrefixForLanguage(language)
}

export function stripLanguagePrefix(path: string): string {
    const prefix = prefixOfResourcePath(path)
    return path.replace(prefix, "")
}

export function putLanguagePrefix(path: string, language: Language): string {
    const prefix = resourcePrefixForLanguage(language)
    if (prefix != "" && path.startsWith(prefix)) {
        return path
    } else {
        return prefix + path
    }
}

export function serverForLanguage(language: Language): GameServer {
    switch (language) {
        case Language.EN:
            return GameServer.EN
        case Language.KR:
            return GameServer.KR
        case Language.JP:
            return GameServer.JP
        case Language.CHS:
            return GameServer.CN
        case Language.CHS_T:
            return GameServer.CN
        default:
            return GameServer.CN
    }
}

function findResource(resources: Resources, expected_path: string): Resource {
    const found = resources.find(e => e.path == expected_path)
    if (found) {
        return found
    } else {
        throw (`${expected_path} not found in resource list`)
    }
}

export function resourcesNewerThan(resources: Resources, version: Version): Resources {
    return resources.filter(r => compareVersion(r.version, version) > 0)
}

export function findConfigProtoResource(resources: Resources): Resource {
    const configProtoResourcePath = "res/proto/config.proto"
    return findResource(resources, configProtoResourcePath)
}

export function findMetadataResource(resources: Resources): Resource {
    const mappingsResourcePath = "res/config/lqc.lqbin"
    return findResource(resources, mappingsResourcePath)
}

export function compareByLanguage(a: Resource, b: Resource) {
    return languageOrder.indexOf(a.language) - languageOrder.indexOf(b.language)
}
