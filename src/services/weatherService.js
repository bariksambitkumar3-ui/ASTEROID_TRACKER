// Weather Service supporting both OpenWeatherMap (with free API key) and Open-Meteo (100% free, no key required)

// WMO weather codes -> description
const WMO_MAP = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Violent showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail',
};

export function getWeatherApiKey() {
  const envKey =
    typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_OPENWEATHER_API_KEY || import.meta.env?.VITE_WEATHER_API_KEY
      : undefined;
  if (envKey && envKey.trim()) {
    return { key: envKey.trim(), hasKey: true };
  }
  return { key: null, hasKey: false };
}

export function getDefaultCity() {
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WEATHER_DEFAULT_CITY) || 'Pune, IN';
}

/**
 * Geocode city name to lat/lon using free Open-Meteo geocoding API
 */
export async function geocodeCity(cityName, signal) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Geocoding failed with status ${res.status}`);
    const data = await res.json();
    if (!data.results || !data.results.length) {
      throw new Error(`Location "${cityName}" not found`);
    }
    const item = data.results[0];
    const nameStr = [item.name, item.admin1, item.country_code?.toUpperCase()].filter(Boolean).join(', ');
    return {
      name: nameStr,
      lat: item.latitude,
      lon: item.longitude,
    };
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error(err.message || 'Geocoding failed');
  }
}

/**
 * Fetch weather from OpenWeatherMap using API Key
 */
async function fetchFromOpenWeatherMap(loc, apiKey, signal) {
  let url = '';
  if (loc.lat != null && loc.lon != null) {
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${loc.lat}&lon=${loc.lon}&units=metric&appid=${apiKey}`;
  } else if (loc.name) {
    url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(loc.name)}&units=metric&appid=${apiKey}`;
  } else {
    throw new Error('No coordinates or city name provided');
  }

  const res = await fetch(url, { signal });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Invalid OpenWeatherMap API Key in .env. Falling back to Open-Meteo.');
    }
    throw new Error(`OpenWeatherMap returned ${res.status}`);
  }

  const data = await res.json();
  return {
    provider: 'OpenWeatherMap',
    isCustomKey: true,
    locationName: data.name ? `${data.name}, ${data.sys?.country || ''}`.trim().replace(/,\s*$/, '') : (loc.name || 'Current Location'),
    lat: data.coord?.lat ?? loc.lat,
    lon: data.coord?.lon ?? loc.lon,
    temperature: Math.round(data.main?.temp ?? 0),
    feelsLike: Math.round(data.main?.feels_like ?? data.main?.temp ?? 0),
    humidity: data.main?.humidity ?? 0,
    pressure: Math.round(data.main?.pressure ?? 1013),
    windSpeed: Math.round((data.wind?.speed ?? 0) * 3.6), // convert m/s to km/h
    precipitation: data.rain?.['1h'] || data.snow?.['1h'] || 0,
    condition: data.weather?.[0]?.description ? data.weather[0].description.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Clear',
    iconCode: data.weather?.[0]?.icon || '01d',
    fetchedAt: new Date(),
  };
}

/**
 * Fetch weather from Open-Meteo (100% Free, No Key Required)
 */
async function fetchFromOpenMeteo(loc, signal) {
  let { lat, lon, name } = loc;

  // If only name provided, resolve coordinates
  if (lat == null || lon == null) {
    const geo = await geocodeCity(name || getDefaultCity(), signal);
    lat = geo.lat;
    lon = geo.lon;
    name = geo.name;
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m` +
    `&timezone=auto`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open-Meteo returned status ${res.status}`);

  const json = await res.json();
  const current = json.current;
  if (!current) throw new Error('Current weather conditions not available');

  return {
    provider: 'Open-Meteo (Free)',
    isCustomKey: false,
    locationName: name || `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
    lat,
    lon,
    temperature: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    humidity: current.relative_humidity_2m,
    pressure: Math.round(current.surface_pressure),
    windSpeed: Math.round(current.wind_speed_10m),
    precipitation: current.precipitation || 0,
    condition: WMO_MAP[current.weather_code] || 'Clear sky',
    weatherCode: current.weather_code,
    fetchedAt: new Date(),
  };
}

/**
 * Main weather getter: checks for API key, tries OpenWeatherMap first if key exists,
 * otherwise seamlessly uses Open-Meteo.
 */
export async function getLiveWeather(location, signal) {
  const { key, hasKey } = getWeatherApiKey();
  const loc = location || { name: getDefaultCity(), lat: 18.5204, lon: 73.8567 };

  if (hasKey) {
    try {
      return await fetchFromOpenWeatherMap(loc, key, signal);
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('[ASTRA] OpenWeatherMap failed, falling back to Open-Meteo:', err.message);
      const fallback = await fetchFromOpenMeteo(loc, signal);
      fallback.note = `Note: ${err.message}`;
      return fallback;
    }
  }

  return await fetchFromOpenMeteo(loc, signal);
}
