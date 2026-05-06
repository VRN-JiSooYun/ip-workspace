const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'WO2026090333A1_PATENT_DATA.json');
const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const result = rawData.result;
const patentData = result.data[0];

const freqAnalysis = typeof patentData.frequency_analysis_result_json === 'string' 
    ? JSON.parse(patentData.frequency_analysis_result_json) 
    : patentData.frequency_analysis_result_json;

console.log("Keys in freqAnalysis:", Object.keys(freqAnalysis));
if (freqAnalysis.rank1) {
  console.log("rank1:", Object.keys(freqAnalysis.rank1));
  console.log("rank1 frequency:", freqAnalysis.rank1.frequency);
}
if (freqAnalysis.rank2) {
  console.log("rank2 frequency:", freqAnalysis.rank2.frequency);
}
