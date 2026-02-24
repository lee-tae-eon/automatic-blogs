import fs from "fs";
import { markdownToHtml } from "./packages/core/src/util/markdownToHtml";

async function run() {
  const md = fs.readFileSync("apps/cli/output/test_manual_chart.md", "utf-8");
  const html = await markdownToHtml(md);
  console.log("HTML Output:");
  console.log(html);
}
run();
