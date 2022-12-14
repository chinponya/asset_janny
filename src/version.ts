export type Version = {
    major: number,
    minor: number,
    patch: number,
    stem?: string
}

export function parseVersion(text: string): Version {
    // I'll make this nicer eventually :^)
    if (text.startsWith("v")) {
        text = text.replace("v", "")
    }
    const chunks = text.split(".")
    let stem
    if (chunks.length < 3) {
        throw `invalid version ${text}`
    } else if (chunks.length > 3) {
        stem = chunks.slice(3).join(".")
    } else {
        stem = undefined
    }

    const parsed_chunks = chunks.slice(0, 3).map(e => {
        const v = parseInt(e)
        if (isNaN(v)) {
            throw `invalid version ${text}`
        } else {
            return v
        }
    })

    const version: Version = {
        major: parsed_chunks[0],
        minor: parsed_chunks[1],
        patch: parsed_chunks[2],
        stem: stem
    }
    return version
}

export function versionToString(version: Version): string {
    const version_array = [version.major, version.minor, version.patch].map(e => e.toString())
    const version_stem = version.stem || "w"
    version_array.push(version_stem)
    return version_array.join(".")
}

export function compareVersion(v1: Version, v2: Version): 1 | 0 | -1 {
    const a = [v1.major, v1.minor, v1.patch]
    const b = [v2.major, v2.minor, v2.patch]

    for (let i = 0; i < a.length; i++) {
        if (a[i] == b[i]) {
            continue
        }

        if (a[i] > b[i]) {
            return 1
        }

        if (a[i] < b[i]) {
            return -1
        }
    }

    return 0
}
