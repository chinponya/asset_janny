const XOR_KEY = 73
const ENCRYPTED_ASSETS_POSTIIVE_PATTERN = new RegExp("\/extendRes\/");
const ENCRYPTED_ASSETS_NEGATIVE_PATTERN = new RegExp("\/spine\/");

export function isEncrypted(url: URL): boolean {
    return ENCRYPTED_ASSETS_POSTIIVE_PATTERN.test(url.pathname)
        && !ENCRYPTED_ASSETS_NEGATIVE_PATTERN.test(url.pathname)
}

export function decryptByte(buffer: Uint8Array): Uint8Array {
    const decrypted = []
    for (const byte of buffer) {
        decrypted.push(XOR_KEY ^ byte)
    }
    return new Uint8Array(decrypted)
}

export const Decryptor = () => new TransformStream(
    {
        transform(chunk, controller) {
            controller.enqueue(decryptByte(chunk))
        },
        flush(controller) {
            controller.terminate()
        },
    },
    {
        highWaterMark: 16,
    }
)