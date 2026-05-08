import esbuild from 'esbuild'
import fs from 'node:fs/promises'
import pkg from './package.json' with { type: 'json' }
import manifest from './manifest.json' with { type: 'json' }

const release = (process.argv[2] === 'release')

const extension = await esbuild.context({
    plugins: [{
        name: 'custom-plugin',
        setup(build) {
            build.onEnd(async() => {
                await fs.cp('style.css', 'dist/extension/style.css')

                manifest.version = pkg.version
                await fs.writeFile('dist/extension/manifest.json', JSON.stringify(manifest, null, 2))
            })
        }
    }],
    entryPoints: ['script.ts'],
    outfile: 'dist/extension/script.js',
    bundle: true,
    sourcemap: release ? false : 'inline',
    minify: release
})

const server = await esbuild.context({
    entryPoints: ['server.ts'],
    outfile: 'dist/server.js',
    bundle: false,
    minify: release
})

if(release) {
    await extension.rebuild()
    await server.rebuild()
    process.exit(0)
}else{
    await Promise.all([extension.watch(), server.watch()])
}
