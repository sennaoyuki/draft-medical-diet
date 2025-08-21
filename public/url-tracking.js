// URL Parameter Tracking for Analytics
// This script adds tracking parameters to outbound links

(function() {
    'use strict';

    // クリックイベントのトラッキング
    function addTrackingParameters(url, params) {
        try {
            const urlObj = new URL(url, window.location.origin);
            
            // 既存のパラメータを保持しつつ、新しいパラメータを追加
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    urlObj.searchParams.set(key, params[key]);
                }
            });
            
            return urlObj.toString();
        } catch (e) {
            console.error('URL parsing error:', e);
            return url;
        }
    }

    // 公式サイトリンクの処理
    function setupOutboundLinkTracking() {
        document.addEventListener('click', function(e) {
            // link_btnクラスまたは公式サイトへのリンクを検出
            const link = e.target.closest('a.link_btn') || 
                        e.target.closest('a[href*="/go/"]') ||
                        e.target.closest('.btn_second_primary a') ||
                        e.target.closest('.cta-button') ||
                        e.target.closest('#first-choice-cta-link');
            if (!link) return;
            
            // リンク先がgo/xxx/形式の場合のみ処理
            const href = link.getAttribute('href');
            if (!href || !href.includes('/go/')) return;
            
            // クリニック名を取得
            let clinicName = 'Unknown';
            
            // URLからクリニック名を推測
            const clinicIdMatch = href.match(/\/go\/(\w+)\//);
            const clinicId = clinicIdMatch ? clinicIdMatch[1] : null;
            
            const clinicNameMap = {
                'dio': 'ディオクリニック',
                'eminal': 'エミナルクリニック',
                'urara': 'URARAクリニック',
                'lieto': 'リエートクリニック',
                'sbc': '湘南美容クリニック'
            };
            
            if (clinicId && clinicNameMap[clinicId]) {
                clinicName = clinicNameMap[clinicId];
            } else {
                // 比較表から
                if (link.closest('tr')) {
                    clinicName = link.closest('tr').querySelector('.clinic-link')?.textContent || clinicName;
                }
                // ランキングセクションから（clinic-logo-sectionから取得）
                else if (link.closest('.ranking-item')) {
                    clinicName = link.closest('.ranking-item').querySelector('.clinic-logo-section')?.textContent?.trim() || clinicName;
                }
                // 詳細セクションから（h3の最初のテキストノードのみ取得）
                else if (link.closest('.detail-item')) {
                    const h3 = link.closest('.detail-item').querySelector('h3');
                    if (h3 && h3.firstChild && h3.firstChild.nodeType === Node.TEXT_NODE) {
                        clinicName = h3.firstChild.textContent.trim() || clinicName;
                    }
                }
                // 地図モーダルから
                else if (link.closest('.map-modal')) {
                    clinicName = document.getElementById('map-modal-clinic-name')?.textContent || clinicName;
                }
            }
            
            // 現在は使用しないがコメントとして保持
            // const rankElement = link.closest('.ranking-item')?.querySelector('.rank-badge');
            // const rank = rankElement ? rankElement.textContent.replace(/[^\d]/g, '') : '';
            // const currentRegion = new URLSearchParams(window.location.search).get('region_id') || '013';
            
            // セクションを判別
            let clickSection = 'unknown';
            if (link.closest('.ranking-container') || link.closest('.ranking-item')) {
                clickSection = 'ranking';
            } else if (link.closest('.comparison-table')) {
                clickSection = 'comparison_table';
            } else if (link.closest('.clinic-details-container') || link.closest('.detail-item')) {
                clickSection = 'details';
            } else if (link.closest('.campaign-section')) {
                clickSection = 'campaign_section';
            } else if (link.closest('.map-modal')) {
                clickSection = 'map_modal';
            } else if (link.closest('#first-choice-recommendation-section') || 
                      link.closest('.first-choice-recommendation-section')) {
                clickSection = 'first_choice_recommendation';
            }
            
            // トラッキングパラメータ（click_sectionは必須で含める）
            const trackingParams = {
                click_section: clickSection || 'unknown',
                click_clinic: clinicName.replace(/\s+/g, '_'),
                source_page: window.location.pathname
            };
            
            // 新しいURLを生成
            const newUrl = addTrackingParameters(href, trackingParams);
            
            // hrefを更新（実際のクリック時に適用される）
            link.setAttribute('href', newUrl);
            
            // デバッグログ
            console.log('Outbound link tracking:', {
                original: href,
                new: newUrl,
                params: trackingParams
            });
        }, true); // キャプチャフェーズで実行
    }

    // 詳細を見るボタンの処理
    function setupInternalLinkTracking() {
        document.addEventListener('click', function(e) {
            const link = e.target.closest('a.detail_btn');
            if (!link) return;
            
            const href = link.getAttribute('href');
            if (!href || !href.startsWith('#')) return;
            
            // クリニック情報を取得
            const clinicName = link.closest('tr')?.querySelector('.clinic-link')?.textContent || 'Unknown';
            const rank = href.replace('#clinic', '');
            
            // URLにパラメータを追加（ハッシュは保持）
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('detail_click', clinicName.replace(/\s+/g, '_'));
            currentUrl.searchParams.set('detail_rank', rank);
            
            // URLを更新（ページリロードなし）
            window.history.replaceState({}, '', currentUrl.toString() + href);
            
            console.log('Internal navigation tracked:', {
                clinic: clinicName,
                rank: rank
            });
        });
    }

    // タブ切り替えの追跡
    function setupTabTracking() {
        // Tipsタブ
        document.addEventListener('click', function(e) {
            const tab = e.target.closest('.tips-container .tab');
            if (!tab) return;
            
            const tabText = tab.querySelector('.tab-text')?.textContent || tab.textContent;
            const tabIndex = tab.getAttribute('data-tab');
            
            // URLパラメータを更新
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('tips_tab', tabText.replace(/\s+/g, '_'));
            currentUrl.searchParams.set('tips_index', tabIndex);
            window.history.replaceState({}, '', currentUrl.toString());
        });

        // 比較表タブ
        document.addEventListener('click', function(e) {
            const tab = e.target.closest('.comparison-tab-menu-item');
            if (!tab) return;
            
            const tabText = tab.textContent;
            
            // URLパラメータを更新
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('comparison_tab', tabText.replace(/\s+/g, '_'));
            window.history.replaceState({}, '', currentUrl.toString());
        });
    }

    // セッション情報の追加（現在は使用しない）
    function addSessionInfo() {
        // セッションIDとfirst_visitは不要なため、コメントアウト
        // 必要に応じて後で有効化可能
    }

    // スクロール深度の記録
    function trackScrollDepth() {
        let maxScroll = 0;
        
        window.addEventListener('scroll', function() {
            const scrollPercentage = Math.round((window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
            
            if (scrollPercentage > maxScroll) {
                maxScroll = scrollPercentage;
                
                // 25%刻みで記録
                if (maxScroll % 25 === 0) {
                    const currentUrl = new URL(window.location.href);
                    currentUrl.searchParams.set('max_scroll', maxScroll);
                    window.history.replaceState({}, '', currentUrl.toString());
                }
            }
        });
    }

    // すべての外部リンクに対するフォールバック処理
    function setupGenericLinkTracking() {
        document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (!link) return;
            
            const href = link.getAttribute('href');
            if (!href || !href.includes('/go/')) return;
            
            // 既にトラッキングパラメータが付いている場合はスキップ
            if (href.includes('click_section=')) return;
            
            // 基本的なトラッキングパラメータを追加
            const trackingParams = {
                click_section: 'unknown',
                source_page: window.location.pathname
            };
            
            const newUrl = addTrackingParameters(href, trackingParams);
            link.setAttribute('href', newUrl);
            
            console.log('Generic link tracking applied:', {
                original: href,
                new: newUrl
            });
        }, true);
    }

    // 初期化
    function init() {
        
        // 各種トラッキングの設定
        setupOutboundLinkTracking();
        setupInternalLinkTracking();
        setupGenericLinkTracking();
        setupTabTracking();
        addSessionInfo();
        trackScrollDepth();
        
        // 現在のURLパラメータをログ
        const params = new URLSearchParams(window.location.search);
    }

    // DOMContentLoadedで初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();