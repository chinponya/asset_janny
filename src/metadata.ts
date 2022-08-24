import { protobufjs } from "./deps.ts"

export type MetadataEntry = Record<string, any>
export type MetadataGroup = Array<MetadataEntry>
export type Metadata = Record<string, MetadataGroup>

export function decodeMetadata(config_proto: protobufjs.Root, mappings_blob: Uint8Array): Metadata {
    // I blame the chinese for this war crime
    console.log("parsing game metadata")
    const config_tables = config_proto.lookupType("ConfigTables")
    const partially_decoded_tables: any = config_tables.decode(mappings_blob)
    const reflected_pb_root = new protobufjs.Root()
    reflected_pb_root.add(config_tables)

    for (const schema of partially_decoded_tables["schemas"]) {
        for (const sheet of schema["sheets"]) {
            const pb_classname = `${schema["name"]}_${sheet["name"]}`
            const pb_type = new protobufjs.Type(pb_classname)
            for (const field of sheet["fields"]) {
                const field_kind = field["array_length"] > 0 ? "repeated" : "optional"
                const pb_field = new protobufjs.Field(
                    field["field_name"],
                    field["pb_index"],
                    field["pb_type"],
                    field_kind
                );
                pb_type.add(pb_field)
            }
            reflected_pb_root.add(pb_type)
        }
    }

    const decoded_tables: Record<string, any> = {}
    for (const data of partially_decoded_tables["datas"]) {
        const pb_classname = `${data["table"]}_${data["sheet"]}`
        const pb_type = reflected_pb_root.lookupType(pb_classname)
        const fields: Array<Uint8Array> = data["data"]
        decoded_tables[pb_classname] = fields.map(field => pb_type.decode(field))
    }

    return decoded_tables
}