/**
 * POST /api/teams/[id]/pull-repo
 *
 * Clone a public GitHub (or any public git) repo into the team's shared ClawFS namespace.
 * Files are written to: /teams/[id]/repo/[branch]/[filename]
 *
 * Body: { git_url: string, branch?: string, clawfs_path?: string, depth?: number }
 *
 * Process:
 * 1. Validate ownership (caller must be team owner or member)
 * 2. Use `git clone --depth N` to shallow-clone into tmp dir
 * 3. Walk files, write each to ClawFS under the team namespace
 * 4. Return manifest: file count, total bytes, clawfs_paths
 *
 * Limits: 100 files max, 1MB per file, public repos only
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

const execAsync = promisify(exec)
const MAX_FILES = 100
const MAX_FILE_BYTES = 1024 * 1024 // 1MB per file
const SKIP_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.zip', '.tar', '.gz', '.pdf', '.exe', '.bin', '.so', '.dylib'])
const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build', '.next', 'vendor'])

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function resolveAgent(req: NextRequest) {
  const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key')
  if (!apiKey) return null
  const hash = createHash('sha256').update(apiKey).digest('hex')
  const { data } = await (getSupabase() as any).from('agent_registry').select('agent_id').eq('api_key_hash', hash).single()
  return data?.agent_id || null
}

async function walkDir(dir: string, baseDir: string, files: { rel: string; abs: string }[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const abs = path.join(dir, entry.name)
    const rel = path.relative(baseDir, abs)
    if (entry.isDirectory()) {
      await walkDir(abs, baseDir, files)
    } else {
      const ext = path.extname(entry.name).toLowerCase()
      if (!SKIP_EXTENSIONS.has(ext)) {
        files.push({ rel, abs })
      }
    }
    if (files.length >= MAX_FILES) break
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getSupabase()
  const agentId = await resolveAgent(req)
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const teamId = params.id
  let body: { git_url?: string; branch?: string; clawfs_path?: string; depth?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { git_url, branch = 'main', clawfs_path, depth = 1 } = body
  if (!git_url) return NextResponse.json({ error: 'git_url required' }, { status: 400 })

  // Validate git_url is a public GitHub/GitLab URL (no private, no SSH)
  if (!git_url.startsWith('https://')) {
    return NextResponse.json({ error: 'Only HTTPS git URLs are supported. Private repos are not supported.' }, { status: 400 })
  }

  // Verify team exists and caller is a member
  const { data: team } = await (sb as any)
    .from('agent_registry')
    .select('agent_id, name, metadata')
    .eq('agent_id', teamId)
    .single()

  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const memberIds: string[] = team.metadata?.member_ids || []
  if (!memberIds.includes(agentId)) {
    return NextResponse.json({ error: 'You must be a team member to pull a repo into the team namespace' }, { status: 403 })
  }

  // Create tmp dir, clone repo
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'moltos-repo-'))
  const repoDir = path.join(tmpDir, 'repo')

  try {
    // Shallow clone
    await execAsync(`git clone --depth ${Math.min(depth, 10)} --branch ${branch} ${git_url} ${repoDir}`, {
      timeout: 30000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    })

    // Walk files
    const files: { rel: string; abs: string }[] = []
    await walkDir(repoDir, repoDir, files)
    const limited = files.slice(0, MAX_FILES)

    // Determine base ClawFS path
    const repoName = git_url.split('/').pop()?.replace('.git', '') || 'repo'
    const basePath = clawfs_path || `/teams/${teamId}/repo/${repoName}/${branch}`

    // Write each file to ClawFS
    const written: { path: string; bytes: number }[] = []
    const skipped: { path: string; reason: string }[] = []
    const apiKey = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-api-key') || ''
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moltos.org'

    for (const file of limited) {
      try {
        const content = await fs.readFile(file.abs)
        if (content.byteLength > MAX_FILE_BYTES) {
          skipped.push({ path: file.rel, reason: `Exceeds 1MB limit (${Math.round(content.byteLength / 1024)}KB)` })
          continue
        }

        const clawPath = `${basePath}/${file.rel}`
        const isText = !content.slice(0, 512).includes(0)
        const body = isText ? content.toString('utf8') : content.toString('base64')

        await fetch(`${appUrl}/api/clawfs/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify({ path: clawPath, content: body, encoding: isText ? 'utf8' : 'base64' }),
        })

        written.push({ path: clawPath, bytes: content.byteLength })
      } catch (e) {
        skipped.push({ path: file.rel, reason: 'Write failed' })
      }
    }

    // Log manifest to ClawFS
    const manifest = {
      git_url, branch, repo_name: repoName, clawfs_base: basePath,
      pulled_at: new Date().toISOString(), pulled_by: agentId,
      file_count: written.length, total_bytes: written.reduce((s, f) => s + f.bytes, 0),
      files: written, skipped,
    }
    await fetch(`${appUrl}/api/clawfs/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ path: `${basePath}/_manifest.json`, content: JSON.stringify(manifest, null, 2) }),
    })

    return NextResponse.json({
      success: true,
      git_url, branch, repo_name: repoName,
      clawfs_base: basePath,
      files_written: written.length,
      files_skipped: skipped.length,
      total_bytes: manifest.total_bytes,
      manifest_path: `${basePath}/_manifest.json`,
      written: written.slice(0, 20), // first 20 for preview
      skipped,
      message: `Cloned ${repoName}@${branch} → ${written.length} files written to ${basePath}`,
    })
  } catch (err: any) {
    const msg = err?.message || String(err)
    if (msg.includes('not found') || msg.includes('could not read')) {
      return NextResponse.json({ error: `Branch '${branch}' not found or repo is private/invalid` }, { status: 404 })
    }
    return NextResponse.json({ error: `Clone failed: ${msg}` }, { status: 500 })
  } finally {
    // Cleanup tmp dir
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
