export function appendUrlPath(url: URL, to_append: string): URL {
    if (to_append.startsWith("/")) {
        to_append = to_append.replace("/", "")
    }

    if (!url.pathname.endsWith("/")) {
        url.pathname += "/"
    }

    url.pathname += to_append
    return url
}
