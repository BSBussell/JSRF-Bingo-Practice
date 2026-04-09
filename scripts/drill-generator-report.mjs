import { sampleDrillGeneration, formatCountsTable } from "../src/lib/drill/drillSampler.js";

function readArgument(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) {
    return fallback;
  }

  return process.argv[index + 1];
}

function parseJsonArgument(flag, fallback) {
  const value = readArgument(flag);
  if (!value) {
    return fallback;
  }

  return JSON.parse(value);
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function printTable(title, counts, total) {
  console.log(`\n${title}`);
  console.log("key\tcount\tpercent");

  for (const row of formatCountsTable(counts, total)) {
    console.log(`${row.key}\t${row.count}\t${formatPercent(row.percent)}`);
  }
}

const samples = Number.parseInt(readArgument("--samples", "1000"), 10);
const startingArea = readArgument("--starting-area", "Garage");
const label = readArgument("--label", "drill sample");
const result = readArgument("--result", "complete");
const drillSettings = parseJsonArgument("--settings", {});

const summary = sampleDrillGeneration({
  samples,
  startingArea,
  result,
  drillSettings
});

console.log(label);
console.log(`samples\t${summary.samples}`);
console.log(`startingArea\t${summary.startingArea}`);
console.log(`result\t${summary.result}`);
console.log(`settings\t${JSON.stringify(summary.drillSettings)}`);

printTable("categories", summary.categoryCounts, summary.samples);
printTable("types", summary.typeCounts, summary.samples);
printTable("transitions", summary.transitionCounts, summary.samples);

console.log("\ntransition-ratios");
console.log(`relocationShare\t${formatPercent(summary.transitionRatios.relocationShare * 100)}`);
console.log(`levelShiftShareOfAreaChanges\t${formatPercent(summary.transitionRatios.levelShiftShareOfAreaChanges * 100)}`);
console.log(
  `levelShiftShareOfNonDistrictAreaChanges\t${formatPercent(
    summary.transitionRatios.levelShiftShareOfNonDistrictAreaChanges * 100
  )}`
);
console.log(`districtChangeShareOfAreaChanges\t${formatPercent(summary.transitionRatios.districtChangeShareOfAreaChanges * 100)}`);

console.log("\nunlock-context");
console.log("key\tcount\tpercent");
for (const row of formatCountsTable(summary.unlockContextCounts, Math.max(1, summary.samples))) {
  console.log(`${row.key}\t${row.count}\t${formatPercent(row.percent)}`);
}
if (summary.unlockContextCounts.relevantDistrictRolls > 0) {
  console.log(
    `unlockHitRateWhenRelevant\t${formatPercent(
      (summary.unlockContextCounts.unlocksInRelevantDistricts /
        summary.unlockContextCounts.relevantDistrictRolls) *
        100
    )}`
  );
}
