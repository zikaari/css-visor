// To-do : will likely break when multiple compilers use css-visor
const stylesheets = new Map()

class CSSVisor {
    constructor() {}
    static registerAsset(path, asset) {
        stylesheets.set(path, asset)
    }

    moduleHasCSSLoader(module) {
        return module && Array.isArray(module.loaders) && module.loaders.find(o => /css-loader[\/\\]index\.js/.test(o.loader))
    }

    apply(compiler) {
        compiler.hooks.thisCompilation.tap('css-visor', (compilation) => {
            compilation.plugin('build-module', (module) => {
                if (this.moduleHasCSSLoader(module)) {
                    let mod = module
                    while (mod = mod.issuer) {
                        if (Array.isArray(mod.loaders) && mod.loaders.find(o => /style-loader/.test(o.loader))) {
                            throw new Error('css-visor cannot be used along with style-loader, remove style-loader from loader chain to fix')
                        }
                    }
                    const cssLoaderIdx = module.loaders.findIndex(o => /css-loader[\/\\]index\.js/.test(o.loader))
                    const cssVisorIdx = module.loaders.findIndex(o => /css-visor[\/\\]loader\.js/.test(o.loader))
                    if (cssVisorIdx > -1 && cssVisorIdx + 1 !== cssLoaderIdx) {
                        throw new Error('css-visor/loader installed but in wrong order. It must be the first thing that runs right after css-loader')
                    }
                    if (cssVisorIdx === -1) {
                        console.warn(`css-visor plugin activated but accompanying loader was not found. Auto-injecting 'css-visor/loader'`)
                        module.loaders.splice(cssLoaderIdx, 0, {
                            loader: require.resolve('./loader')
                        })
                    }
                }
            })

            compilation.hooks.additionalAssets.tapAsync('css-visor', (callback) => {
                const cssAssets = []
                for (let chunk of compilation.chunks) {
                    for (const module of chunk.modulesIterable) {
                        if (this.moduleHasCSSLoader(module)) {
                            cssAssets.push(module)
                        }
                    }
                }

                cssAssets.sort((a, b) => a.index - b.index)

                const addToCompilationAssets = asset => {
                    if (stylesheets.has(asset.resource)) {
                        const {
                            publicPath,
                            source
                        } = stylesheets.get(asset.resource)
                        compilation.assets[publicPath] = source
                        for (const chunk of asset.chunksIterable) {
                            chunk.files.push(publicPath)
                        }
                    }
                }

                cssAssets.forEach(addToCompilationAssets)
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