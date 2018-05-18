function cwd (entrypoint, path) {
    return [process.cwd(), entrypoint, path].join('/').replace(/\/\//g, '/');
}

module.exports = { cwd };
