#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * CSVの値を適切にパースする関数
 * カンマを含む値に対応
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // エスケープされた引用符
                current += '"';
                i++; // 次の引用符をスキップ
            } else {
                // 引用符の開始/終了
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // フィールドの区切り
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    // 最後のフィールドを追加
    result.push(current);
    
    return result;
}

/**
 * site-common-texts.csvをsite-common-texts.jsonに変換
 */
function convertSiteCommonTexts() {
    const csvFile = path.join(__dirname, 'site-common-texts.csv');
    const jsonFile = path.join(__dirname, 'site-common-texts.json');
    
    console.log('🔄 site-common-texts.csv を JSON に変換中...');
    
    try {
        // CSVファイルを読み込み
        let csvContent = fs.readFileSync(csvFile, 'utf-8');
        
        // BOMを除去
        if (csvContent.charCodeAt(0) === 0xFEFF) {
            csvContent = csvContent.slice(1);
        }
        
        // 行に分割
        const lines = csvContent.split('\n').filter(line => line.trim());
        
        // JSONオブジェクトを作成
        const result = {};
        
        // ヘッダー行をスキップし、データ行を処理
        for (let i = 1; i < lines.length; i++) {
            const columns = parseCSVLine(lines[i]);
            
            if (columns.length >= 3) {
                const key = columns[0].trim();
                let value = columns[2].trim();
                
                // 引用符で囲まれている場合は削除
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                    // エスケープされた引用符を元に戻す
                    value = value.replace(/""/g, '"');
                }
                
                if (key) {
                    result[key] = value;
                }
            }
        }
        
        // JSONファイルに書き込み（インデント2で整形）
        fs.writeFileSync(jsonFile, JSON.stringify(result, null, 2), 'utf-8');
        
        console.log('✅ 変換完了:', jsonFile);
        console.log('📊 変換された項目数:', Object.keys(result).length);
        
        // 変換結果を表示
        console.log('\n変換結果:');
        Object.entries(result).forEach(([key, value]) => {
            const displayValue = value.length > 60 ? value.substring(0, 60) + '...' : value;
            console.log(`  ${key}: ${displayValue}`);
        });
        
    } catch (error) {
        console.error('❌ エラー:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// 実行
convertSiteCommonTexts();