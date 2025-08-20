#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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
            const columns = lines[i].split(',');
            
            if (columns.length >= 3) {
                const key = columns[0].trim();
                const value = columns[2].trim();
                
                if (key) {
                    result[key] = value;
                }
            }
        }
        
        // JSONファイルに書き込み
        fs.writeFileSync(jsonFile, JSON.stringify(result, null, 2), 'utf-8');
        
        console.log('✅ 変換完了:', jsonFile);
        console.log('📊 変換された項目数:', Object.keys(result).length);
        
        // 最初の5項目を表示
        console.log('\n最初の5項目:');
        Object.entries(result).slice(0, 5).forEach(([key, value]) => {
            const displayValue = value.length > 50 ? value.substring(0, 50) + '...' : value;
            console.log(`  ${key}: ${displayValue}`);
        });
        
    } catch (error) {
        console.error('❌ エラー:', error.message);
        process.exit(1);
    }
}

// 実行
convertSiteCommonTexts();