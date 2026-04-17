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
      console.log(`\n=== QUERY: ${query} ===`);

      const searchUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });

      await page.waitForTimeout(5000);

      const currentUrl = page.url();
      console.log("Loaded URL:", currentUrl);

      const pageTitle = await page.title();
      console.log("Page title:", pageTitle);

      const anchorSamples = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("a"))
          .slice(0, 30)
          .map((a) => ({
            text: (a.innerText || "").trim().slice(0, 80),
            href: a.getAttribute("href") || ""
          }));
      });

      console.log("Anchor samples:");
      console.log(JSON.stringify(anchorSamples, null, 2));

      const clicked = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));

        const candidate = anchors.find((a) => {
          const href = a.getAttribute("href") || "";
          return (
            href.includes("/shopping/product/") ||
            href.includes("udm=28") ||
            href.includes("tbm=shop")
          );
        });

        if (candidate) {
          candidate.click();
          return true;
        }

        return false;
      });

      console.log("Clicked:", clicked);

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

      const afterClickUrl = page.url();
      console.log("After click URL:", afterClickUrl);

      results.push({
        query,
        label: query,
        url: afterClickUrl,
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

  console.log("\n=== FINAL OUTPUT ===");
  console.log(JSON.stringify(output, null, 2));
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
