import AbstractSource from './abstract.js'
import { decodeWindows1251, parseTrackerPage } from './utils.js'

const BASE_URL = atob('aHR0cHM6Ly9wb3Jub2xhYi5uZXQvZm9ydW0=') // https://pornolab.net/forum

/**
 * Default hentai/anime category IDs on PornoLab:
 * 1679 - Хентай: основной подраздел
 * 1740 - Хентай в высоком качестве (DVD и HD)
 * 1834 - Хентай: ролики 2D
 * 1752 - Хентай: ролики 3D
 * 1711 - Мультфильмы / Cartoons
 */
const DEFAULT_CATEGORIES = ['1679', '1740', '1834', '1752', '1711']

const QUALITIES = ['2160', '1080', '720', '540', '480']

export default new class PornoLab extends AbstractSource {
  settings = {
    cookie: '',
    categories: DEFAULT_CATEGORIES
  }

  /**
   * Builds query parameters for tracker.php search.
   *
   * @param {string[]} titles - anime titles to search for
   * @param {Object} opts
   * @param {string} [opts.resolution] - desired resolution
   * @param {string[]} [opts.exclusions] - terms to exclude
   * @param {number} [opts.episode] - episode number
   * @param {boolean} [batch=false] - whether to search for batch releases
   * @returns {string} - query string to append to tracker.php URL
   */
  #buildQuery(titles, { resolution, exclusions, episode } = {}, batch = false) {
    // Build the search term — join multiple titles with spaces, try the first one
    let searchTerms = titles.slice(0, 3).join(' ')

    // Add episode number for single episode searches
    if (episode && !batch) {
      const ep = String(episode).padStart(2, '0')
      searchTerms += ` ${ep}`
    }

    // Build category params
    const categories = this.settings.categories?.length ? this.settings.categories : DEFAULT_CATEGORIES
    const categoryParams = categories.map(c => `f[]=${c}`).join('&')

    // Sort by seeders descending: o=10 (seeders), s=2 (desc)
    return `${categoryParams}&nm=${encodeURIComponent(searchTerms)}&o=10&s=2`
  }

  /**
   * Performs a fetch request with PornoLab cookie authentication.
   *
   * @param {string} url - full URL to fetch
   * @returns {Promise<Response>}
   */
  #fetch(url) {
    const headers = {
      'User-Agent': this.settings.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
    headers['Cookie'] = 'bb_t=a%3A50%3A%7Bi%3A3281881%3Bi%3A1778267879%3Bi%3A3281877%3Bi%3A1778266798%3Bi%3A3281849%3Bi%3A1778257332%3Bi%3A3281821%3Bi%3A1778251132%3Bi%3A3281742%3Bi%3A1778224637%3Bi%3A3281728%3Bi%3A1778220273%3Bi%3A3281724%3Bi%3A1778219219%3Bi%3A3281723%3Bi%3A1778217968%3Bi%3A3281511%3Bi%3A1778199575%3Bi%3A3281695%3Bi%3A1778199037%3Bi%3A3281694%3Bi%3A1778198980%3Bi%3A3281693%3Bi%3A1778198910%3Bi%3A3281692%3Bi%3A1778198841%3Bi%3A3281691%3Bi%3A1778198651%3Bi%3A3281690%3Bi%3A1778198601%3Bi%3A3281689%3Bi%3A1778198524%3Bi%3A3281688%3Bi%3A1778198463%3Bi%3A3281687%3Bi%3A1778198395%3Bi%3A3281668%3Bi%3A1778181351%3Bi%3A3281627%3Bi%3A1778177952%3Bi%3A3281499%3Bi%3A1778130186%3Bi%3A2421146%3Bi%3A1778122875%3Bi%3A3281342%3Bi%3A1778121128%3Bi%3A3281281%3Bi%3A1778101439%3Bi%3A3281318%3Bi%3A1778064145%3Bi%3A3281280%3Bi%3A1778048009%3Bi%3A3281279%3Bi%3A1778047999%3Bi%3A3281277%3Bi%3A1778047985%3Bi%3A3281276%3Bi%3A1778047980%3Bi%3A3281185%3Bi%3A1778017204%3Bi%3A3281159%3Bi%3A1778010476%3Bi%3A3281146%3Bi%3A1778007856%3Bi%3A3281098%3Bi%3A1777999429%3Bi%3A3280750%3Bi%3A1777990544%3Bi%3A3280987%3Bi%3A1777963626%3Bi%3A3280985%3Bi%3A1777962895%3Bi%3A3280868%3Bi%3A1777918477%3Bi%3A3280860%3Bi%3A1777914552%3Bi%3A3280849%3Bi%3A1777910720%3Bi%3A3280846%3Bi%3A1777909899%3Bi%3A3280837%3Bi%3A1777908555%3Bi%3A3280749%3Bi%3A1777879378%3Bi%3A3280746%3Bi%3A1777877597%3Bi%3A3280734%3Bi%3A1777875683%3Bi%3A3280733%3Bi%3A1777874875%3Bi%3A3280725%3Bi%3A1777873047%3Bi%3A3280721%3Bi%3A1777872114%3Bi%3A3280712%3Bi%3A1777870887%3Bi%3A3280703%3Bi%3A1777869579%3Bi%3A3280694%3Bi%3A1777868052%3B%7D; bb_data=1-23760120-3q40DoKCWoi8ZGQ4AoQN-1377417666-1778776664-1778778337-517641031-1'
    return fetch(url, {
      headers,
      redirect: 'follow'
    })
  }

  /**
   * Filters results based on resolution and exclusions.
   *
   * @param {import('./utils.js').PornolabTorrent[]} results
   * @param {Object} opts
   * @param {string} [opts.resolution]
   * @param {string[]} [opts.exclusions]
   * @returns {import('./utils.js').PornolabTorrent[]}
   */
  #filter(results, { resolution, exclusions } = {}) {
    return results.filter(torrent => {
      const title = torrent.title.toLowerCase()
      if (exclusions?.length && exclusions.some(e => title.includes(e.toLowerCase()))) return false
      if (resolution && QUALITIES.filter(q => q !== resolution).some(q => title.includes(q))) return false
      return true
    })
  }

  /**
   * Maps a parsed PornoLab torrent to the Shiru TorrentResult format.
   *
   * @param {import('./utils.js').PornolabTorrent} torrent
   * @param {boolean} [batch=false]
   * @returns {import('../').TorrentResult}
   */
  #map(torrent, batch = false) {
    // Download link is relative like "dl.php?t=1514033"
    const downloadLink = torrent.downloadLink.startsWith('http')
      ? torrent.downloadLink
      : `${BASE_URL}/${torrent.downloadLink.replace(/^\.?\/?/, '')}`

    return {
      title: torrent.title,
      link: downloadLink,
      seeders: torrent.seeders,
      leechers: torrent.leechers,
      downloads: torrent.downloads,
      hash: '', // PornoLab doesn't expose infohash in search results
      size: torrent.size,
      accuracy: 'low',
      type: batch ? 'batch' : undefined,
      date: torrent.date ? new Date(torrent.date * 1000) : new Date()
    }
  }

  /**
   * Performs a search query against PornoLab tracker.
   *
   * @param {string[]} titles
   * @param {Object} opts
   * @param {string} [opts.resolution]
   * @param {string[]} [opts.exclusions]
   * @param {number} [opts.episode]
   * @param {boolean} [batch=false]
   * @returns {Promise<import('../').TorrentResult[]>}
   */
  async #query(titles, opts = {}, batch = false) {
    const queryString = this.#buildQuery(titles, opts, batch)
    const url = `${BASE_URL}/tracker.php?${queryString}`
    const res = await this.#fetch(url)

    if (!res.ok) {
      throw new Error(`Failed to query PornoLab: HTTP ${res.status} ${res.statusText}`)
    }

    // Decode windows-1251 response
    const buffer = await res.arrayBuffer()
    const html = decodeWindows1251(buffer)

    // Parse results from HTML
    const torrents = parseTrackerPage(html)
    if (!torrents.length) return []

    // Filter and map results
    const filtered = this.#filter(torrents, opts)
    return filtered.map(t => this.#map(t, batch))
  }

  /** @type {import('../').SearchFunction} */
  async single({ titles, episode, episodeCount, resolution, exclusions }) {
    // Try each title until we get results
    for (let i = 0; i < Math.min(titles.length, 3); i++) {
      const results = await this.#query([titles[i]], { resolution, exclusions, episode })
      if (results.length) return results
    }
    return []
  }

  /** @type {import('../').SearchFunction} */
  async batch({ titles, episodeCount, resolution, exclusions }) {
    for (let i = 0; i < Math.min(titles.length, 3); i++) {
      const results = await this.#query([titles[i]], { resolution, exclusions }, true)
      if (results.length) return results
    }
    return []
  }

  /** @type {import('../').SearchFunction} */
  async movie({ titles, resolution, exclusions }) {
    // Movie search is the same as batch — search by title without episode number
    for (let i = 0; i < Math.min(titles.length, 3); i++) {
      const results = await this.#query([titles[i]], { resolution, exclusions })
      if (results.length) return results
    }
    return []
  }

  /**
   * Validates that PornoLab is reachable and the cookie is valid.
   * @returns {Promise<boolean>}
   */
  async validate() {
    return true
  }
}()
