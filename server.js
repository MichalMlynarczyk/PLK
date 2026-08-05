import { createReadStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const distDir = join(rootDir, 'dist')
const dataDir = process.env.DATA_DIR ?? join(rootDir, 'data')
const uploadsDir = join(dataDir, 'uploads')
const databasePath = join(dataDir, 'database.json')
const port = Number(process.env.PORT ?? 5173)

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

async function ensureDatabase() {
  await mkdir(uploadsDir, { recursive: true })

  try {
    await readFile(databasePath, 'utf8')
  } catch {
    await writeDatabase({ files: [], notes: [] })
  }
}

async function readDatabase() {
  await ensureDatabase()
  return JSON.parse(await readFile(databasePath, 'utf8'))
}

async function writeDatabase(database) {
  await mkdir(dataDir, { recursive: true })
  await writeFile(databasePath, JSON.stringify(database, null, 2))
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(payload))
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk

      if (body.length > 80 * 1024 * 1024) {
        reject(new Error('Payload too large'))
        request.destroy()
      }
    })
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function fileToResponse(file) {
  return {
    id: file.id,
    name: file.name,
    originalName: file.originalName,
    scheme: file.scheme,
    size: file.size,
    type: file.type,
    url: `/api/files/${file.id}/content`,
  }
}

async function handleApi(request, response, url) {
  const database = await readDatabase()

  if (request.method === 'GET' && url.pathname === '/api/files') {
    sendJson(response, 200, database.files.map(fileToResponse))
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/files') {
    const payload = await readJsonBody(request)
    const id = crypto.randomUUID()
    const extension = payload.type === 'application/pdf' ? '.pdf' : extname(payload.originalName ?? '')
    const storedName = `${id}${extension}`
    const filePath = join(uploadsDir, storedName)
    const buffer = Buffer.from(payload.data, 'base64')
    const file = {
      id,
      name: payload.name,
      originalName: payload.originalName,
      scheme: payload.scheme,
      size: payload.size,
      storedName,
      type: payload.type,
      createdAt: Date.now(),
    }

    await writeFile(filePath, buffer)
    database.files.push(file)
    await writeDatabase(database)
    sendJson(response, 201, fileToResponse(file))
    return
  }

  const fileContentMatch = url.pathname.match(/^\/api\/files\/([^/]+)\/content$/)

  if (request.method === 'GET' && fileContentMatch) {
    const file = database.files.find((item) => item.id === fileContentMatch[1])

    if (!file) {
      sendJson(response, 404, { error: 'File not found' })
      return
    }

    response.writeHead(200, {
      'Content-Type': file.type,
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.originalName ?? file.name)}"`,
    })
    createReadStream(join(uploadsDir, file.storedName)).pipe(response)
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/notes') {
    sendJson(response, 200, database.notes.toSorted((first, second) => second.createdAt - first.createdAt))
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/notes') {
    const payload = await readJsonBody(request)
    const note = {
      id: crypto.randomUUID(),
      crossedOut: false,
      createdAt: Date.now(),
      text: payload.text,
    }

    database.notes.push(note)
    await writeDatabase(database)
    sendJson(response, 201, note)
    return
  }

  const noteMatch = url.pathname.match(/^\/api\/notes\/([^/]+)$/)

  if (request.method === 'PATCH' && noteMatch) {
    const payload = await readJsonBody(request)
    const note = database.notes.find((item) => item.id === noteMatch[1])

    if (!note) {
      sendJson(response, 404, { error: 'Note not found' })
      return
    }

    Object.assign(note, payload)
    await writeDatabase(database)
    sendJson(response, 200, note)
    return
  }

  sendJson(response, 404, { error: 'Not found' })
}

function serveStatic(request, response, url) {
  const requestPath = url.pathname === '/' ? '/index.html' : url.pathname
  const filePath = normalize(join(distDir, requestPath))

  if (!filePath.startsWith(distDir)) {
    response.writeHead(403)
    response.end()
    return
  }

  const stream = createReadStream(filePath)

  stream.on('error', () => {
    createReadStream(join(distDir, 'index.html')).pipe(response)
  })
  response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream' })
  stream.pipe(response)
}

await ensureDatabase()

createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`)

  if (url.pathname.startsWith('/api/')) {
    handleApi(request, response, url).catch((error) => {
      sendJson(response, 500, { error: error.message })
    })
    return
  }

  serveStatic(request, response, url)
}).listen(port, '0.0.0.0', () => {
  console.log(`PLK server listening on http://0.0.0.0:${port}`)
})
