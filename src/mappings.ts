import { stripLanguagePrefix } from "./resources.ts"
import { Metadata, MetadataEntry } from "./metadata.ts"
import { path } from "./deps.ts"

export type Mapping = [string, string]
export type Mappings = Record<string, string>
type CharacterIdMappings = Record<string, string>

function stripIllegalCharacters(text: string): string {
    return text.replaceAll("/", " ").replace(/[/\\?%*:|"<>]/g, "")
}

function metadataHasForeignName(metadata: MetadataEntry): boolean {
    const english_name = metadata["name_en"]
    const other_names = [metadata["name_jp"], metadata["name_chs_t"], metadata["name_chs"]]
    return other_names.includes(english_name)
}

function buildCharacterIdMappings(metadata: Metadata): CharacterIdMappings {
    // why the fuck does JS implicitly convert keys to strings on objects?
    const mappings: Record<string, string> = { 0: "Freed Jyanshi" }
    for (const character of metadata["item_definition_character"]) {
        mappings[character["id"]] = character["name_en"]
    }
    return mappings
}

function buildVoiceMapping(metadata: MetadataEntry, character_id_mapping: CharacterIdMappings): Mapping {
    const voice_type: string = metadata["type"]
    const original_path: string = metadata["path"]
    const original_name = original_path.split("/").pop()
    const english_name = metadata["name_en"].toLowerCase()
    const character_id = 200000 + metadata["id"]
    const character_name = character_id_mapping[character_id]
    if (character_id == undefined) {
        // this should only happen when they change their format significantly
        // so the code would need to get updated anyway
        console.error(metadata)
        throw `missing character name for ID ${character_id}`
    }
    let base_path = `voices/${character_name}/`

    if (voice_type.startsWith("fan_")) {
        base_path += "yaku - "
    }
    if (voice_type.startsWith("scfan_")) {
        base_path += "sp yaku - "
    }
    if (voice_type.startsWith("act_")) {
        base_path += "action - "
    }
    if (voice_type.startsWith("gameend_")) {
        base_path += "game end - "
    }

    if (english_name.length > 0) {
        base_path += stripIllegalCharacters(english_name)
    } else {
        base_path += original_name
    }

    return [original_path, base_path]
}

function buildVoiceMappings(metadata: Metadata, character_id_mapping: CharacterIdMappings): Mappings {
    const mappings: Mappings = {}
    for (const entry of metadata["voice_sound"] || []) {
        const [key, value] = buildVoiceMapping(entry, character_id_mapping)
        mappings[key] = value
    }
    return mappings
}

function buildTitleMapping(metadata: MetadataEntry, path_key: string, default_extension: string, suffix = ""): [string, string] {
    const base_path = "titles/"
    const file_path: string = metadata[path_key]
    const parsed_path = path.posix.parse(file_path)
    const extension = (parsed_path.ext || default_extension)
    const english_name = metadata["name_en"]
    if (parsed_path.name.endsWith("3")) {
        suffix = " (sanma)" + suffix
    }

    let new_path: string
    if (english_name && !metadataHasForeignName(metadata)) {
        new_path = base_path + stripIllegalCharacters(english_name) + suffix + extension
    } else {
        new_path = base_path + parsed_path.base
    }

    return [file_path, new_path]
}

function buildTitleMappings(metadata: Metadata): Mappings {
    const mappings: Record<string, string> = {}

    for (const entry of metadata["item_definition_title"] || []) {
        const [file_path, new_path] = buildTitleMapping(entry, "icon", ".png")
        const [item_path, new_item_path] = buildTitleMapping(entry, "icon_item", ".jpg", " item")

        mappings[file_path] = new_path

        // not all titles have the item version
        if (file_path != item_path) {
            mappings[item_path] = new_item_path
        }
    }
    return mappings
}

function buildItemMappings(metadata: Metadata, key: string): Mappings {
    const mappings: Record<string, string> = {}
    const base_path = "items/"

    for (const entry of metadata[key] || []) {
        const file_path: string = entry["icon"]
        const english_name = entry["name_en"]
        if (!file_path || file_path == "-") continue
        const name = path.posix.basename(file_path)
        const extension = path.posix.extname(name) || ".jpg"
        const suffix = name.includes("_limit") ? " locked" : ""

        if (english_name && !metadataHasForeignName(entry)) {
            mappings[file_path] = base_path + stripIllegalCharacters(english_name) + suffix + extension
        } else {
            mappings[file_path] = base_path + name
        }
    }

    return mappings
}

function buildRankMappings(metadata: Metadata): Mappings {
    const mappings: Record<string, string> = {}
    const base_path = "ranks/"

    for (const entry of metadata["level_definition_level_definition"] || []) {
        const file_path: string = entry["primary_icon"]
        const english_name = entry["name_en"]
        const name = path.posix.basename(file_path)
        const extension = path.posix.extname(name)
        const prefix = name.startsWith("sanma_") ? "3p " : ""
        mappings[file_path] = base_path + prefix + stripIllegalCharacters(english_name) + extension
    }

    return mappings
}

function buildSkinMappings(metadata: Metadata, character_id_mappings: CharacterIdMappings): Mappings {
    const mappings: Record<string, string> = {}
    const base_path = "skins"

    for (const entry of metadata["item_definition_skin"] || []) {
        const file_path: string = entry["path"]
        const skin_name = stripIllegalCharacters(entry["name_en"])
        const character_id = entry["character_id"]
        const character_name = stripIllegalCharacters(character_id_mappings[character_id])
        let new_path: string
        if (character_id == 0) {
            const suffix = file_path.split("_").pop() || path.basename(file_path)
            new_path = path.posix.join(base_path, character_name + suffix)
        } else if (entry["type"] == 0) {
            new_path = path.posix.join(base_path, character_name, "Default")
        } else {
            new_path = path.posix.join(base_path, character_name, skin_name)
        }

        mappings[file_path] = new_path
    }

    return mappings
}

function buildEmoteMappings(metadata: Metadata): Mappings {
    const mappings: Record<string, string> = {}
    const base_path = "emotes/"
    for (const character of metadata["item_definition_character"] || []) {
        mappings[character["emo"]] = base_path + stripIllegalCharacters(character["name_en"])
    }
    return mappings
}

export function buildMappings(metadata: Metadata): Mappings {
    const character_id_mappings = buildCharacterIdMappings(metadata)
    return {
        ...buildVoiceMappings(metadata, character_id_mappings),
        ...buildTitleMappings(metadata),
        ...buildItemMappings(metadata, "item_definition_item"),
        ...buildItemMappings(metadata, "mall_goods"),
        ...buildItemMappings(metadata, "desktop_chest"),
        ...buildItemMappings(metadata, "exchange_exchange"),
        ...buildItemMappings(metadata, "exchange_searchexchange"),
        ...buildItemMappings(metadata, "mall_month_ticket"),
        ...buildRankMappings(metadata),
        ...buildSkinMappings(metadata, character_id_mappings),
        ...buildEmoteMappings(metadata)
    }
}

export function mapPath(file_path: string, mappings: Mappings): string {
    const base_path = stripLanguagePrefix(file_path)
    const parsed_path = path.posix.parse(base_path)
    const extensionless_path = path.posix.join(parsed_path.dir, parsed_path.name)
    const new_base_path = mappings[base_path]
    const new_extensionless_path = mappings[extensionless_path]
    const new_dir = mappings[parsed_path.dir]

    if (new_base_path) {
        return new_base_path
    } else if (new_extensionless_path) {
        return new_extensionless_path + parsed_path.ext
    } else if (new_dir) {
        return path.posix.join(new_dir, parsed_path.base)
    } else {
        return path.posix.join("other", base_path)
    }
}