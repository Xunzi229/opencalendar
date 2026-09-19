import { copyFileSync, renameSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const cli = fileURLToPath(new URL('../node_modules/@tauri-apps/cli/tauri.js', import.meta.url))
const source = 'src/renderer/public/calendar-icon.svg'
for (const args of [
  ['icon', source, '--output', 'src-tauri/icons'],
  ['icon', source, '--output', 'resources', '--png', '1024'],
]) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
renameSync(new URL('../resources/1024x1024.png', import.meta.url), new URL('../resources/icon.png', import.meta.url))
copyFileSync(new URL('../src-tauri/icons/icon.ico', import.meta.url), new URL('../resources/icon.ico', import.meta.url))
console.log('Updated platform icons and the 1024px master PNG.')
