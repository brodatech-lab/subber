// Builds the GitHub release description for a version from its CHANGELOG.md section.
//
// Usage: VERSION=0.2.0 node scripts/release-notes.mjs <output-file>
//
// The section is already written in Polish and English ("Co nowego", "Co zmieniono", "What's new",
// "What changed"), so the notes are that section plus a short install note in both languages.
// Fails when the section is missing, so a version never ships without a description.
import { readFileSync, writeFileSync } from 'node:fs'

const version = process.env.VERSION?.trim().replace(/^v/, '')
const outputFile = process.argv[2] ?? 'release-notes.md'

if (!version) {
  console.error('Set VERSION, for example VERSION=0.2.0')
  process.exit(1)
}

const versionSection = (changelog, wanted) => {
  const lines = changelog.split(/\r?\n/)
  const start = lines.findIndex((line) => new RegExp(`^## \\[?${wanted.replace(/\./g, '\\.')}\\]?(\\s|$)`).test(line))
  if (start === -1) return ''
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('## '))
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
}

const section = versionSection(readFileSync('CHANGELOG.md', 'utf8'), version)
if (!section) {
  console.error(`CHANGELOG.md has no "## ${version}" section. Move the Unreleased changes under it first.`)
  process.exit(1)
}

const footer = [
  '---',
  'Instalator: `Subber_*_x64-setup.exe`, z ffmpeg w środku. Do transkrypcji potrzebny jest Python 3.10+, silnik i model pobierają się przy pierwszym użyciu do wybranego folderu.',
  '',
  'Installer: `Subber_*_x64-setup.exe`, ffmpeg included. Transcription needs Python 3.10+; the engine and model download on first use into the folder you pick.',
  '',
  'ffmpeg (GPL): [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds).',
].join('\n')

writeFileSync(outputFile, `${section.replace(/^### /gm, '## ')}\n\n${footer}\n`)
console.log(`Release notes for ${version} written to ${outputFile}`)
