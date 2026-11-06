#!/bin/bash
export MSYS_NO_PATHCONV=1
# Lighthouse accessibility + best-practices audit of the main pages (axe-core rules run inside Lighthouse).
# Needs: a production build served at BASE (default http://localhost:3200) and Chrome. Usage: bash scripts/a11y-audit.sh [BASE] [out-dir]
BASE=${1:-http://localhost:3200}
OUT=${2:-/tmp/lh}
mkdir -p "$OUT"
export CHROME_PATH="${CHROME_PATH:-C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe}"
for page in "/" "/p/jhumka-01" "/o/1" "/verify/meera.jewels" "/dashboard" "/courier" "/arbiter" "/onboard" "/proof"; do
  name=$(echo "$page" | tr '/.' '__')
  (cd "$OUT" && timeout 150 npx --yes lighthouse@12 "$BASE$page" --only-categories=accessibility,best-practices --chrome-flags="--headless=new --no-sandbox" --output=json --output-path="$OUT/lh$name.json" --quiet >/dev/null 2>&1)
  node -e '
    const fs=require("fs");const f=process.argv[1];
    if(!fs.existsSync(f)){console.log(process.argv[2].padEnd(24),"NO RESULT");process.exit()}
    const r=JSON.parse(fs.readFileSync(f,"utf8"));
    const a=Math.round(r.categories.accessibility.score*100), b=Math.round(r.categories["best-practices"].score*100);
    const bad=Object.values(r.audits).filter(x=>x.score!==null&&x.score<1&&x.scoreDisplayMode==="binary"&&(r.categories.accessibility.auditRefs.concat(r.categories["best-practices"].auditRefs).some(y=>y.id===x.id)));
    console.log(process.argv[2].padEnd(24),"a11y",a,"best-practices",b,bad.length?"| FAIL: "+bad.map(x=>x.id).join(", "):"");
  ' "$OUT/lh$name.json" "$page"
done
