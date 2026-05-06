const CopyWebpackPlugin = require('copy-webpack-plugin')
const path = require('path')

module.exports = {
    mode: 'production',
    resolve: {
        extensions: [ ".ts", ".js" ]
    },
    entry: path.resolve(__dirname, 'script.ts'),
    output: {
        path: path.resolve(__dirname, 'dist/crunch-together'),
        filename: 'script.js'
    },

    module: {
        rules: [{
            test: /\.ts$/,
            use: 'ts-loader',
            exclude: /node_modules/,
        }]
    },

    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, 'manifest.json'),
                    to: path.resolve(__dirname, 'dist/crunch-together/manifest.json')
                },
                {
                    from: path.resolve(__dirname, 'style.css'),
                    to: path.resolve(__dirname, 'dist/crunch-together/style.css')
                }
            ]
        })
    ]
}
