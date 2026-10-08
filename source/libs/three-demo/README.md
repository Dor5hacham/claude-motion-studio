# three-demo

Source of `site/vendor/three-demo.js`, the bundle behind the
`three-configurator` card (Product configurator) in `index.html`.

The page opens from `file://`, so it cannot load ES modules. esbuild bundles
`three-entry.js` and Three.js into one classic script. The script sets
`window.LIBS_THREE`, and `site/catalog/libs.js` uses it to register the card.
`LIBS_THREE.THREE` is the whole Three.js namespace; `site/catalog/set2-libs.js`
uses it for the `l2-three-flight` card.

## Rebuild

Run these commands in this folder (Git Bash or PowerShell):

```
npm install
npm run build
```

The build overwrites `../../../site/vendor/three-demo.js`.
Afterwards, delete `node_modules` and `package-lock.json` so that no install stays in `source/reel`.

## Versions

- three 0.186.1 (MIT, see `site/vendor/three.LICENSE.txt`)
- esbuild 0.28.2
