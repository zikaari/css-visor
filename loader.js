const {
    registerAsset
} = require('./plugin')

const vm = require('vm')
const path = require('path')
const {
    interpolateName
} = require('loader-utils')

const {
    SourceMapSource,
    ConcatSource,
    RawSource
} = require('webpack-sources')

/**
 * @name LoaderContext
 * @property {function} cacheable
 * @property {function} async
 * @property {function} addDependency
 * @property {function} loadModule
 * @property {string} resourcePath
 * @property {object} options
 */

/**
 * Random placeholder. Marks the location in the source code where the result of other modules should be inserted.
 * @type {string}
 */
const rndPlaceholder =
    "__EXTRACT_LOADER_PLACEHOLDER__" + rndNumber() + rndNumber();

/**
 * Executes the given module's src in a fake context in order to get the resulting string.
 *
 * @this LoaderContext
 * @throws Error
 * @param {string} content - the module's src
 */
function cssVisorLoader(content) {
    const callback = this.async();
    const publicPath = this.options.output.publicPath
    const dependencies = [];
    const script = new vm.Script(content, {
        filename: this.resourcePath,
        displayErrors: true,
    });
    const sandbox = {
        require: resourcePath => {
            const absPath = path
                .resolve(path.dirname(this.resourcePath), resourcePath)
                .split("?")[0];

            // If the required file is the css-loader helper, we return a noop function because we're extracting just the css
            // If the required file should be processed by a loader we do not touch it (even if it is a .js file).
            if (/^[^!]*css-base\.js$/i.test(resourcePath)) {
                return () => { /* noop */ }
            }

            // see if requested resource is yet another css file (css-loader literally resolves @import url('./common.css')), if so return an empty array to skip the include
            if (/css-loader/.test(resourcePath)) {
                const parts = resourcePath.split('!')
                const file = parts[parts.length - 1]
                // dependencies.push(file)
                return []
            }
            // This could be things like 'require('./logo.svg')' etc
            else {
                dependencies.push(resourcePath);
            }

            return rndPlaceholder;
        },
        module: {},
        exports: {},
    };

    this.cacheable();

    sandbox.module.exports = sandbox.exports;
    script.runInNewContext(sandbox);

    Promise.all(dependencies.map(loadModule, this))
        .then(sources =>
            sources.filter(source => source !== null).map(
                // runModule may throw an error, so it's important that our promise is rejected in this case
                (src, i) => runModule(src, dependencies[i], publicPath)
            )
        )
        .then(results =>
            sandbox.module.exports
            .toString()
            .replace(new RegExp(rndPlaceholder, "g"), () => results.shift())
        )
        .then(rawCSS => {
            let maybeSourceMap
            const _exports = sandbox.module.exports
            if (Array.isArray(_exports)) {
                for (const _export of _exports) {
                    maybeSourceMap = Array.isArray(_export) ? _export.find(o => typeof o === 'object' && 'sources' in o) : null
                }
            }

            const hash = interpolateName(this, '[hash:6]', {
                content: rawCSS
            })
            const name = path.basename(this.resourcePath)
            const idx = name.lastIndexOf('.css')
            const filename = name.slice(0, idx)
            const hashedName = filename + `.${hash}` + '.css'
            const basedir = path.relative(
                this.options.context,
                path.dirname(this.resourcePath)
            ).replace(/\\/g, '/')
            const staticPath = path.posix.join(basedir, hashedName)
            const staticPathUnhased = path.posix.join(basedir, filename)

            // Nothing fancy, we're just appending HMR code to whatever css-loader emitted 
            const src = new ConcatSource(
                content, [
                    `var filename = '/${staticPathUnhased}'`,
                    `var hash = '${hash}'`,
                    `var staticPath = '/${staticPath}'`,
                    'if(typeof document !== "undefined") {',
                    '   console.log(module, this)',
                    '   let linkTag = document.head.querySelector(`link[href^="${filename}"]`)',
                    '   if(!linkTag) {',
                    '       linkTag = document.createElement("link")',
                    '       linkTag.rel = "stylesheet"',
                    '       linkTag.type = "text/css"',
                    '       document.head.appendChild(linkTag)',
                    '   }',
                    '   if(linkTag.href !== staticPath) { linkTag.href = staticPath }',
                    '   if(module.hot) {',
                    '       module.hot.accept()',
                    '       module.hot.dispose(() => {',
                    '           setTimeout(() => {',
                    '               var link = document.head.querySelector(`link[href="${staticPath}"]`)',
                    '               if(link) link.parentElement.removeChild(link)',
                    '               }, 500)',
                    '       })',
                    '   }',
                    '}'
                ].join('\n')
            )
            const emitableCSS = maybeSourceMap ? new SourceMapSource(rawCSS, maybeSourceMap.file, maybeSourceMap) : new RawSource(rawCSS)
            registerAsset(this.resourcePath, {
                publicPath: staticPath,
                source: emitableCSS
            })
            callback(null, src.source())
        })
        .catch(callback);

}

/**
 * Executes the given CommonJS module in a fake context to get the exported string. The given module is expected to
 * just return a string without requiring further modules.
 *
 * @throws Error
 * @param {string} src
 * @param {string} filename
 * @param {string} [publicPath]
 * @returns {string}
 */
function runModule(src, filename, publicPath = "") {
    const script = new vm.Script(src, {
        filename,
        displayErrors: true,
    });
    const sandbox = {
        module: {},
        exports: {},
        __webpack_public_path__: publicPath, // eslint-disable-line camelcase
    }

    script.runInNewContext(sandbox);

    return sandbox.module.exports.toString();
}

/**
 * Loads the given module with webpack's internal module loader and returns the source code.
 *
 * @this LoaderContext
 * @param {string} request
 * @returns {Promise<string>}
 */
function loadModule(request) {
    return new Promise((resolve, reject) => {
        // LoaderContext.loadModule automatically calls LoaderContext.addDependency for all requested modules
        this.loadModule(
            request,
            (err, src) => (err ? reject(err) : resolve(src))
        );
    });
}

/**
 * @returns {string}
 */
function rndNumber() {
    return Math.random()
        .toString()
        .slice(2);
}

module.exports = cssVisorLoader;
