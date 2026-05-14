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
 * @property {string} topicLink - relative link to the topic page e.g. "./viewtopic.php?t=..."
 * @property {string} downloadLink - relative link to download e.g. "dl.php?t=..."
 * @property {number} size - size in bytes
 * @property {number} seeders
 * @property {number} leechers
 * @property {number} downloads
 * @property {number} date - unix timestamp
 */

/**
 * Parses the tracker.php results HTML table from PornoLab.
 *
 * Real HTML structure (from live site analysis):
 * <table id="tor-tbl">
 *   <tbody>
 *     <tr class="tCenter">
 *       <td class="row1"><!-- status icon --></td>
 *       <td class="row1 tCenter"><!-- approved icon --></td>
 *       <td class="row1"><a class="gen f" href="tracker.php?f=...">Category</a></td>
 *       <td class="row4 med tLeft u">
 *         <div><a class="med tLink bold" href="./viewtopic.php?t=...">TITLE</a></div>
 *       </td>
 *       <td class="row1"><a href="tracker.php?pid=...">author</a></td>
 *       <td class="row4 small nowrap">
 *         <u>SIZE_IN_BYTES</u>
 *         <a class="small tr-dl dl-stub" href="dl.php?t=...">1.84 GB</a>
 *       </td>
 *       <td class="row4 seedmed"><u>SEEDERS</u><b class="seedmed">SEEDERS</b></td>
 *       <td class="row4 leechmed"><b>LEECHERS</b></td>
 *       <td class="row4 small">DOWNLOADS</td>
 *       <td class="row4 small"><u>0_or_1</u></td>  <!-- private flag -->
 *       <td class="row4 small nowrap" title="Добавлен">
 *         <u>UNIX_TIMESTAMP</u>
 *         <p>HH:MM</p><p>DD-Mon-YY</p>
 *       </td>
 *     </tr>
 *   </tbody>
 * </table>
 *
 * @param {string} html - the HTML content of the tracker page
 * @returns {PornolabTorrent[]}
 */
export function parseTrackerPage (html) {
  const results = []

  // Extract the tbody of tor-tbl
  const tbodyMatch = html.match(/id=["']?tor-tbl["']?[\s\S]*?<tbody[^>]*>([\s\S]*?)<\/tbody>/i)
  if (!tbodyMatch) return results

  const tbodyHtml = tbodyMatch[1]

  // Extract all rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch
  while ((rowMatch = rowRegex.exec(tbodyHtml)) !== null) {
    const rowHtml = rowMatch[0]

    // Only process rows that have a download link (tr-dl class)
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
  // Title: <a class="med tLink bold" href="./viewtopic.php?t=...">TITLE</a>
  const titleMatch = rowHtml.match(/<a[^>]*class=["'][^"']*tLink[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
    || rowHtml.match(/<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*tLink[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)

  if (!titleMatch) return null

  const topicLink = titleMatch[1]
  // Strip inner HTML tags (like <b>highlighted</b> from search) and decode entities
  const title = decodeEntities(titleMatch[2].replace(/<[^>]*>/g, '').trim())
  if (!title) return null

  // Download link: <a class="small tr-dl dl-stub" href="dl.php?t=...">
  const dlMatch = rowHtml.match(/<a[^>]*class=["'][^"']*tr-dl[^"']*["'][^>]*href=["']([^"']+)["']/i)
    || rowHtml.match(/<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*tr-dl[^"']*["']/i)
  const downloadLink = dlMatch ? dlMatch[1] : ''

  // Size in bytes: <td class="..."><u>SIZE_IN_BYTES</u><a class="tr-dl...">
  // The <u> tag BEFORE the tr-dl link contains the size in bytes
  const sizeMatch = rowHtml.match(/<td[^>]*class=["'][^"']*small nowrap[^"']*["'][^>]*>\s*<u>(\d+)<\/u>/i)
  const size = sizeMatch ? parseInt(sizeMatch[1]) || 0 : 0

  // Seeders: <td class="row4 seedmed"><u>N</u><b class="seedmed">N</b></td>
  const seedersMatch = rowHtml.match(/<td[^>]*class=["'][^"']*seedmed[^"']*["'][^>]*>[\s\S]*?<b[^>]*>(\d+)<\/b>/i)
  const seeders = seedersMatch ? parseInt(seedersMatch[1]) || 0 : 0

  // Leechers: <td class="row4 leechmed" title="Личи"><b>N</b></td>
  const leechersMatch = rowHtml.match(/<td[^>]*class=["'][^"']*leechmed[^"']*["'][^>]*>[\s\S]*?<b[^>]*>(\d+)<\/b>/i)
  const leechers = leechersMatch ? parseInt(leechersMatch[1]) || 0 : 0

  // Downloads: plain number in <td class="row4 small">N</td> (9th column, no sub-tags)
  const downloadsMatch = rowHtml.match(/<td[^>]*class=["']row4 small["'][^>]*>(\d+)<\/td>/i)
  const downloads = downloadsMatch ? parseInt(downloadsMatch[1]) || 0 : 0

  // Date unix timestamp: <td ... title="Добавлен"><u>TIMESTAMP</u>
  const dateMatch = rowHtml.match(/title=["'][^"']*[Дд]обавлен[^"']*["'][^>]*>[\s\S]*?<u>(\d+)<\/u>/i)
    || rowHtml.match(/<td[^>]*title=["'][^"']*[Дд]обавлен[^"']*["'][\s\S]*?<u>(\d+)<\/u>/i)
  const date = dateMatch ? parseInt(dateMatch[1]) || 0 : 0

  return {
    title,
    topicLink,
    downloadLink,
    size,
    seeders,
    leechers,
    downloads,
    date
  }
}
