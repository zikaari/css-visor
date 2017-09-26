// To-do : will likely break when multiple compilers use css-visor
const stylesheets = new Map()

class CSSVisor {
    constructor() {}
    static registerAsset(path, asset) {
        stylesheets.set(path, asset)
    }
    sortStylesheetOrder(compilation) {
        compilation.chunks.forEach(chunk => {
            let r = chunk.isInitial()
            let v = chunk.hasRuntime()
            chunk.forEachModule(module => {
                if (this.moduleHasCSSLoader(module)) {
                    var r = module.resource
                }
            })
        })
    }
    moduleHasCSSLoader(module) {
        return module && Array.isArray(module.loaders) && module.loaders.find(o => /css-loader/.test(o.loader))
    }
    apply(compiler) {
        compiler.plugin('this-compilation', (compilation) => {
            compilation.plugin('build-module', (module) => {
                if (this.moduleHasCSSLoader(module)) {
                    let mod = module
                    while (mod = mod.issuer) {
                        if (Array.isArray(mod.loaders) && mod.loaders.find(o => /style-loader/.test(o.loader))) {
                            throw new Error('css-visor cannot be used along with style-loader, remove style-loader from loader chain to fix')
                        }
                    }
                    const cssLoaderIdx = module.loaders.findIndex(o => /css-loader/.test(o.loader))
                    const cssVisorIdx = module.loaders.findIndex(o => /css-visor/.test(o.loader))
                    if (cssVisorIdx > -1 && cssVisorIdx + 1 !== cssLoaderIdx) {
                        throw new Error('css-visor/loader installed but in wrong order. It must be the first thing that runs right after css-loader')
                    }
                    if (cssVisorIdx === -1) {
                        module.loaders.splice(cssLoaderIdx, 0, {
                            loader: require.resolve('./loader')
                        })
                    }
                }
            })

            compilation.plugin('additional-assets', (callback) => {
                const initialCSSAssets = []
                const nonInitialCSSAssets = []
                compilation.chunks.forEach(chunk => {
                    if (chunk.isInitial()) {
                        chunk.forEachModule(module => {
                            if (this.moduleHasCSSLoader(module)) {
                                initialCSSAssets.push(module)
                            }
                        })
                    } else {
                        chunk.forEachModule(module => {
                            if (this.moduleHasCSSLoader(module)) {
                                nonInitialCSSAssets.push(module)
                            }
                        })
                    }
                })
                const sorter = (a, b) => (a.index > b.index) ? 1 : (b.index > a.index) ? -1 : 0
                initialCSSAssets.sort(sorter)
                nonInitialCSSAssets.sort(sorter)
                initialCSSAssets.forEach(asset => {
                    const {
                        publicPath,
                        source
                    } = stylesheets.get(asset.resource)
                    compilation.assets[publicPath] = source
                    asset.forEachChunk(chunk => chunk.files.push(publicPath))
                })
                nonInitialCSSAssets.forEach(asset => {
                    const {
                        publicPath,
                        source
                    } = stylesheets.get(asset.resource)
                    compilation.assets[publicPath] = source
                    asset.forEachChunk(chunk => chunk.files.push(publicPath))
                })
                // To-Do : memory clean up
                // stylesheets.forEach((value, resourcePath) => {
                //     if(!initialCSSAssets.find(o => o.resource === resourcePath)) {
                //         stylesheets.delete(resourcePath)
                //     }
                // })
                callback()
            })
        })
    }
}

module.exports = CSSVisor