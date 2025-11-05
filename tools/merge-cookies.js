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

// concat + normalize + dedupe
const map = new Map();
[...a, ...b].forEach((c) => {
  const cookie = {
    ...c,
    domain: normDomain(c.domain),
    path: c.path || "/",
    secure: !!c.secure,
    httpOnly: !!c.httpOnly,
    sameSite: c.sameSite || "None",
    expires: c.expires ?? null,
  };
  const key = `${cookie.name}\t${cookie.domain}\t${cookie.path}`;
  map.set(key, cookie); // last one wins
});

const merged = Array.from(map.values());
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync(out, JSON.stringify(merged, null, 2));
console.log(`✅ Wrote ${merged.length} cookies to ${out}`);

