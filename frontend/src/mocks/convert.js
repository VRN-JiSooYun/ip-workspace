const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'WO2026090333A1_PATENT_DATA.json');
const tsPath = path.join(__dirname, 'patentDetail_WO2026090333A1.ts');

const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const result = rawData.result;

const patentData = (result.data && result.data.length > 0) ? result.data[0] : {};

const freqAnalysis = typeof patentData.frequency_analysis_result_json === 'string' 
    ? JSON.parse(patentData.frequency_analysis_result_json) 
    : patentData.frequency_analysis_result_json;

const patentDetailData = {
  id: "WO2026090333A1",
  abstract: patentData.patent_info ? patentData.patent_info.abstract : "Provided herein are methods of treating cancer by administering a combination therapy comprising a KRAS G12D inhibitor, folinic acid, 5-fluorouracil, irinotecan, and oxaliplatin.",
  keyCompoundSmiles: patentData.ai_key_compound || "CCOC(=O)c1c(C)nc2c(F)c(-c3cccc(Cl)c3Cl)c(CCC#N)cc2c1Cl",
  keyCompoundSvg: patentData.ai_key_compound_img || "",
  analysis: {
    importantRGroups: freqAnalysis ? freqAnalysis.important_r_groups : ["R1", "R6", "R7"],
    parentScaffold: {
      svg: freqAnalysis && freqAnalysis.parent_scaffold ? freqAnalysis.parent_scaffold._svg : ""
    },
    scaffoldRanks: ['rank1', 'rank2', 'rank3', 'rank4', 'rank5'].filter(r => freqAnalysis && freqAnalysis[r]).map((r, i) => ({
      rank: i + 1,
      svg: freqAnalysis[r]._svg || "",
      frequency: freqAnalysis[r].frequency || 0,
      smiles: freqAnalysis[r].smiles || ""
    })),
    rGroups: freqAnalysis && freqAnalysis.r_groups ? Object.keys(freqAnalysis.r_groups).map(rId => {
      return {
        id: rId,
        variants: freqAnalysis.r_groups[rId].map(v => ({
          frequency: v.frequency || 0,
          svg: v._svg || "",
          smiles: v.smiles || ""
        }))
      };
    }) : []
  },
  patentCompounds: (result.patent_compound || []).map((comp, idx) => {
    return {
      id: comp.compound_id || comp.id || (idx + 1),
      smiles: comp.molblock ? "MOCK_SMILES" : "MOCK_SMILES",
      page: Array.isArray(comp.page) ? comp.page : (comp.page ? [comp.page] : []),
      bbox: Array.isArray(comp.bbox) ? comp.bbox : [],
      svg: comp.compound_svg || "",
      rank: idx + 1
    };
  })
};

const tsContent = `export const patentDetailData = ${JSON.stringify(patentDetailData, null, 2)};\n`;
fs.writeFileSync(tsPath, tsContent, 'utf-8');
console.log("Mock data generated successfully with bbox.");
