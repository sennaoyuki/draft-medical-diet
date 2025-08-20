import csv
import json

# CSVファイルを読み込み
data = {}
with open('clinic-texts.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    headers = next(reader)
    
    for row in reader:
        if len(row) >= 4:
            list_name = row[0]
            item_key = row[1]
            
            if list_name not in data:
                data[list_name] = {}
            
            # フィールド3（インデックス3）のデータを格納
            data[list_name][item_key] = row[3] if len(row) > 3 else ''

# 既存のJSONファイルを読み込み
with open('clinic-texts.json', 'r', encoding='utf-8') as f:
    existing_data = json.load(f)

# 新しいデータで更新
for clinic_code, items in data.items():
    if clinic_code in existing_data:
        existing_data[clinic_code].update(items)
    else:
        existing_data[clinic_code] = items

# JSONファイルに書き込み
with open('clinic-texts.json', 'w', encoding='utf-8') as f:
    json.dump(existing_data, f, ensure_ascii=False, indent=2)

print('JSONファイルを更新しました')