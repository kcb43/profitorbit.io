


export function createPageUrl(pageName: string) {
    const [pathPart, queryPart] = pageName.split('?');

    const normalizedPath = '/' + pathPart.replace(/^\//, '').toLowerCase().replace(/ /g, '-');

    return queryPart ? `${normalizedPath}?${queryPart}` : normalizedPath;
}