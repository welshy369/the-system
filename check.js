/* Guards against the bug where a handler is written but its action name is
   never added to the delegation chain, so the click goes nowhere — and the
   reverse, where a branch exists for an action nothing ever renders.

   This app delegates through a single [data-act] selector and dispatches on
   the attribute's value, so the check is: every action name that appears in
   the markup must have a branch, and every branch must have markup.
   Run: node check.js */
const fs = require("fs");

const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const js = html.split("<script>")[1].split("</scr" + "ipt>")[0];

const selMatch = js.match(/e\.target\.closest\("([^"]+)"\)/);
if (!selMatch) { console.error("FAIL: no delegation selector found"); process.exit(1); }
if (!selMatch[1].split(",").map(s => s.trim()).includes("[data-act]")) {
  console.error(`FAIL: delegation selector is "${selMatch[1]}" — [data-act] is not in it, so nothing is reachable`);
  process.exit(1);
}

/* action names the markup actually emits */
const rendered = new Set();
let m, re = /data-act="([a-zA-Z]+)"/g;
while ((m = re.exec(js))) rendered.add(m[1]);

/* action names the handler branches on */
const handled = new Set();
re = /a\s*===?\s*"([a-zA-Z]+)"/g;
while ((m = re.exec(js))) handled.add(m[1]);

/* buttons carrying a hook that isn't data-act would never be delegated */
const orphans = (js.match(/<button[^>]*>/g) || []).filter(tag => {
  if (tag.includes("data-act=")) return false;
  return /\sdata-[a-z]+=/.test(tag) || /\sid="/.test(tag);
});

let fails = 0;

for (const a of rendered) {
  if (!handled.has(a)) {
    console.error(`FAIL: data-act="${a}" is rendered but no branch acts on it — the click does nothing`);
    fails++;
  }
}
for (const a of handled) {
  if (!rendered.has(a)) {
    console.error(`FAIL: branch for "${a}" exists but nothing renders that action — dead code`);
    fails++;
  }
}
for (const tag of orphans) {
  console.error(`FAIL: ${tag.slice(0, 70)}… carries a hook but no data-act, so delegation never sees it`);
  fails++;
}

/* every data-* value a branch reads back off the element must be emitted with it */
const reads = new Set();
re = /getAttribute\("data-([a-z]+)"\)/g;
while ((m = re.exec(js))) if (m[1] !== "act") reads.add("data-" + m[1]);
for (const attr of reads) {
  if (!js.includes(attr + '="')) {
    console.error(`FAIL: handler reads ${attr} but no element is rendered with it`);
    fails++;
  }
}

if (fails) {
  console.error(`\n${fails} wiring problem${fails === 1 ? "" : "s"} across ${rendered.size} actions.`);
  process.exit(1);
}
console.log(`PASS — all ${rendered.size} actions are wired end to end, and ${reads.size} payload attributes resolve.`);
