import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Outline numerals avoid platform font differences when regenerating assets.
const digits = [
  'M25 5C2 5 2 71 25 71C48 71 48 5 25 5Z',
  'M12 18L27 5V71M12 71H42',
  'M5 18C10 -1 43 0 43 21C43 35 10 48 5 71H45',
  'M5 10C25 -3 46 6 42 24C40 34 30 37 21 37M21 37C49 34 53 73 25 73C15 73 9 70 4 65',
  'M35 71V5L3 49H47',
  'M43 5H9L6 35C44 22 55 65 31 72C20 75 10 71 4 66',
  'M41 8C9 -6 0 30 5 57C10 83 46 77 45 52C44 29 11 30 5 48',
  'M4 5H46L17 71',
  'M25 36C-4 28 3 3 25 4C47 3 54 28 25 36C-7 44 0 74 25 73C50 74 57 44 25 36Z',
  'M8 68C40 82 49 46 44 19C39 -7 3 -1 4 24C5 47 38 46 44 28',
]
const root = fileURLToPath(new URL('../', import.meta.url))
const cli = join(root, 'node_modules/@tauri-apps/cli/tauri.js')
const base = readFileSync(join(root, 'src/renderer/public/calendar-icon.svg'), 'utf8')
const publicDir = join(root, 'src/renderer/public/date-icons')
const trayDir = join(root, 'src-tauri/icons/dates')
mkdirSync(publicDir, { recursive: true })
mkdirSync(trayDir, { recursive: true })
const scratch = mkdtempSync(join(tmpdir(), 'opencalendar-dates-'))
try {
  for (let day = 1; day <= 31; day++) {
    const chars = String(day).split('')
    const width = chars.length === 1 ? 50 : 116
    const paths = chars.map((n, i) => `<path transform="translate(${i * 66} 0)" d="${digits[Number(n)]}"/>`).join('')
    const mark = `<g transform="translate(${512 - width * 2} 429) scale(4)" fill="none" stroke="#292a33" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`
    const svg = base.replace(/<g fill="url\(#ink\)">[\s\S]*?<\/g>/, mark)
    const path = join(publicDir, `${day}.svg`)
    writeFileSync(path, svg)
    const result = spawnSync(process.execPath, [cli, 'icon', path, '--output', scratch, '--png', '44'], { cwd: root, encoding: 'utf8' })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(result.stderr || result.stdout)
    copyFileSync(join(scratch, '44x44.png'), join(trayDir, `${day}.png`))
  }
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
console.log('Generated 31 calendar dates for the tray and app header.')
