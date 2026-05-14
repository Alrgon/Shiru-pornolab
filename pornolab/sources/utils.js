/**
 * Decodes a windows-1251 encoded ArrayBuffer to a UTF-8 string.
 * PornoLab uses windows-1251 encoding.
 *
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
export function decodeWindows1251 (buffer) {
  const decoder = new TextDecoder('windows-1251')
  return decoder.decode(buffer)
}

/**
 * Converts a size string from PornoLab format to bytes.
 * PornoLab returns size in bytes as a plain number inside <u> tags,
 * but may also use human-readable formats.
 *
 * @param {string} size
 * @returns {number}
 */
export function convertSizeToBytes (size) {
  if (!size) return 0
  const trimmed = size.trim()

  // If it's a plain number (bytes), return directly
  const num = Number(trimmed)
  if (!isNaN(num)) return num

  // Handle human-readable sizes like "1.5 GB", "500 MB", etc.
  const match = trimmed.match(/^([\d.]+)\s*(TB|GB|MB|KB|B|ТБ|ГБ|МБ|КБ|Б)$/i)
  if (!match) return 0
  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  switch (unit) {
    case 'TB': case 'ТБ':
      return value * 1024 * 1024 * 1024 * 1024
    case 'GB': case 'ГБ':
      return value * 1024 * 1024 * 1024
    case 'MB': case 'МБ':
      return value * 1024 * 1024
    case 'KB': case 'КБ':
      return value * 1024
    case 'B': case 'Б':
      return value
    default:
      return 0
  }
}

/**
 * Decodes HTML entities in a string.
 *
 * @param {string} text
 * @returns {string}
 */
export function decodeEntities (text) {
  return text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/**
 * @typedef {Object} PornolabTorrent
 * @property {string} title
 * @property {string} topicLink - link to the topic page
 * @property {string} downloadLink - link to download the .torrent file
 * @property {number} size - size in bytes
 * @property {number} seeders
 * @property {number} leechers
 * @property {number} downloads
 * @property {number} date - unix timestamp
 */

/**
 * Parses the tracker.php results HTML table from PornoLab.
 * Based on Jackett selector: table#tor-tbl > tbody > tr:has(a.tr-dl)
 *
 * @param {string} html - the HTML content of the tracker page
 * @returns {PornolabTorrent[]}
 */
export function parseTrackerPage (html) {
  const results = []

  // Extract the tracker table body
  const tableMatch = html.match(/<table[^>]*id=["']?tor-tbl["']?[^>]*>([\s\S]*?)<\/table>/i)
  if (!tableMatch) return results

  const tableHtml = tableMatch[1]

  // Find tbody content
  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)
  if (!tbodyMatch) return results

  const tbodyHtml = tbodyMatch[1]

  // Extract all rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch
  while ((rowMatch = rowRegex.exec(tbodyHtml)) !== null) {
    const rowHtml = rowMatch[1]

    // Only process rows that have a download link (a.tr-dl)
    if (!rowHtml.includes('tr-dl')) continue

    const torrent = parseRow(rowHtml)
    if (torrent) results.push(torrent)
  }

  return results
}

/**
 * Parses a single table row from the tracker results.
 *
 * @param {string} rowHtml
 * @returns {PornolabTorrent|null}
 */
function parseRow (rowHtml) {
  // Extract all cells
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
  const cells = []
  let cellMatch
  while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
    cells.push(cellMatch[1])
  }

  if (cells.length < 10) return null

  // Title: a.tLink
  const titleMatch = rowHtml.match(/<a[^>]*class=["'][^"']*tLink[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)
  const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]*>/g, '').trim()) : null
  if (!title) return null

  // Topic link: a.tLink href
  const topicLinkMatch = rowHtml.match(/<a[^>]*class=["'][^"']*tLink[^"']*["'][^>]*href=["']([^"']+)["']/i)
    || rowHtml.match(/<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*tLink[^"']*["']/i)
  const topicLink = topicLinkMatch ? topicLinkMatch[1] : ''

  // Download link: a.tr-dl href
  const dlMatch = rowHtml.match(/<a[^>]*class=["'][^"']*tr-dl[^"']*["'][^>]*href=["']([^"']+)["']/i)
    || rowHtml.match(/<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*tr-dl[^"']*["']/i)
  const downloadLink = dlMatch ? dlMatch[1] : ''

  // Size: td:nth-child(6) u — stored in bytes as text inside <u> tag
  const sizeHtml = cells[5] || ''
  const sizeMatch = sizeHtml.match(/<u>([^<]+)<\/u>/i)
  const size = sizeMatch ? convertSizeToBytes(sizeMatch[1]) : 0

  // Seeders: td.seedmed > b
  const seedersMatch = rowHtml.match(/<td[^>]*class=["'][^"']*seedmed[^"']*["'][^>]*>[\s\S]*?<b>([\d]+)<\/b>/i)
  const seeders = seedersMatch ? parseInt(seedersMatch[1]) || 0 : 0

  // Leechers: td.leechmed > b
  const leechersMatch = rowHtml.match(/<td[^>]*class=["'][^"']*leechmed[^"']*["'][^>]*>[\s\S]*?<b>([\d]+)<\/b>/i)
  const leechers = leechersMatch ? parseInt(leechersMatch[1]) || 0 : 0

  // Downloads (grabs): td:nth-child(9)
  const downloadsHtml = cells[8] || ''
  const downloadsNum = parseInt(downloadsHtml.replace(/<[^>]*>/g, '').trim()) || 0

  // Date: td:nth-child(11) u — unix timestamp
  const dateHtml = cells[10] || ''
  const dateMatch = dateHtml.match(/<u>([^<]+)<\/u>/i)
  const date = dateMatch ? parseInt(dateMatch[1]) || 0 : 0

  return {
    title,
    topicLink,
    downloadLink,
    size,
    seeders,
    leechers,
    downloads: downloadsNum,
    date
  }
}
