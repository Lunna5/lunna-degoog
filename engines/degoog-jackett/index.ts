export const type = ["torrent", "file"]

export interface JackettConfig {
  baseUrl?: string
  apiKey?: string
  indexer?: string
  categories?: string
}

let config: JackettConfig = {
  baseUrl: "http://localhost:9117",
  apiKey: "",
  indexer: "all",
  categories: "",
}

function formatBytes(bytes: number | null | undefined, decimals = 2): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return "0 B"
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const formatted = parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
  return `${formatted} ${sizes[i] || "B"}`
}

function matchesTimeFilter(
  publishDateStr: string | undefined | null,
  timeFilter?: string,
  dateFrom?: string,
  dateTo?: string
): boolean {
  if (!timeFilter && !dateFrom && !dateTo) return true
  if (!publishDateStr) return true

  const itemDate = new Date(publishDateStr)
  if (isNaN(itemDate.getTime())) return true

  const now = Date.now()

  if (timeFilter) {
    const tf = timeFilter.toLowerCase()
    let maxAgeMs = 0
    if (tf === "d" || tf === "day" || tf === "24h") {
      maxAgeMs = 24 * 60 * 60 * 1000
    } else if (tf === "w" || tf === "week" || tf === "7d") {
      maxAgeMs = 7 * 24 * 60 * 60 * 1000
    } else if (tf === "m" || tf === "month" || tf === "30d") {
      maxAgeMs = 30 * 24 * 60 * 60 * 1000
    } else if (tf === "y" || tf === "year" || tf === "365d") {
      maxAgeMs = 365 * 24 * 60 * 60 * 1000
    }

    if (maxAgeMs > 0 && now - itemDate.getTime() > maxAgeMs) {
      return false
    }
  }

  if (dateFrom) {
    const from = new Date(dateFrom)
    if (!isNaN(from.getTime()) && itemDate < from) {
      return false
    }
  }

  if (dateTo) {
    const to = new Date(dateTo)
    if (!isNaN(to.getTime()) && itemDate > to) {
      return false
    }
  }

  return true
}

export interface JackettItem {
  FirstSeen?: string
  Tracker?: string
  TrackerId?: string
  TrackerType?: string
  CategoryDesc?: string
  BlackholeLink?: string | null
  Title?: string
  Guid?: string
  Link?: string | null
  Details?: string | null
  PublishDate?: string
  Category?: number[]
  Size?: number
  Files?: number | null
  Grabs?: number | null
  Description?: string | null
  RageID?: number
  TVDBId?: number
  Imdb?: number
  TMDb?: number
  Seeders?: number
  Peers?: number
  Poster?: string | null
  InfoHash?: string | null
  MagnetUri?: string | null
  MinimumRatio?: number
  MinimumSeedTime?: number
  DownloadVolumeFactor?: number
  UploadVolumeFactor?: number
  Gain?: number
}

export interface DegoogTorrentResult {
  title: string
  url: string
  snippet: string
  source: string
  thumbnail?: string
  seeders?: number
  seeds?: number
  leechers?: number
  peers?: number
  size?: string
  sizeBytes?: number
  magnet?: string
  magnetUri?: string
  magnetUrl?: string
  downloadUrl?: string
  torrentUrl?: string
  link?: string
  detailsUrl?: string
  tracker?: string
  trackerId?: string
  category?: string
  publishDate?: string
  date?: string
  files?: number
  grabs?: number
  infoHash?: string
}

export const engine = {
  name: "degoog-jackett",
  bangShortcut: "jackett",

  settingsSchema: [
    {
      key: "baseUrl",
      label: "Jackett Base URL",
      type: "text",
      required: true,
      default: "http://localhost:9117",
      description: "URL of your Jackett server (e.g. http://localhost:9117)",
    },
    {
      key: "apiKey",
      label: "Jackett API Key",
      type: "password",
      required: true,
      description: "API Key located in the top-right of your Jackett dashboard",
    },
    {
      key: "indexer",
      label: "Indexer",
      type: "text",
      required: false,
      default: "all",
      description: "Specific indexer ID or 'all' for all configured indexers",
    },
    {
      key: "categories",
      label: "Categories (IDs)",
      type: "text",
      required: false,
      default: "",
      description: "Comma-separated Torznab category IDs (e.g. 2000,5000) or leave blank",
    },
  ],

  configure(settings?: Partial<JackettConfig>) {
    if (!settings) return
    if (settings.baseUrl !== undefined) {
      config.baseUrl = settings.baseUrl.trim().replace(/\/+$/, "")
    }
    if (settings.apiKey !== undefined) {
      config.apiKey = settings.apiKey.trim()
    }
    if (settings.indexer !== undefined) {
      config.indexer = settings.indexer.trim() || "all"
    }
    if (settings.categories !== undefined) {
      config.categories = settings.categories.trim()
    }
  },

  async executeSearch(
    query: string,
    page = 1,
    timeFilter?: string,
    context?: {
      lang?: string
      fetch?: typeof fetch
      signProxyUrl?: (url: string) => string
      buildAcceptLanguage?: () => string
      dateFrom?: string
      dateTo?: string
      imageFilter?: Record<string, string>
      settings?: Partial<JackettConfig>
      sentinel?: (
        response: { ok: boolean; status: number },
        engineName?: string
      ) => void
      engineError?: (
        status: string,
        message: string,
        opts?: { httpStatus?: number; engine?: string }
      ) => Error
    }
  ): Promise<DegoogTorrentResult[]> {
    const activeBaseUrl = (
      context?.settings?.baseUrl ||
      config.baseUrl ||
      "http://localhost:9117"
    )
      .trim()
      .replace(/\/+$/, "")

    const activeApiKey = (
      context?.settings?.apiKey ||
      config.apiKey ||
      ""
    ).trim()
    const activeIndexer = (
      context?.settings?.indexer ||
      config.indexer ||
      "all"
    ).trim()
    const activeCategories = (
      context?.settings?.categories ??
      config.categories ??
      ""
    ).trim()

    if (!activeApiKey) {
      if (context?.engineError) {
        throw context.engineError(
          "CONFIG_ERROR",
          "Jackett API key is not configured. Please enter your API key in settings.",
          { engine: "degoog-jackett" }
        )
      }
      console.warn(
        "[degoog-jackett] API key is missing. Please configure it in settings."
      )
      return []
    }

    try {
      const doFetch = context?.fetch ?? fetch

      const searchUrl = new URL(
        `${activeBaseUrl}/api/v2.0/indexers/${encodeURIComponent(activeIndexer)}/results`
      )
      searchUrl.searchParams.set("apikey", activeApiKey)
      searchUrl.searchParams.set("Query", query)

      if (activeCategories) {
        const catList = activeCategories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
        for (const cat of catList) {
          searchUrl.searchParams.append("Category[]", cat)
        }
      }

      // Pagination parameters for Jackett Torznab API
      const pageSize = 30
      const offset = Math.max(0, (page - 1) * pageSize)
      searchUrl.searchParams.set("offset", String(offset))
      searchUrl.searchParams.set("limit", String(pageSize))

      const headers: Record<string, string> = {
        Accept: "application/json, text/plain, */*",
      }
      if (context?.buildAcceptLanguage) {
        headers["Accept-Language"] = context.buildAcceptLanguage()
      }

      const response = await doFetch(searchUrl.toString(), { headers })

      context?.sentinel?.(response, "degoog-jackett")

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          if (context?.engineError) {
            throw context.engineError(
              "AUTH_ERROR",
              "Invalid Jackett API key or unauthorized request.",
              { httpStatus: response.status, engine: "degoog-jackett" }
            )
          }
          return []
        }

        if (context?.engineError) {
          throw context.engineError(
            "HTTP_ERROR",
            `Jackett returned HTTP status ${response.status}`,
            { httpStatus: response.status, engine: "degoog-jackett" }
          )
        }
        return []
      }

      const data = await response.json()

      if (data?.error || data?.Error) {
        const errMsg = String(data.error || data.Error)
        if (context?.engineError) {
          throw context.engineError("JACKETT_ERROR", errMsg, {
            engine: "degoog-jackett",
          })
        }
        console.warn(`[degoog-jackett] ${errMsg}`)
        return []
      }

      const rawItems: JackettItem[] = Array.isArray(data?.Results)
        ? data.Results
        : Array.isArray(data)
        ? data
        : []

      const results: DegoogTorrentResult[] = []

      for (const item of rawItems) {
        if (!item || !item.Title) continue

        // Check date/time filter if requested
        if (
          !matchesTimeFilter(
            item.PublishDate,
            timeFilter,
            context?.dateFrom,
            context?.dateTo
          )
        ) {
          continue
        }

        // Format metadata snippet
        const metaParts: string[] = []
        if (item.Size !== undefined && item.Size !== null) {
          metaParts.push(`💾 ${formatBytes(item.Size)}`)
        }
        if (item.Seeders !== undefined && item.Seeders !== null) {
          metaParts.push(`🟢 Seeds: ${item.Seeders}`)
        }
        if (item.Peers !== undefined && item.Peers !== null) {
          metaParts.push(`🔴 Peers: ${item.Peers}`)
        }
        if (item.CategoryDesc) {
          metaParts.push(`🏷️ ${item.CategoryDesc}`)
        }
        if (item.Tracker) {
          metaParts.push(`🌐 Tracker: ${item.Tracker}`)
        }
        if (item.PublishDate) {
          try {
            const d = new Date(item.PublishDate)
            if (!isNaN(d.getTime())) {
              metaParts.push(`📅 ${d.toLocaleDateString()}`)
            }
          } catch {}
        }

        const metaLine = metaParts.join(" | ")
        const desc = item.Description ? item.Description.trim() : ""
        const snippet = metaLine
          ? desc
            ? `${metaLine}\n${desc}`
            : metaLine
          : desc || item.Title

        // Thumbnail / Poster URL signing
        let thumbnail: string | undefined = undefined
        if (
          item.Poster &&
          typeof item.Poster === "string" &&
          item.Poster.startsWith("http")
        ) {
          thumbnail = context?.signProxyUrl
            ? context.signProxyUrl(item.Poster)
            : item.Poster
        }

        // Determine destination link
        const targetUrl =
          item.Details ||
          item.MagnetUri ||
          item.Link ||
          item.Guid ||
          activeBaseUrl

        results.push({
          title: item.Title,
          url: targetUrl,
          snippet,
          source: item.Tracker ? `Jackett (${item.Tracker})` : "Jackett",
          thumbnail,

          // Torrent-specific properties
          seeders: item.Seeders ?? 0,
          seeds: item.Seeders ?? 0,
          leechers: item.Peers ?? 0,
          peers: item.Peers ?? 0,
          size: item.Size !== undefined ? formatBytes(item.Size) : undefined,
          sizeBytes: item.Size ?? 0,
          magnet: item.MagnetUri || undefined,
          magnetUri: item.MagnetUri || undefined,
          magnetUrl: item.MagnetUri || undefined,
          downloadUrl: item.Link || undefined,
          torrentUrl: item.Link || undefined,
          link: item.Link || undefined,
          detailsUrl: item.Details || undefined,
          tracker: item.Tracker || undefined,
          trackerId: item.TrackerId || undefined,
          category: item.CategoryDesc || undefined,
          publishDate: item.PublishDate || undefined,
          date: item.PublishDate || undefined,
          files: item.Files ?? undefined,
          grabs: item.Grabs ?? undefined,
          infoHash: item.InfoHash || undefined,
        })
      }

      return results
    } catch (e: any) {
      if (e?.name === "SentinelBreach") throw e
      if (e?.name === "EngineError" || e?.isEngineError) throw e
      console.error("[degoog-jackett] Search failed:", e)
      return []
    }
  },
}
