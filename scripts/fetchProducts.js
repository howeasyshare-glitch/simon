const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const queries = [
  "white minimalist sneakers",
  "beige chino pants outfit",
  "navy polo shirt casual"
];

async function run() {
  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage({
    locale: "zh-TW"
  });

  const results = [];

  for (const query of queries) {
    try {
      console.log(`Running query: ${query}`);

      const searchUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });

      await page.waitForTimeout(5000);

      const currentBeforeClick = page.url();
      console.log(`Loaded URL: ${currentBeforeClick}`);

      const clicked = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));
        const candidate = anchors.find((a) => {
          const href = a.getAttribute("href") || "";
          return href.includes("/shopping/product/") || href.includes("udm=28");
        });

        if (candidate) {
          candidate.click();
          return true;
        }

        return false;
      });

      console.log(`Clicked result: ${clicked}`);

      if (!clicked) {
        results.push({
          query,
          label: query,
          url: "",
          status: "no-product-found"
        });
        continue;
      }

      await page.waitForTimeout(4000);

      const currentUrl = page.url();
      console.log(`After click URL: ${currentUrl}`);

      results.push({
        query,
        label: query,
        url: currentUrl,
        status: "ok"
      });
    } catch (error) {
      console.error(`Error on query "${query}":`, error);

      results.push({
        query,
        label: query,
        url: "",
        status: "error",
        error: String(error.message || error)
      });
    }
  }

  await browser.close();

  const output = {
    updatedAt: new Date().toISOString(),
    items: results
  };

  const outPath = path.join(process.cwd(), "data", "products.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

  console.log("products.json updated");
  console.log(JSON.stringify(output, null, 2));
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
