import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const tauri = JSON.parse(read('src-tauri/tauri.conf.json'))
const cargo = read('src-tauri/Cargo.toml').match(/^version = "([^"]+)"/m)?.[1]
const cargoLock = read('src-tauri/Cargo.lock').match(/name = "opencalendar"\nversion = "([^"]+)"/)?.[1]
const tag = process.env.RELEASE_TAG
assert.match(tag ?? '', /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'Expected a version tag such as v0.1.0')
for (const [name, version] of Object.entries({ package: pkg.version, npmLock: lock.version, npmRoot: lock.packages[''].version, tauri: tauri.version, cargo, cargoLock })) {
  assert.equal(`v${version}`, tag, `${name} version does not match the release tag`)
}
console.log(`All package versions match ${tag}`)
