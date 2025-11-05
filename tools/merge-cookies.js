import fs from "fs";

const inA = process.argv[2] || "data/cookies_firefly.json";
const inB = process.argv[3] || "data/cookies_auth.json";
const out = "data/cookies.adobe.json";

function read(path) {
  try {
    const content = fs.readFileSync(path, "utf8").trim();
    if (!content) {
      console.warn(`⚠️  File ${path} is empty, using empty array`);
      return [];
    }
    return JSON.parse(content);
  } catch (e) {
    console.error(`❌ Error reading ${path}: ${e.message}`);
    throw e;
  }
}
function normDomain(d) {
  if (!d) return "";
  return d.startsWith(".") ? d : "." + d;
}

const a = read(inA);
const b = read(inB);

// Set future expiry for cookies (1 year from now) if they're null or expired
const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
const oneYearFromNow = now + (365 * 24 * 60 * 60);

// concat + normalize + dedupe
const map = new Map();
[...a, ...b].forEach((c) => {
  let expires = c.expires ?? null;
  
  // If expires is null (session cookie) or expired, set to 1 year from now
  // This helps with authentication - browsers will accept cookies with future expiry dates
  if (expires === null || expires === undefined) {
    // Keep session cookies as null - they're meant to expire when browser closes
    // But we could set a future date if needed for automation
    // expires = oneYearFromNow;
  } else if (expires < now) {
    // Update expired cookies to future date
    expires = oneYearFromNow;
  }
  
  const cookie = {
    ...c,
    domain: normDomain(c.domain),
    path: c.path || "/",
    secure: !!c.secure,
    httpOnly: !!c.httpOnly,
    sameSite: c.sameSite || "None",
    expires: expires,
  };
  const key = `${cookie.name}\t${cookie.domain}\t${cookie.path}`;
  map.set(key, cookie); // last one wins
});

const merged = Array.from(map.values());
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync(out, JSON.stringify(merged, null, 2));
console.log(`✅ Wrote ${merged.length} cookies to ${out}`);
console.log(`   - Session cookies (null expires): ${merged.filter(c => c.expires === null).length}`);
console.log(`   - Cookies with expiry dates: ${merged.filter(c => c.expires !== null).length}`);

