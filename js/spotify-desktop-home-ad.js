// Spotify's homepage takeover and between-song ad placements.
const blockedSlots = ["hpto", "stream"];
const noAdResponse = { response: { status: 204, headers: { "Cache-Control": "no-store" } } };

function filterConfig(response) {
  if (response.status !== 200 || typeof response.body !== "string") return {};

  let config;
  try {
    config = JSON.parse(response.body);
  } catch {
    return {};
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};

  const removed = blockedSlots.filter(slot => Object.prototype.hasOwnProperty.call(config, slot));
  if (!removed.length) return {};
  for (const slot of removed) delete config[slot];
  console.log("Spotify ad config: removed " + removed.join(", "));
  return { body: JSON.stringify(config) };
}

function filterAdRequest(url) {
  const queryStart = url.indexOf("?");
  if (queryStart < 0) return {};

  const params = [];
  const removed = new Set();
  let hasOtherSlots = false;
  for (const param of url.slice(queryStart + 1).split("&")) {
    if (!param.startsWith("slots=")) {
      params.push(param);
      continue;
    }

    const value = param.slice("slots=".length);
    const slots = value.split(/,|%2c/i);
    const remaining = [];
    for (const slot of slots) {
      if (blockedSlots.includes(slot)) removed.add(slot);
      else remaining.push(slot);
    }

    const keepParam = remaining.some(Boolean);
    hasOtherSlots ||= keepParam;
    if (remaining.length === slots.length) {
      params.push(param);
    } else if (keepParam) {
      params.push("slots=" + remaining.join(value.includes(",") ? "," : "%2C"));
    }
  }

  if (!removed.size) return {};
  console.log("Spotify ad request: removed " + Array.from(removed).join(", "));
  if (hasOtherSlots) return { url: url.slice(0, queryStart + 1) + params.join("&") };
  return noAdResponse;
}

if (typeof $response !== "undefined") {
  $done($request.method === "GET" ? filterConfig($response) : {});
} else if (/\/ad-logic\/prefetch\/?$/.test($request.url.split("?", 1)[0])) {
  $done($request.method === "POST" ? noAdResponse : {});
} else if ($request.method === "POST" || $request.method === "GET") {
  $done(filterAdRequest($request.url));
} else {
  $done({});
}
