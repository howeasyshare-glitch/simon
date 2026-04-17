const { chromium } = require("playwright");
const fs = require("fs");

const queries = [
  "white minimalist sneakers",
  "beige chino pants outfit",
  "navy polo shirt casual"
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = [];

  for (const query of queries) {
    const url = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;

    await page.goto(url);
    await page.waitForTimeout(3000);

    // 點第一個商品
    const item = await page.$("a[href*='/shopping/product/'], a[href*='udm=28']");
    if (item) {
      await item.click();
      await page.waitForTimeout(2000);

      const currentUrl = page.url();

      results.push({
        query,
        label: query,
        url: currentUrl
      });
    }
  }

  await browser.close();

  const output = {
    updatedAt: new Date().toISOString(),
    items: results
  };

  fs.writeFileSync("data/products.json", JSON.stringify(output, null, 2));

  console.log("✅ products.json updated");
})();
