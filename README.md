# css-visor

The ultimate `style-loader` replacement you knew you needed

`css-visor` is like a supervisor that finds, injects and updates your imported stylesheets - with sourcemaps and no Flash of Unstyled Content

## Background
`css-visor` was created out of long living pain as seen in:

 - [#613 - css-loader with `sourceMap: true` cause adding style tag delayed](https://github.com/webpack-contrib/css-loader/issues/613)

 - [#591 - Use css sourceMaps in development](https://github.com/facebookincubator/create-react-app/pull/591#issuecomment-247807916)

## Usage

Install it

`npm install --save-dev css-visor`

Light it up

```javascript
// webpack.config.js

const CSSVisor = require('css-visor')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
    // existing config
    module: {
        rules: [{
            test: /\.css$/,
            use: [
                {
                    loader: 'css-visor/loader',
                    // Optional
                    options: {
                        /**
                         * Path prefix you'd like to be prefixed in <link> tag
                         * 
                         * Default: ''
                         *  => <link href="/styles/button.da3n1b.css">
                         * 
                         * Custom: 'static/base'
                         *  => <link href="/static/base/styles/button.da3n1b.css">
                         */
                        pathPrefix: 'static/styles' // default: ''
                    }
                },
                {
                    loader: 'css-loader',
                    options: {
                        sourceMap: true,
                    }
                },
                // more loaders (sass, postcss)
            ]
        }]
    },
    plugins: [
        new CSSVisor(),
        new HtmlWebpackPlugin({
            inject: true
        })
    ]
}
```
It should now be working out of the box.

Not working? Make sure to have `css-visor/loader` right before `css-loader` and instance of CSSVisor in `plugins` list of your webpack config.

Still not working? Please file an issue to have it known

## Reliability
`css-visor` is literally built from source of [extract-loader](https://github.com/peerigon/extract-loader). So far, it has shown no problems, even with imported stylsheets, images/svg's (processed through `url-loader`/`file-loader`). 

The only things you can import in a CSS file anyway.

