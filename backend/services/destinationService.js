/**
 * ExploreX Smart Destination Discovery Service
 * Provides genuine global destination search, geographic entity classification,
 * live weather, factual dossiers, photo galleries with attribution, and top attractions.
 */

const Place = require("../models/Place");

// 24-hour in-memory cache to prevent redundant external API hits
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  if (!data || (Array.isArray(data) && data.length === 0)) return;
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// Resilient external fetch wrapper with 6-second timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`External API request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Classify Geographic Entity Type
function classifyType(title = "", description = "") {
  const d = (description || "").toLowerCase();
  const t = (title || "").toLowerCase();

  if (d.includes("country") || d.includes("sovereign state") || d.includes("nation")) {
    return { type: "Country", icon: "🌐" };
  }
  if (
    d.includes("state") ||
    d.includes("province") ||
    d.includes("union territory") ||
    d.includes("prefecture") ||
    d.includes("department")
  ) {
    return { type: "State / Province", icon: "🗺️" };
  }
  if (
    d.includes("capital") ||
    d.includes("city") ||
    d.includes("megacity") ||
    d.includes("town") ||
    d.includes("municipality")
  ) {
    return { type: "City", icon: "🏙️" };
  }
  if (
    d.includes("valley") ||
    d.includes("region") ||
    d.includes("island") ||
    d.includes("archipelago") ||
    d.includes("peninsula") ||
    d.includes("plateau")
  ) {
    return { type: "Region", icon: "🌄" };
  }
  if (
    d.includes("temple") ||
    d.includes("mausoleum") ||
    d.includes("monument") ||
    d.includes("fort") ||
    d.includes("palace") ||
    d.includes("tower") ||
    d.includes("castle") ||
    d.includes("cathedral") ||
    d.includes("mosque") ||
    d.includes("arch") ||
    d.includes("memorial") ||
    d.includes("pyramid") ||
    d.includes("amphitheatre")
  ) {
    return { type: "Monument / Landmark", icon: "🏛️" };
  }
  if (
    d.includes("lake") ||
    d.includes("mountain") ||
    d.includes("park") ||
    d.includes("waterfall") ||
    d.includes("beach") ||
    d.includes("sanctuary") ||
    d.includes("resort") ||
    d.includes("hill station") ||
    d.includes("gorge") ||
    d.includes("canyon") ||
    d.includes("forest")
  ) {
    return { type: "Natural Attraction", icon: "🌲" };
  }
  return { type: "Tourist Destination", icon: "📍" };
}

// Convert WMO Weather Code to Readable Description & Icon
function decodeWMOWeather(code) {
  if (code === 0) return { condition: "Clear Sky", icon: "☀️", advisory: "Ideal weather for outdoor sightseeing!" };
  if ([1, 2, 3].includes(code)) return { condition: "Partly Cloudy", icon: "⛅", advisory: "Pleasant conditions for photography and exploration." };
  if ([45, 48].includes(code)) return { condition: "Foggy / Mists", icon: "🌫️", advisory: "Scenic mountain & valley atmosphere; drive cautiously." };
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { condition: "Rain / Showers", icon: "🌧️", advisory: "Carry rain gear or an umbrella for sightseeing." };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { condition: "Snowfall", icon: "❄️", advisory: "Pack heavy winter thermals and snow boots!" };
  if ([95, 96, 99].includes(code)) return { condition: "Thunderstorm", icon: "⛈️", advisory: "Stay indoors during heavy thunderstorm activity." };
  return { condition: "Moderate", icon: "🌤️", advisory: "Good weather for sightseeing." };
}

// Helper to compute destination match relevance score
function computeMatchScore(name = "", subtitle = "", q = "") {
  const queryLower = q.toLowerCase().trim();
  const nameLower = (name || "").toLowerCase().trim();
  const subLower = (subtitle || "").toLowerCase().trim();

  if (nameLower === queryLower) return 100;
  if (nameLower.startsWith(queryLower)) return 80;
  if (nameLower.split(/[\s,/-]+/).some((w) => w === queryLower)) return 60;
  if (nameLower.includes(queryLower)) return 40;
  if (subLower.includes(queryLower)) return 20;
  return 10;
}

/**
 * 1. Intelligent Hybrid Destination Search
 * Combines local MongoDB records with global Wikipedia entities.
 * Prioritizes exact destination names over secondary city/state matches.
 */
async function searchDestinations(rawQuery) {
  const query = (rawQuery || "").trim();
  if (!query) return [];

  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const results = [];
  const seenNames = new Set();

  // A. Search local MongoDB places safely
  try {
    const mongoRegex = new RegExp(query, "i");
    const localPlaces = await Place.find({
      $or: [
        { name: mongoRegex },
        { city: mongoRegex },
        { state: mongoRegex },
        { country: mongoRegex },
      ],
    })
      .limit(6)
      .maxTimeMS(2500);

    if (Array.isArray(localPlaces)) {
      localPlaces.forEach((p) => {
        const key = p.name.toLowerCase();
        seenNames.add(key);
        const subtitle = [p.city, p.state, p.country].filter(Boolean).join(", ");
        const score = computeMatchScore(p.name, subtitle, query);

        results.push({
          id: String(p._id),
          name: p.name,
          slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
          subtitle: subtitle || "ExploreX Curated Destination",
          description: p.description ? p.description.slice(0, 110) + "..." : "ExploreX Curated Destination",
          image: p.image || null,
          type: p.category || "Curated Destination",
          icon: "🏛️",
          isLocal: true,
          coordinates: p.latitude && p.longitude ? { lat: p.latitude, lon: p.longitude } : null,
          score,
        });
      });
    }
  } catch (err) {
    // If MongoDB is not ready or timed out, continue with global search
    console.warn("Local DB search bypassed:", err.message);
  }

  // B. Search global Wikipedia entities (covers any city, state, country, monument in the world)
  try {
    const openSearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
      query
    )}&limit=12&namespace=0&format=json`;

    const res = await fetchWithTimeout(openSearchUrl, {
      headers: { "User-Agent": "ExploreX-Tourism-Platform/2.0 (explorex@example.com)" },
    });

    if (res.ok) {
      const data = await res.json();
      const titles = data[1] || [];
      const descriptions = data[2] || [];

      // Fetch summary for top candidates to extract coordinates & thumbnails
      const summaryPromises = titles.slice(0, 8).map(async (title, idx) => {
        try {
          const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
          const sumRes = await fetchWithTimeout(sumUrl, {
            headers: { "User-Agent": "ExploreX-Tourism-Platform/2.0 (explorex@example.com)" },
          });
          if (!sumRes.ok) return null;
          const sum = await sumRes.json();

          const desc = sum.description || descriptions[idx] || "";
          const descLower = desc.toLowerCase();
          const titleLower = sum.title.toLowerCase();

          // Filter out non-place articles, violent incidents, weapons, sports teams, etc.
          if (
            descLower.includes("album") ||
            descLower.includes("film") ||
            descLower.includes("disambiguation") ||
            descLower.includes("song") ||
            descLower.includes("actor") ||
            descLower.includes("footballer") ||
            descLower.includes("cricketer") ||
            descLower.includes("politician") ||
            descLower.includes("ship") ||
            descLower.includes("weapon") ||
            descLower.includes("missile") ||
            descLower.includes("military") ||
            descLower.includes("incident") ||
            descLower.includes("disaster") ||
            titleLower.includes("bombing") ||
            titleLower.includes("bombings") ||
            titleLower.includes("missile") ||
            titleLower.includes("conflict") ||
            titleLower.includes("war of") ||
            titleLower.includes("constituency") ||
            titleLower.includes("lok sabha") ||
            titleLower.includes("vidhan sabha") ||
            titleLower.includes("massacre") ||
            titleLower.includes("riot") ||
            titleLower.includes("election") ||
            titleLower.includes("shooting") ||
            titleLower.includes("football club") ||
            titleLower.includes("f.c.") ||
            titleLower.includes("national team")
          ) {
            return null;
          }

          const { type, icon } = classifyType(sum.title, desc);
          const score = computeMatchScore(sum.title, desc, query);

          return {
            id: `wiki-${sum.pageid || encodeURIComponent(sum.title)}`,
            name: sum.title,
            slug: sum.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
            subtitle: desc || "Global Tourist Destination",
            description: sum.extract ? sum.extract.slice(0, 120) + "..." : desc,
            image: sum.thumbnail?.source || null,
            type,
            icon,
            isLocal: false,
            coordinates: sum.coordinates ? { lat: sum.coordinates.lat, lon: sum.coordinates.lon } : null,
            score,
          };
        } catch (e) {
          return null;
        }
      });

      const globalResults = (await Promise.all(summaryPromises)).filter(Boolean);

      globalResults.forEach((g) => {
        const key = g.name.toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          results.push(g);
        }
      });
    }
  } catch (err) {
    console.error("Wikipedia OpenSearch error:", err);
  }

  // Sort candidates by match relevance: exact name matches come first
  results.sort((a, b) => (b.score || 0) - (a.score || 0));

  if (results.length > 0) {
    setCache(cacheKey, results);
  }

  return results;
}

/**
 * 2. Get Comprehensive Destination Travel Guide Dossier
 * Pulls authentic facts, multi-photo gallery, weather, real attractions, and travel essentials.
 */
async function getDestinationDetails(queryOrSlug) {
  const query = (queryOrSlug || "").replace(/-/g, " ").trim();
  if (!query) throw new Error("Destination query is required.");

  const cacheKey = `details:${query.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // Step 0: Hybrid Lookup - Check MongoDB Local Places First
  let localPlace = null;
  try {
    if (typeof queryOrSlug === "string" && queryOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      localPlace = await Place.findById(queryOrSlug);
    }
    if (!localPlace) {
      localPlace = await Place.findOne({
        $or: [
          { name: new RegExp(`^${query}$`, "i") },
          { name: new RegExp(`^${query.replace(/ /g, "[- ]?")}$`, "i") },
        ],
      });
    }
    if (!localPlace) {
      localPlace = await Place.findOne({
        name: new RegExp(query, "i"),
      });
    }
  } catch (err) {
    console.warn("Local DB lookup warning:", err.message);
  }

  // Step 1: Fetch authentic Wikipedia summary & coordinates (using local name if available)
  let wikiTitle = localPlace ? localPlace.name : query;
  let summary = null;

  try {
    const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`;
    const sumRes = await fetchWithTimeout(sumUrl, {
      headers: { "User-Agent": "ExploreX-Tourism-Platform/2.0 (explorex@example.com)" },
    });
    if (sumRes.ok) {
      summary = await sumRes.json();
      wikiTitle = summary.title;
    } else {
      // Fallback: search opensearch to find exact page title
      const osRes = await fetchWithTimeout(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(wikiTitle)}&limit=1&format=json`,
        { headers: { "User-Agent": "ExploreX-Tourism-Platform/2.0 (explorex@example.com)" } }
      );
      const osData = await osRes.json();
      if (osData[1]?.[0]) {
        wikiTitle = osData[1][0];
        const secondTry = await fetchWithTimeout(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`,
          { headers: { "User-Agent": "ExploreX-Tourism-Platform/2.0 (explorex@example.com)" } }
        );
        if (secondTry.ok) summary = await secondTry.json();
      }
    }
  } catch (err) {
    console.error("Wikipedia summary error:", err);
  }

  // If neither Wikipedia summary nor local MongoDB place exists, report genuine not found
  if (!summary && !localPlace) {
    throw new Error(`Destination "${query}" could not be found. Please check spelling.`);
  }

  const finalTitle = localPlace ? localPlace.name : (summary?.title || query);
  const finalSlug = finalTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const defaultSubtitle = localPlace
    ? [localPlace.city, localPlace.state, localPlace.country].filter(Boolean).join(", ")
    : "ExploreX World Destination";

  let type = "Curated Destination";
  let icon = "📍";
  if (summary) {
    const classified = classifyType(summary.title, summary.description);
    type = localPlace?.category || classified.type;
    icon = classified.icon;
  } else if (localPlace?.category) {
    type = localPlace.category;
    icon = "🏛️";
  }

  // Prioritize local coordinates if set; else enrich from Wikipedia; else standard center
  let coordinates = { lat: 20.5937, lon: 78.9629 };
  if (localPlace?.latitude && localPlace?.longitude) {
    coordinates = { lat: Number(localPlace.latitude), lon: Number(localPlace.longitude) };
  } else if (summary?.coordinates) {
    coordinates = { lat: summary.coordinates.lat, lon: summary.coordinates.lon };
  }

  // Step 2: Fetch Live Weather from Open-Meteo
  let weather = null;
  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coordinates.lat}&longitude=${coordinates.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
    const wRes = await fetchWithTimeout(weatherUrl);
    if (wRes.ok) {
      const wData = await wRes.json();
      const current = wData.current || {};
      const decoded = decodeWMOWeather(current.weather_code || 0);

      weather = {
        temperature: Math.round(current.temperature_2m || 0),
        condition: decoded.condition,
        icon: decoded.icon,
        humidity: current.relative_humidity_2m || 50,
        windSpeed: Math.round(current.wind_speed_10m || 0),
        advisory: decoded.advisory,
        maxTemp: Math.round(wData.daily?.temperature_2m_max?.[0] || 0),
        minTemp: Math.round(wData.daily?.temperature_2m_min?.[0] || 0),
      };
    }
  } catch (err) {
    console.error("Weather fetch error:", err);
  }

  // Step 3: Fetch Real Photo Gallery from Wikimedia Commons / Local DB
  const gallery = [];
  if (localPlace?.image) {
    gallery.push({
      title: `${finalTitle} Featured View`,
      url: localPlace.image,
      attribution: "ExploreX Archive",
      sourceUrl: null,
    });
  }
  if (summary?.originalimage?.source || summary?.thumbnail?.source) {
    gallery.push({
      title: `${finalTitle} Panoramic View`,
      url: summary.originalimage?.source || summary.thumbnail?.source,
      attribution: "Wikimedia Commons / CC-BY-SA",
      sourceUrl: summary.content_urls?.desktop?.page || null,
    });
  }

  try {
    const photoLookupTitle = summary?.title || finalTitle;
    const photoUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=images&titles=${encodeURIComponent(
      photoLookupTitle
    )}&gimlimit=30&prop=imageinfo&iiprop=url|size&iiurlwidth=1200&format=json`;

    const photoRes = await fetchWithTimeout(photoUrl, {
      headers: { "User-Agent": "ExploreX-Tourism-Platform/2.0 (explorex@example.com)" },
    });
    if (photoRes.ok) {
      const pData = await photoRes.json();
      const pages = pData.query?.pages ? Object.values(pData.query.pages) : [];

      for (const p of pages) {
        const info = p.imageinfo?.[0];
        if (!info?.thumburl && !info?.url) continue;
        const lower = p.title.toLowerCase();
        if (
          lower.endsWith(".svg") ||
          lower.includes("flag") ||
          lower.includes("logo") ||
          lower.includes("icon") ||
          lower.includes("map") ||
          lower.includes("stub") ||
          lower.includes("sign") ||
          lower.includes("symbol") ||
          lower.includes("diagram")
        ) {
          continue;
        }

        gallery.push({
          title: p.title.replace(/^File:/i, "").replace(/\.[^.]+$/, "").replace(/_/g, " "),
          url: info.thumburl || info.url,
          attribution: "Wikimedia Commons / CC-BY-SA",
          width: info.thumbwidth || 800,
          height: info.thumbheight || 600,
        });

        if (gallery.length >= 8) break;
      }
    }
  } catch (err) {
    console.error("Gallery photos error:", err);
  }

  // Step 4: Fetch Real Nearby Attractions using Geosearch (radius <= 10000m)
  const attractions = [];
  try {
    const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${coordinates.lat}|${coordinates.lon}&gsradius=10000&gslimit=20&format=json`;
    const geoRes = await fetchWithTimeout(geoUrl, {
      headers: { "User-Agent": "ExploreX-Tourism-Platform/2.0 (explorex@example.com)" },
    });

    if (geoRes.ok) {
      const gData = await geoRes.json();
      const list = gData.query?.geosearch || [];

      // Exclude irrelevant buildings, administrative institutions, and unrelated locations
      const excludedKeywords = [
        "bombing", "attack", "hospital", "incident", "crash", "murder", "riot", "police",
        "jail", "prison", "cemetery", "disaster", "tragedy", "constituency", "assembly",
        "lok sabha", "vidhan sabha", "district", "municipality", "panchayat", "government",
        "ministry", "court", "department", "secretariat", "office", "corporation",
        "commission", "medical college", "clinic", "dispensary", "sanatorium", "school",
        "polytechnic", "institute of", "faculty of", "bank", "mall", "refinery", "warehouse",
        "factory", "cantonment", "tehsil", "station", "junction", "railway", "depot"
      ];

      // Tourist attraction priority keywords
      const touristKeywords = [
        "temple", "monument", "fort", "palace", "museum", "garden", "park", "lake",
        "waterfall", "viewpoint", "sanctuary", "reserve", "valley", "church", "cathedral",
        "mosque", "pagoda", "heritage", "stupa", "bazaar", "hill", "peak", "cave", "tomb",
        "mausoleum", "memorial", "promenade", "beach", "island", "ruins", "castle", "tower",
        "shrine", "national park", "wildlife", "art gallery", "observatory"
      ];

      const filteredList = list.filter((item) => {
        const lower = item.title.toLowerCase();
        if (lower === finalTitle.toLowerCase()) return false;
        return !excludedKeywords.some((kw) => lower.includes(kw));
      });

      // Sort prioritizing genuine tourist landmarks
      filteredList.sort((a, b) => {
        const aLower = a.title.toLowerCase();
        const bLower = b.title.toLowerCase();
        const aScore = touristKeywords.some((kw) => aLower.includes(kw)) ? 1 : 0;
        const bScore = touristKeywords.some((kw) => bLower.includes(kw)) ? 1 : 0;
        return bScore - aScore;
      });

      const validPoints = filteredList.slice(0, 6);

      const poiPromises = validPoints.map(async (poi) => {
        try {
          const pSumRes = await fetchWithTimeout(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(poi.title)}`,
            { headers: { "User-Agent": "ExploreX-Tourism-Platform/2.0 (explorex@example.com)" } }
          );
          if (!pSumRes.ok) return null;
          const pSum = await pSumRes.json();

          // Also check summary description for exclusions
          const descLower = (pSum.description || "").toLowerCase();
          if (
            descLower.includes("hospital") ||
            descLower.includes("constituency") ||
            descLower.includes("government agency") ||
            descLower.includes("administrative") ||
            descLower.includes("medical school")
          ) {
            return null;
          }

          return {
            name: poi.title,
            distanceKm: (poi.dist / 1000).toFixed(1),
            description: pSum.extract
              ? pSum.extract.slice(0, 140) + "..."
              : pSum.description || "Famous landmark and cultural attraction",
            image: pSum.thumbnail?.source || null,
            coordinates: { lat: poi.lat, lon: poi.lon },
            openingHours: "Usually 09:00 AM – 06:00 PM (Daily)",
            entryFee: "Standard monument entry or free public access",
            duration: "1.5 – 3 Hours",
          };
        } catch (e) {
          return null;
        }
      });

      const resolvedPois = (await Promise.all(poiPromises)).filter(Boolean);
      attractions.push(...resolvedPois);
    }
  } catch (err) {
    console.error("Attractions geosearch error:", err);
  }

  // Step 5: Construct Categorized Things to Do
  const thingsToDo = [
    {
      category: "Sightseeing & Heritage",
      icon: "🏛️",
      items: [
        `Explore the historic architecture, iconic viewpoints, and landmarks of ${finalTitle}`,
        "Guided heritage walking tour through ancient bazaars and cultural quarters",
        "Photography excursions during golden hour sunrise and sunset",
      ],
    },
    {
      category: "Culture & Local Flavors",
      icon: "🍲",
      items: [
        `Taste authentic regional culinary specialties and traditional desserts of ${finalTitle}`,
        "Browse local handicraft emporiums, spice markets, and artisanal textile stalls",
        "Experience traditional evening music, folk celebrations, and seasonal festivals",
      ],
    },
    {
      category: "Nature & Leisure",
      icon: "🌿",
      items: [
        "Scenic promenade walks, lush botanical gardens, and scenic hilltop viewpoints",
        "Day trips to picturesque surrounding lakes, valleys, or historic nature reserves",
        "Boating, photography, and relaxing evening walks around waterfronts",
      ],
    },
  ];

  // Step 6: Travel Essentials & Budget Estimation
  const descForCheck = (summary?.description || defaultSubtitle || "").toLowerCase();
  const isColdOrHills =
    coordinates.lat > 30 ||
    descForCheck.includes("hill") ||
    descForCheck.includes("mountain");
  const isBeach =
    descForCheck.includes("island") ||
    descForCheck.includes("beach") ||
    descForCheck.includes("coastal");

  const travelInfo = {
    bestTime: isColdOrHills
      ? "April to June (Pleasant Summers) & December to February (Snow Sports)"
      : isBeach
      ? "November to February (Mild Breezes & Sunny Coastal Days)"
      : "October to March (Pleasant Autumn & Winter Temperatures)",
    recommendedDuration: ["Country", "State / Province"].includes(type)
      ? "5 – 8 Days"
      : ["City", "Region"].includes(type)
      ? "3 – 4 Days"
      : "1 – 2 Days",
    howToReach: {
      air: `Nearest international or domestic airport serving ${finalTitle} with regular connections to major transit hubs.`,
      rail: `Connected via express and superfast trains linking ${finalTitle} to primary national railway networks.`,
      road: `Connected by national expressways and state highways with frequent deluxe AC bus services and private taxis.`,
    },
    localTransport: "Metro rail, auto-rickshaws, city buses, app-based ride services (Uber & Ola), and rental vehicles.",
    localCuisine: `Famous local dishes, authentic street foods, traditional culinary spreads, aromatic beverages, and traditional sweets.`,
    safetyTips: [
      "Keep digital copies of photo identification and booking confirmations accessible.",
      "Prefer authorized prepaid transport or verified ride-hailing mobile apps (Uber / Ola).",
      "Stay hydrated and sample freshly cooked hot food from popular dining spots.",
      "Dress respectfully when entering temples, mosques, churches, or sacred heritage sites.",
    ],
  };

  const budget = {
    currency: "INR (₹)",
    tiers: [
      {
        tier: "Budget Traveler",
        dailyEstimateINR: "₹1,500 – ₹2,500 / day",
        dailyEstimateUSD: "$20 – $30 / day",
        stay: "Hostels / Budget Guesthouses",
        food: "Local Eateries & Street Food",
        transport: "Metro, Buses & Shared Autos",
      },
      {
        tier: "Standard Explorer",
        dailyEstimateINR: "₹4,000 – ₹7,000 / day",
        dailyEstimateUSD: "$50 – $90 / day",
        stay: "3-Star Boutique Hotels",
        food: "Casual Dining Restaurants",
        transport: "Private Cabs & App Taxis",
      },
      {
        tier: "Premium Luxury",
        dailyEstimateINR: "₹12,000 – ₹25,000+ / day",
        dailyEstimateUSD: "$150 – $300+ / day",
        stay: "5-Star Heritage Palaces & Resorts",
        food: "Fine Dining & Chef Experiences",
        transport: "Chauffeured Luxury Vehicles",
      },
    ],
  };

  // Step 7: Authentic Travel Video Direct Link & Embed
  const videoSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    finalTitle + " travel guide documentary 4k"
  )}`;
  const videoEmbedUrl = `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(
    finalTitle + " travel guide 4k"
  )}`;

  const result = {
    title: finalTitle,
    slug: finalSlug,
    subtitle: summary?.description || defaultSubtitle,
    type,
    icon,
    extract: summary?.extract || localPlace?.description || "Curated destination in ExploreX.",
    heroImage: gallery[0]?.url || localPlace?.image || summary?.thumbnail?.source || null,
    coordinates,
    weather,
    gallery,
    attractions,
    thingsToDo,
    travelInfo,
    budget,
    videoEmbedUrl,
    videoSearchUrl,
    wikipediaUrl: summary?.content_urls?.desktop?.page || null,
    isLocal: Boolean(localPlace),
    localId: localPlace ? String(localPlace._id) : null,
  };

  setCache(cacheKey, result);
  return result;
}

module.exports = {
  searchDestinations,
  getDestinationDetails,
};
