// 追跡パラメータを追加するグローバル関数
window.addTrackingParams = function(baseUrl, clickSection, clickClinic) {
    try {
        console.log('🔍 addTrackingParams入力:', {
            baseUrl,
            現在のURL: window.location.href,
            現在のorigin: window.location.origin,
            現在のpathname: window.location.pathname
        });
        
        // baseUrlの構造を詳細分析
        console.log('🔍 baseURL分析:', {
            raw: baseUrl,
            isRelative: !baseUrl.startsWith('http'),
            hasQueryParams: baseUrl.includes('?'),
            queryPart: baseUrl.includes('?') ? baseUrl.split('?')[1] : 'なし'
        });
        
        // 現在のURLパラメータを全て取得
        const currentParams = new URLSearchParams(window.location.search);
        
        // URLオブジェクトを作成
        // baseUrlが相対パスの場合、現在のページを基準に解決される
        const url = new URL(baseUrl, window.location.href);
        
        console.log('🔍 URL解決結果:', {
            入力: baseUrl,
            解決後: url.href,
            既存パラメータ: url.search,
            パラメータ数: url.searchParams.size
        });
        
        // 既存のパラメータを全て引き継ぐ（重複を避けるため、既にあるものはスキップしない）
        for (const [key, value] of currentParams) {
            url.searchParams.set(key, value);
        }
        
        console.log('🔍 現在のパラメータ追加後:', {
            URL: url.href,
            パラメータ: url.search
        });
        
        // 追跡パラメータを追加
        url.searchParams.set('click_section', clickSection || '');
        url.searchParams.set('click_clinic', clickClinic || '');
        url.searchParams.set('source_page', window.location.pathname);
        
        const finalUrl = url.toString();
        console.log('🔍 最終URL生成:', {
            final: finalUrl,
            questionMarks: (finalUrl.match(/\?/g) || []).length
        });
        
        return finalUrl;
    } catch (e) {
        console.error('Error adding tracking params:', e);
        return baseUrl;
    }
};

// すべてのクリニックリンクに自動的に追跡パラメータを追加
document.addEventListener('DOMContentLoaded', function() {
    // 少し遅延させて、動的に生成されるリンクにも対応
    setTimeout(() => {
        const clinicLinks = document.querySelectorAll('a[href*="/go/"]');
        
        clinicLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                // クリック位置からセクションとクリニック名を推定
                let clickSection = 'unknown';
                let clickClinic = '';
                
                // ランキングセクション内かチェック
                const rankingSection = link.closest('.ranking-item, .ranking__card');
                if (rankingSection) {
                    clickSection = 'ranking';
                }
                
                // 詳細セクション内かチェック
                const detailSection = link.closest('.clinic-detail-card');
                if (detailSection) {
                    clickSection = 'details';
                }
                
                // 比較表内かチェック
                const comparisonTable = link.closest('.comparison-table');
                if (comparisonTable) {
                    clickSection = 'comparison';
                }
                
                // 相対パスに変換（現在のディレクトリ内のgo/に変更）
                let relativePath = href;
                
                // hrefがフルURLか相対パスかを判定
                let pathToCheck = href;
                if (href.startsWith('http')) {
                    try {
                        const hrefUrl = new URL(href);
                        pathToCheck = hrefUrl.pathname;
                    } catch (e) {
                        pathToCheck = href;
                    }
                }
                
                console.log('🔄 パス変換デバッグ開始:', {
                    元のhref: href,
                    チェック対象パス: pathToCheck,
                    現在のURL: window.location.href,
                    現在のパス: window.location.pathname,
                    path_startsWith_go: pathToCheck.startsWith('/go/')
                });
                
                if (pathToCheck.startsWith('/go/')) {
                    // 現在のパスから相対パスを生成
                    const currentPath = window.location.pathname;
                    const pathSegments = currentPath.split('/').filter(segment => segment);
                    
                    console.log('🔍 パスセグメント解析:', {
                        currentPath,
                        pathSegments,
                        pathSegments_length: pathSegments.length,
                        firstSegment: pathSegments[0]
                    });
                    
                    // トップディレクトリ（例：medical-diet001）を取得
                    if (pathSegments.length > 0 && pathSegments[0] !== 'go') {
                        const topDir = pathSegments[0];
                        
                        // フルURLの場合は、パスの部分だけを置き換え
                        if (href.startsWith('http')) {
                            try {
                                const hrefUrl = new URL(href);
                                hrefUrl.pathname = `/${topDir}${pathToCheck}`;
                                relativePath = hrefUrl.toString();
                            } catch (e) {
                                relativePath = `/${topDir}${pathToCheck}`;
                            }
                        } else {
                            relativePath = `/${topDir}${pathToCheck}`;
                        }
                        
                        console.log('✅ パス変換実行:', {
                            topDir,
                            元のhref: href,
                            元のパス: pathToCheck,
                            変換後: relativePath
                        });
                    } else {
                        console.log('⚠️ パス変換スキップ:', {
                            reason: pathSegments.length === 0 ? 'セグメントなし' : 'goディレクトリ内'
                        });
                    }
                } else {
                    console.log('ℹ️ /go/で始まらないためスキップ');
                }
                
                console.log('🎯 最終パス変換結果:', {
                    元のhref: href,
                    変換後: relativePath
                });
                
                // 新しいURLを生成
                const newUrl = window.addTrackingParams(relativePath, clickSection, clickClinic);
                
                console.log('🔍 リンククリック:', {
                    元のhref: href,
                    現在のパス: window.location.pathname,
                    新しいURL: newUrl,
                    clickSection,
                    clickClinic
                });
                
                // 新しいタブで開く
                window.open(newUrl, '_blank');
            });
        });
    }, 1000);
});