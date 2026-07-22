import json
import csv
import os

# Paths
csv_path = '/Users/moon/Documents/voronoi/myWorkspace/sample/chem_space/filtered_descriptors.csv'
json_path = '/Users/moon/Documents/voronoi/myWorkspace/frontend/public/data/chemSpaceData.json'
output_path = '/Users/moon/Documents/voronoi/myWorkspace/frontend/public/data/chemSpaceData.json'

# Load CSV data into a dictionary for fast lookup
# Columns: SMILES, MaxAbsEStateIndex, ..., qed, ..., MolWt, ...
qed_map = {}
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        smiles = row['SMILES']
        qed_map[smiles] = {
            'q': float(row['qed']) if row['qed'] else 0.0,
            'f': float(row['FractionCSP3']) if row['FractionCSP3'] else 0.0,
            'r': int(row['NumRotatableBonds']) if row['NumRotatableBonds'] else 0
        }

# Load current JSON
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Merge data
updated_count = 0
for item in data:
    smiles = item.get('s')
    if smiles in qed_map:
        item.update(qed_map[smiles])
        updated_count += 1

# Save updated JSON
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(data, f)

print(f"Successfully updated {updated_count} out of {len(data)} compounds.")
print(f"Added fields: q (qed), f (FractionCSP3), r (NumRotatableBonds)")
