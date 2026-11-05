// Builds the GitHub release description for a CI build.
//
// Usage: PREVIOUS_TAG=<tag or empty> node scripts/release-notes.mjs <output-file>
//
// The notes combine the "Unreleased" section of CHANGELOG.md with the commits since the previous build.
// Conventional "feat:" commits go under "Co nowego", everything else under "Co zmieniono".
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const previousTag = process.env.PREVIOUS_TAG?.trim() ?? ''
const outputFile = process.argv[2] ?? 'release-notes.md'
const repoUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
  : ''

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

const FEATURE = /^feat(\([^)]*\))?!?:\s*/i
const CONVENTIONAL = /^(fix|perf|refactor|style|docs|build|ci|chore|test|revert)(\([^)]*\))?!?:\s*/i
const SKIP = /^Merge /

const readCommits = () => {
  const range = previousTag ? `${previousTag}..HEAD` : 'HEAD'
  const log = git('log', range, '--no-merges', '--pretty=format:%h%x1f%s')
  return log
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash = '', subject = ''] = line.split('\x1f')
      return { hash, subject }
    })
    .filter((c) => !SKIP.test(c.subject))
}

const unreleasedSection = () => {
  let changelog
  try {
    changelog = readFileSync('CHANGELOG.md', 'utf8')
  } catch {
    return ''
  }
  const lines = changelog.split(/\r?\n/)
  const start = lines.findIndex((line) => /^## \[?Unreleased\]?\s*$/i.test(line))
  if (start === -1) return ''
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('## '))
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
}

const bullet = ({ hash, subject }) => {
  const text = subject.replace(FEATURE, '').replace(CONVENTIONAL, '')
  const link = repoUrl ? `[${hash}](${repoUrl}/commit/${hash})` : hash
  return `- ${text.charAt(0).toUpperCase()}${text.slice(1)} (${link})`
}

const commits = readCommits()
const added = commits.filter((c) => FEATURE.test(c.subject))
const changed = commits.filter((c) => !FEATURE.test(c.subject))
const changelog = unreleasedSection()

const parts = []
parts.push('## Co nowego')
parts.push(added.length > 0 ? added.map(bullet).join('\n') : '- Bez nowych funkcji w tej paczce.')
parts.push('## Co zmieniono')
parts.push(changed.length > 0 ? changed.map(bullet).join('\n') : '- Bez innych zmian.')
if (changelog) {
  parts.push('## Z CHANGELOG')
  parts.push(changelog.replace(/^### /gm, '#### '))
}
if (previousTag && repoUrl) {
  parts.push(`Pełne porównanie: ${repoUrl}/compare/${previousTag}...${process.env.GITHUB_SHA ?? 'HEAD'}`)
}
parts.push(
  '---\nInstalator: `Subber_*_x64-setup.exe`. Do transkrypcji potrzebny jest Python 3.10+, silnik i model pobierają się przy pierwszym użyciu.\n\nW paczce jest ffmpeg na licencji GPL z [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds), tam też są jego źródła.',
)

writeFileSync(outputFile, `${parts.join('\n\n')}\n`)
console.log(`Notes: ${added.length} new, ${changed.length} changed, previous tag: ${previousTag || 'none'}`)
