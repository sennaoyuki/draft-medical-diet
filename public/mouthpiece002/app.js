// クリニックURLをCSVデータベースから動的に取得
function getClinicUrlFromConfig(clinicId, rank = 1) {
    // DataManagerから動的に取得
    if (window.dataManager) {
        const clinicCode = window.dataManager.getClinicCodeById(clinicId);
        if (clinicCode) {
            // CSVデータベースから遷移先URLを取得
            const urlKey = `遷移先URL（${rank}位）`;
            const url = window.dataManager.getClinicText(clinicCode, urlKey, '');
            if (url) {
                return url;
            }
        }
    }
    
    // デフォルトURL（データが見つからない場合）
    return 'https://sss.ac01.l-ad.net/cl/p1a64143O61e70f7/?bid=a6640dkh37648h88&param2=[ADID_PLACEHOLDER]&param3=[GCLID_PLACEHOLDER]';
}

// URLパラメータ処理クラス
class UrlParamHandler {
    getParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    setParam(name, value) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set(name, value);
        window.history.replaceState({}, '', `${window.location.pathname}?${urlParams}`);
    }

    getAllParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const params = {};
        for (const [key, value] of urlParams) {
            params[key] = value;
        }
        return params;
    }

    getRegionId() {
        return this.getParam('region_id') || '013'; // デフォルトは東京
    }

    updateRegionId(regionId) {
        this.setParam('region_id', regionId);
    }

    // クリニックURLを取得（CSVから直接URLを取得し、パラメータを適切に処理）
    getClinicUrlWithRegionId(clinicId, rank = 1) {
        // DataManagerが初期化されているか確認
        if (!window.dataManager) {
            return '#';
        }
        
        // パラメータをlocalStorageに保存（サーバーがURLパラメータを削除する対策）
        const regionId = this.getRegionId();
        const redirectParams = {
            clinic_id: clinicId,
            rank: rank,
            region_id: regionId || '013'
        };
        
        // クリックイベントでlocalStorageに保存するため、データ属性として埋め込む
        // 実際の保存はクリック時に行う
        const redirectUrl = new URL('./redirect.html', window.location.origin + window.location.pathname);
        
        // URLパラメータも念のため設定（サーバーが保持する場合に備えて）
        redirectUrl.searchParams.set('clinic_id', clinicId);
        redirectUrl.searchParams.set('rank', rank);
        if (regionId) {
            redirectUrl.searchParams.set('region_id', regionId);
        }
        
        // データ属性用のJSON文字列を作成
        const dataJson = JSON.stringify(redirectParams);
        
        // カスタムデータ属性として埋め込むため、特殊なハッシュを使用
        redirectUrl.hash = `params=${encodeURIComponent(dataJson)}`;
        
        return redirectUrl.toString();
    }

    // クリニック名からURLを生成してregion_idパラメータを付与するヘルパー関数（リダイレクトページ経由）
    getClinicUrlByNameWithRegionId(clinicName) {
        // DataManagerから動的にクリニックコードを取得
        let clinicCode = clinicName;
        
        // グローバルのdataManagerを使用
        const dataManager = window.dataManager;
        
        // clinicNameがクリニック名の場合、クリニックコードに変換
        if (dataManager) {
            const clinics = dataManager.clinics || [];
            const clinic = clinics.find(c => c.name === clinicName || c.code === clinicName);
            if (clinic) {
                clinicCode = clinic.code;
            }
        }
        
        // redirect.htmlへのパスを生成
        if (!clinicCode) return '#';
        
        // DataManagerからクリニックIDを取得
        let clinicId = null;
        let rank = 1; // デフォルトは1位
        
        if (dataManager) {
            const clinics = dataManager.clinics || [];
            const clinic = clinics.find(c => c.code === clinicCode);
            if (clinic) {
                clinicId = clinic.id;
                // ランキングから順位を取得（getRankingsByRegionメソッドを直接使用）
                try {
                    if (dataManager.getRankingsByRegion && typeof dataManager.getRankingsByRegion === 'function') {
                        const rankings = dataManager.getRankingsByRegion(this.getRegionId());
                        const rankInfo = rankings.find(r => r.clinicId == clinicId);
                        if (rankInfo) {
                            rank = rankInfo.rank;
                        }
                    } else {
                        // getRankingsByRegionが存在しない場合は、rankingsから直接取得
                        const regionId = this.getRegionId();
                        if (dataManager.rankings && dataManager.rankings[regionId]) {
                            const regionRankings = dataManager.rankings[regionId];
                            // regionRankingsから該当するクリニックの順位を探す
                            const rankingEntries = Object.entries(regionRankings.ranks || {});
                            for (const [position, cId] of rankingEntries) {
                                if (cId == clinicId) {
                                    rank = parseInt(position.replace('no', '')) || 1;
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    rank = 1; // エラー時はデフォルトで1位
                }
            }
        }
        
        if (!clinicId) return '#';
        
        // redirect.htmlへのパスを生成
        const regionId = this.getRegionId();
        let redirectUrl = `./redirect.html?clinic_id=${clinicId}&rank=${rank}`;
        if (regionId) {
            redirectUrl += `&region_id=${regionId}`;
        }
        
        // UTMパラメータなどを追加
        const urlParams = new URLSearchParams(window.location.search);
        const utmCreative = urlParams.get('utm_creative');
        const gclid = urlParams.get('gclid');
        
        if (utmCreative) {
            redirectUrl += `&utm_creative=${encodeURIComponent(utmCreative)}`;
        }
        if (gclid) {
            redirectUrl += `&gclid=${encodeURIComponent(gclid)}`;
        }
        
        return redirectUrl;
    }
}

// 表示管理クラス
class DisplayManager {
    constructor(urlHandler) {
        this.urlHandler = urlHandler;
        this.regionSelect = document.getElementById('sidebar-region-select');
        this.searchInput = document.getElementById('sidebar-clinic-search');
        this.selectedRegionName = document.getElementById('selected-region-name');
        this.rankingList = document.getElementById('ranking-list');
        this.storesList = document.getElementById('stores-list');
        this.errorMessage = document.getElementById('error-message');
        this.errorText = document.getElementById('error-text');
        this.heroRegionBadge = document.getElementById('hero-region-badge');
        
        // ハンバーガーメニュー要素
        this.hamburgerMenu = document.getElementById('hamburger-menu');
        this.sidebarMenu = document.getElementById('sidebar-menu');
        this.sidebarOverlay = document.getElementById('sidebar-overlay');
        this.closeSidebar = document.getElementById('close-sidebar');
    }

    // 地域セレクターを更新（検索用、現在の地域選択は反映しない）
    updateRegionSelector(regions, selectedRegionId) {
        if (!this.regionSelect) {
            console.warn('Region selector not found');
            return;
        }
        this.regionSelect.innerHTML = '';
        
        // 「全地域」オプションを追加
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = '全地域';
        allOption.selected = true; // デフォルトで「全地域」を選択
        this.regionSelect.appendChild(allOption);
        
        // 各地域を追加
        regions.forEach(region => {
            const option = document.createElement('option');
            option.value = region.id;
            option.textContent = region.name;
            // 現在の地域選択は反映しない
            this.regionSelect.appendChild(option);
        });
    }

    // 選択された地域名を表示（アクセシビリティ対応）
    updateSelectedRegionName(regionName) {
        if (this.selectedRegionName) {
            this.selectedRegionName.textContent = regionName || '該当店舗なし';
        }
        // ヒーローバッジも更新
        if (this.heroRegionBadge) {
            this.heroRegionBadge.textContent = regionName ? `${regionName}版` : '東京版';
        }
    }

    updateRankingDisplay(clinics, ranking) {
        this.rankingList.innerHTML = '';

        if (!ranking || Object.keys(ranking.ranks).length === 0) {
            this.rankingList.innerHTML = '<div class="empty-state"><p>この地域のランキングデータはありません</p></div>';
            return;
        }

        // ランキング順に表示（no1, no2, no3...の順番でソート）
        const sortedRanks = Object.entries(ranking.ranks).sort((a, b) => {
            const numA = parseInt(a[0].replace('no', ''));
            const numB = parseInt(b[0].replace('no', ''));
            return numA - numB;
        });

        sortedRanks.forEach(([position, clinicId]) => {
            const clinic = clinics.find(c => c.id === clinicId);
            if (!clinic) return;

            const rankNum = parseInt(position.replace('no', ''));
            
            // 5位までに制限
            if (rankNum > 5) return;
            
            // ランキングアイテムのコンテナ
            const rankingItem = document.createElement('div');
            rankingItem.className = `ranking-item rank-${rankNum}`;

            // メダルクラスの設定
            let medalClass = '';
            let medalText = `No.${rankNum}`;
            if (rankNum === 1) medalClass = 'gold-medal';
            else if (rankNum === 2) medalClass = 'silver-medal';
            else if (rankNum === 3) medalClass = 'bronze-medal';

            // 評価スコアをclinic-texts.jsonから取得
            const clinicCodeForRating = window.dataManager.getClinicCodeById(clinic.id);
            const ratingScore = clinicCodeForRating 
                ? parseFloat(window.dataManager.getClinicText(clinicCodeForRating, '総合評価', '4.5'))
                : 4.5;
            const rating = { 
                score: ratingScore, 
                stars: ratingScore 
            };

            // スターのHTML生成
            let starsHtml = '';
            const fullStars = Math.floor(rating.stars);
            const decimalPart = rating.stars % 1;
            
            // 完全な星を表示
            for (let i = 0; i < fullStars; i++) {
                starsHtml += '<i class="fas fa-star"></i>';
            }
            
            // 小数部分の処理
            if (decimalPart > 0) {
                const percentage = Math.round(decimalPart * 100);
                starsHtml += `<i class="fas fa-star" style="background: linear-gradient(90deg, #6bd1d0 ${percentage}%, transparent ${percentage}%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"></i>`;
            }
            
            // 残りの空の星を表示
            for (let i = Math.ceil(rating.stars); i < 5; i++) {
                starsHtml += '<i class="far fa-star"></i>';
            }

            // バナー画像をclinic-texts.jsonから取得
            const imagesPath = window.SITE_CONFIG ? window.SITE_CONFIG.imagesPath + '/images' : '/images';
            const clinicCodeForImage = window.dataManager.getClinicCodeById(clinic.id);
            let bannerImage = `${imagesPath}/clinics/dio/dio-logo.webp`; // デフォルト
            
            if (clinicCodeForImage) {
                // clinic-texts.jsonからパスを取得
                const imagePath = window.dataManager.getClinicText(clinicCodeForImage, 'クリニックロゴ画像パス', '');
                if (imagePath) {
                    bannerImage = imagePath;
                } else {
                    // フォールバック：コードベースのパス
                    bannerImage = `${imagesPath}/clinics/${clinicCodeForImage}/${clinicCodeForImage}-logo.webp`;
                }
            }

            // 押しメッセージをclinic-texts.jsonから取得
            const clinicCode = window.dataManager.getClinicCodeById(clinic.id);
            const pushMessage = clinicCode 
                ? window.dataManager.getClinicText(clinicCode, 'ランキングプッシュメッセージ', '人気のクリニック')
                : '人気のクリニック';

            // クリニックロゴのパスを取得
            let clinicLogoPath = '';
            if (clinicCode) {
                const logoPathFromJson = window.dataManager.getClinicText(clinicCode, 'ロゴ画像パス', '');
                if (logoPathFromJson) {
                    clinicLogoPath = logoPathFromJson;
                } else {
                    // フォールバック：コードベースのパス
                    // キレイラインの特別処理
                    const logoFolder = clinicCode === 'kireil' ? 'kireiline' : clinicCode;
                    clinicLogoPath = `../common_data/images/clinics/${logoFolder}/${logoFolder}-logo.webp`;
                }
            }

            rankingItem.innerHTML = `
                <div class="rank-medal ${medalClass}">
                    <img src="../common_data/images/badges/rank-${rankNum}.svg" alt="${medalText}" class="medal-image">
                </div>
                <div class="clinic-card">
                    <div class="satisfaction-badge">
                        <span class="satisfaction-label">満足度</span>
                    </div>
                    <div class="rating-section">
                        <div class="stars">
                            ${starsHtml}
                        </div>
                        <div class="rating-score">${rating.score}<span class="score-max">/5.0</span></div>
                    </div>
                    <div class="clinic-logo-section">
                        <h3>${clinic.name}</h3>
                    </div>
                    <div class="clinic-banner">
                        <img src="${clinicLogoPath}" alt="${clinic.name}バナー" onerror="this.style.display='none'">
                    </div>
                    <div class="push-message" style="padding: 0px; text-align: center; font-size: clamp(10px, 2.3vw, 15px); line-height: 1.4; color: #333; font-weight: bold; margin: 4px 0; height: 15%;">
                        ${window.dataManager?.processDecoTags ? window.dataManager.processDecoTags(pushMessage) : pushMessage}
                    </div>
                    <p class="btn btn_second_primary">
                        <a href="${this.urlHandler.getClinicUrlWithRegionId(clinic.id, rankNum)}" target="_blank" rel="noopener">
                            <span class="bt_s">公式サイト</span>
                            <span class="btn-arrow">▶</span>
                        </a>
                    </p>
                </div>
            `;

            this.rankingList.appendChild(rankingItem);
        });
    }

    updateStoresDisplay(stores, clinicsWithStores) {
        
        // brand-section-wrapperを取得（複数の方法で試行）
        let brandSectionWrapper = document.querySelector('.brand-section-wrapper');
        
        if (!brandSectionWrapper) {
            // 要素が見つからない場合、bodyの最後に新しく作成
            brandSectionWrapper = document.createElement('section');
            brandSectionWrapper.className = 'brand-section-wrapper';
            
            // ランキングセクションの後に挿入
            const rankingSection = document.querySelector('.ranking-section');
            if (rankingSection && rankingSection.parentNode) {
                rankingSection.parentNode.insertBefore(brandSectionWrapper, rankingSection.nextSibling);
            } else {
                // rankingセクションが見つからない場合はbodyの最後に追加
                document.body.appendChild(brandSectionWrapper);
            }
        }
        
        // 店舗データがない場合は非表示にする
        if (!stores || stores.length === 0) {
            brandSectionWrapper.innerHTML = '<div style="text-align:center; padding:20px;">この地域には店舗がありません</div>';
            return;
        }
        
        if (!clinicsWithStores || clinicsWithStores.size === 0) {
            brandSectionWrapper.innerHTML = '<div style="text-align:center; padding:20px;">この地域には店舗がありません</div>';
            return;
        }
        
        
        // 店舗情報を表示
        let html = '<div class="brand-section" style="max-width: 1200px; margin: 0 auto;">';
        html += '<h3 style="text-align:center; margin-bottom: 30px; font-size: 24px; color: #333;">東京の店舗一覧</h3>';
        
        // クリニックごとに店舗をグループ化して表示
        let hasAnyStores = false;
        clinicsWithStores.forEach((clinicStores, clinic) => {
            if (clinicStores && clinicStores.length > 0) {
                hasAnyStores = true;
                html += `
                    <div class="clinic-stores-section" style="margin-bottom: 30px; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h4 style="color: #2CC7C5; margin-bottom: 15px; font-size: 20px;">${clinic.name}の【東京】の店舗</h4>
                        <div class="stores-list" style="display: grid; gap: 15px;">
                `;
                
                clinicStores.forEach(store => {
                    html += `
                        <div class="store-item" style="padding: 15px; background: #f8f9fa; border-left: 3px solid #2CC7C5;">
                            <div class="store-name" style="font-weight: bold; margin-bottom: 5px;">${store.storeName || store.name || '店舗名不明'}</div>
                            <div class="store-address" style="color: #666; margin-bottom: 5px;">${store.address || '住所不明'}</div>
                            <div class="store-access" style="color: #888; font-size: 14px;">${store.access || ''}</div>
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            }
        });
        
        if (!hasAnyStores) {
            html += '<div style="text-align:center; padding:20px;">この地域には店舗がありません</div>';
        }
        
        html += '</div>';
        brandSectionWrapper.innerHTML = html;
    }

    showError(message) {
        this.errorText.textContent = message;
        this.errorMessage.style.display = 'block';
        // 既存のタイマーをクリア
        if (this.errorTimeout) {
            clearTimeout(this.errorTimeout);
        }
        // 新しいタイマーを設定
        this.errorTimeout = setTimeout(() => {
            this.errorMessage.style.display = 'none';
        }, 5000);
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }

    updateFooterClinics(clinics, ranking) {
        // フッター内のすべてのulタグを取得
        const footerUls = document.querySelectorAll('#footer ul');
        let footerClinicsContainer = null;
        
        // "人気クリニック"を含むh5を持つulを探す
        for (const ul of footerUls) {
            const h5 = ul.querySelector('h5');
            if (h5 && h5.textContent === '人気クリニック') {
                footerClinicsContainer = ul;
                break;
            }
        }
        
        if (!footerClinicsContainer) return;

        // 既存のクリニックリンクを削除（h5タイトルは残す）
        const clinicLinks = footerClinicsContainer.querySelectorAll('li');
        clinicLinks.forEach(link => link.remove());

        if (!ranking || Object.keys(ranking.ranks).length === 0) {
            return;
        }

        // ランキング順にソート（最大5件）
        const sortedRanks = Object.entries(ranking.ranks).sort((a, b) => {
            const numA = parseInt(a[0].replace('no', ''));
            const numB = parseInt(b[0].replace('no', ''));
            return numA - numB;
        }).slice(0, 5);

        // フッターにクリニックリンクを追加
        sortedRanks.forEach(([position, clinicId]) => {
            const clinic = clinics.find(c => c.id === clinicId);
            if (!clinic) return;

            const rankNum = parseInt(position.replace('no', ''));
            const li = document.createElement('li');
            const link = document.createElement('a');
            link.href = this.urlHandler.getClinicUrlWithRegionId(clinic.id, rankNum);
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = clinic.name;
            li.appendChild(link);
            footerClinicsContainer.appendChild(li);
        });
    }
}

// データ管理クラス
class DataManager {
    constructor() {
        this.regions = [];
        this.clinics = [];
        this.stores = [];
        this.rankings = [];
        this.storeViews = [];
        this.campaigns = [];
        this.siteTexts = {}; // サイトテキストデータ（旧）
        this.clinicTexts = {}; // クリニック別テキストデータ
        // Handle subdirectory paths
        if (window.SITE_CONFIG) {
            this.dataPath = window.SITE_CONFIG.dataPath + '/';
        } else {
            this.dataPath = './data/';
        }
        // 地域データ用のパス（data copyを使用）
        this.regionDataPath = './data copy/';
    }

    async init() {
        try {
            // JSONファイルの読み込み（地域データはdata copyから）
            const response = await fetch(this.regionDataPath + 'compiled-data.json');
            if (!response.ok) {
                throw new Error('Failed to load compiled-data.json');
            }
            const data = await response.json();
            
            // データの設定
            this.regions = data.regions;
            this.clinics = data.clinics;
            
            // ランキングデータの変換
            this.rankings = Object.entries(data.rankings).map(([regionId, ranks]) => ({
                regionId: regionId,
                ranks: ranks
            }));
            
            // 店舗ビューデータの変換
            this.storeViews = Object.entries(data.storeViews).map(([regionId, clinicStores]) => ({
                regionId: regionId,
                clinicStores: clinicStores
            }));
            
            // キャンペーンデータの設定
            this.campaigns = data.campaigns;
            
            // 共通テキストデータの読み込み
            this.commonTexts = {};
            
            // まずローカルのsite-common-texts.jsonを読み込み
            try {
                const localTextResponse = await fetch(this.dataPath + 'site-common-texts.json');
                if (localTextResponse.ok) {
                    const localJsonText = await localTextResponse.text();
                    try {
                        this.commonTexts = JSON.parse(localJsonText);
                        console.log('✅ ローカルsite-common-texts.jsonを読み込みました');
                    } catch (parseError) {
                        console.warn('⚠️ ローカルsite-common-texts.jsonのパースエラー:', parseError);
                    }
                }
            } catch (error) {
                console.warn('⚠️ ローカルsite-common-texts.jsonの読み込みエラー:', error);
            }
            
            // 次にcommon_dataから共通項目を読み込み、上書き
            try {
                const commonTextResponse = await fetch('../../../common_data/data/site-common-texts.json');
                if (commonTextResponse.ok) {
                    const jsonText = await commonTextResponse.text();
                    try {
                        const commonData = JSON.parse(jsonText);
                        // common_dataの値で上書き
                        this.commonTexts = { ...this.commonTexts, ...commonData };
                        console.log('✅ common_dataのsite-common-texts.jsonで上書きしました');
                        
                        // ファビコンとヘッダーロゴアイコンを動的に設定
                        if (this.commonTexts['ファビコン画像パス']) {
                            const faviconElement = document.getElementById('favicon');
                            if (faviconElement) {
                                faviconElement.href = this.commonTexts['ファビコン画像パス'];
                                console.log('✅ ファビコンを設定:', this.commonTexts['ファビコン画像パス']);
                            }
                            
                            const headerLogoIcon = document.getElementById('header-logo-icon');
                            if (headerLogoIcon) {
                                headerLogoIcon.src = this.commonTexts['ファビコン画像パス'];
                                console.log('✅ ヘッダーロゴアイコンを設定:', this.commonTexts['ファビコン画像パス']);
                            }
                        }
                    } catch (parseError) {
                        console.error('❌ JSONパースエラー:', parseError);
                        this.commonTexts = {};
                    }
                } else {
                    console.warn('⚠️ common_dataのsite-common-texts.json が見つかりません。ローカルのみ使用します。Status:', commonTextResponse.status);
                    this.commonTexts = {};
                }
            } catch (error) {
                console.warn('⚠️ 共通テキストの読み込みに失敗しました:', error);
                this.commonTexts = {};
            }
            
            // クリニック別テキストデータの読み込み
            try {
                const clinicTextResponse = await fetch(this.dataPath + 'clinic-texts.json');
                if (clinicTextResponse.ok) {
                    this.clinicTexts = await clinicTextResponse.json();
                } else {
                    this.clinicTexts = {};
                }
            } catch (error) {
                console.warn('⚠️ クリニック別テキストの読み込みに失敗しました:', error);
                this.clinicTexts = {};
            }
            
            // 店舗データをクリニックから抽出
            this.stores = [];
            this.clinics.forEach(clinic => {
                clinic.stores.forEach(store => {
                    this.stores.push({
                        id: store.id,
                        clinicName: clinic.name,
                        storeName: store.name,
                        name: store.name,  // 両方のフィールドで互換性を保つ
                        address: store.address,
                        zipcode: store.zipcode,
                        access: store.access,
                        regionId: this.getRegionIdFromAddress(store.address)
                    });
                });
            });
            
        } catch (error) {
            throw error;
        }
    }
    
    // 住所から地域IDを取得するヘルパーメソッド
    getRegionIdFromAddress(address) {
        if (!address) return null;
        for (const region of this.regions) {
            if (address.includes(region.name)) {
                return region.id;
            }
        }
        return null;
    }

    // CSVファイルを読み込む汎用関数（エラーハンドリング付き）
    async loadCsvFile(filename) {
        try {
            // 地域関連のCSVファイルはdata copyから、それ以外はdataから読み込む
            const path = (filename.includes('stores.csv') || filename.includes('ranking.csv') || filename.includes('store_view.csv')) 
                ? this.regionDataPath + filename 
                : this.dataPath + filename;
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load ${filename}`);
            }
            const text = await response.text();
            return this.parseCsv(text);
        } catch (error) {
            throw error;
        }
    }

    // CSVパーサー（カンマ区切りのデータをオブジェクト配列に変換）
    parseCsv(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = values[index] || '';
            });
            data.push(obj);
        }

        return data;
    }

    // 地域データの読み込み
    async loadRegions() {
        const data = await this.loadCsvFile('出しわけSS - region.csv');
        this.regions = data.map(row => ({
            id: row.parameter_no,
            name: row.region
        }));
    }

    // クリニックデータの読み込み
    async loadClinics() {
        const data = await this.loadCsvFile('出しわけSS - items.csv');
        this.clinics = data.map(row => ({
            id: row.clinic_id,
            name: row.clinic_name,
            code: row.code
        }));
    }

    // 店舗データの読み込み
    async loadStores() {
        const data = await this.loadCsvFile('出しわけSS - stores.csv');
        this.stores = data.map(row => ({
            id: row.store_id,
            clinicName: row.clinic_name,
            storeName: row.store_name,
            name: row.store_name,  // 両方のフィールドで互換性を保つ
            zipcode: row.Zipcode,
            address: row.adress,
            access: row.access,
            regionId: null // 後で関連付け
        }));
    }

    // ランキングデータの読み込み
    async loadRankings() {
        const data = await this.loadCsvFile('出しわけSS - ranking.csv');
        
        // 地域ごとにランキングをグループ化
        const rankingMap = {};
        data.forEach(row => {
            const regionId = row.parameter_no;
            if (!rankingMap[regionId]) {
                rankingMap[regionId] = {
                    regionId: regionId,
                    ranks: {}
                };
            }
            
            // 各順位のクリニックIDを設定（"-"は除外）
            Object.keys(row).forEach(key => {
                if (key.startsWith('no') && row[key] && row[key] !== '-') {
                    rankingMap[regionId].ranks[key] = row[key];
                }
            });
        });

        this.rankings = Object.values(rankingMap);
    }

    // 店舗ビューデータの読み込み
    async loadStoreViews() {
        const data = await this.loadCsvFile('出しわけSS - store_view.csv');
        
        this.storeViews = data.map(row => {
            const view = {
                regionId: row.parameter_no,
                clinicStores: {}
            };
            
            // 各クリニックの店舗IDを取得（新しいヘッダー構造に対応）
            // dio_stores, urara_stores, dsc_stores, lieto_stores, eminal_stores, sbc_stores
            const clinicKeys = ['dio_stores', 'urara_stores', 'dsc_stores', 'lieto_stores', 'eminal_stores', 'sbc_stores'];
            clinicKeys.forEach(key => {
                if (row[key] && row[key] !== '-') {
                    // 複数店舗は/で区切られている
                    view.clinicStores[key] = row[key].split('/');
                }
            });
            
            // 056のデータをデバッグ
            if (row.parameter_no === '056') {
            }
            
            return view;
        });
        
    }

    // キャンペーンデータの読み込み
    async loadCampaigns() {
        const data = await this.loadCsvFile('出しわけSS - campaigns.csv');
        this.campaigns = data.map(row => ({
            id: row.campaign_id,
            regionId: row.region_id,
            clinicId: row.clinic_id,
            title: row.title,
            headerText: row.header_text,
            logoSrc: row.logo_src,
            logoAlt: row.logo_alt,
            description: row.description,
            ctaText: row.cta_text,
            ctaUrl: row.cta_url,
            footerText: row.footer_text
        }));
    }

    // 店舗と地域の関連付け
    associateStoresWithRegions() {
        this.stores.forEach(store => {
            // 住所から地域を判断
            for (const region of this.regions) {
                if (store.address.includes(region.name)) {
                    store.regionId = region.id;
                    break;
                }
            }
        });
    }

    // 全地域を取得
    getAllRegions() {
        return this.regions;
    }

    // 全クリニックを取得
    getAllClinics() {
        return this.clinics;
    }
    
    // クリニックIDでクリニックを取得
    getClinicById(clinicId) {
        // 文字列と数値の両方に対応
        return this.clinics.find(c => c.id == clinicId);
    }

    // 地域IDで地域を取得
    getRegionById(regionId) {
        // region_id=000の場合は「全国」を返す（data copyには存在する）
        if (regionId === '000' || regionId === '0') {
            // まずregions配列から探す
            const zenkoku = this.regions.find(r => r.id === '0' || r.id === '000');
            if (zenkoku) return zenkoku;
            // 見つからない場合はハードコードで返す
            return { id: '000', name: '全国', parentId: null };
        }
        
        // Try both padded and unpadded formats
        const paddedId = String(regionId).padStart(3, '0');
        const unpaddedId = String(parseInt(regionId, 10));
        
        // data copyには非パディング形式で保存されている可能性が高い
        return this.regions.find(r => 
            r.id === unpaddedId || 
            r.id === paddedId || 
            r.id === String(regionId)
        );
    }

    // クリニックIDでクリニックコードを取得
    getClinicCodeById(clinicId) {
        const clinic = this.clinics.find(c => c.id === String(clinicId));
        return clinic ? clinic.code : null;
    }

    // 地域IDとエレメントIDでサイトテキストを取得（旧）
    getSiteText(regionId, elementId, defaultText = '') {
        if (this.siteTexts && this.siteTexts[regionId] && this.siteTexts[regionId][elementId]) {
            return this.siteTexts[regionId][elementId];
        }
        return defaultText;
    }

    // 共通テキストを取得（プレースホルダー置換機能付き）
    getCommonText(itemKey, defaultText = '', placeholders = {}) {
        let text = defaultText;
        if (this.commonTexts && this.commonTexts[itemKey]) {
            text = this.commonTexts[itemKey];
            // ログが多すぎる場合はコメントアウト
            // console.log(`✅ 共通テキスト使用: ${itemKey} = "${text}"`);
        } else {
            // ログが多すぎる場合はコメントアウト
            // console.log(`⚠️ 共通テキストが見つかりません: ${itemKey}, デフォルト値使用: "${defaultText}"`);
        }
        
        // プレースホルダーを置換
        Object.keys(placeholders).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            text = text.replace(regex, placeholders[key]);
        });
        
        return text;
    }

    // 比較表ヘッダー設定を取得（clinic-texts.jsonの「比較表ヘッダー設定」を動的参照）
    getClinicHeaderConfig() {
        if (this.clinicTexts && this.clinicTexts['比較表ヘッダー設定']) {
            return this.clinicTexts['比較表ヘッダー設定'];
        }
        return {};
    }
    
    // クリニックコードと項目名でクリニック別テキストを取得
    getClinicText(clinicCode, itemKey, defaultText = '') {
        
        // 比較表ヘッダー設定から動的にフィールド名を取得
        let actualItemKey = itemKey;
        
        // comparison1-9の場合は、比較表ヘッダー設定から実際のフィールド名を取得
        if (itemKey.startsWith('comparison')) {
            const headerConfig = this.clinicTexts && this.clinicTexts['比較表ヘッダー設定'];
            if (headerConfig) {
                const comparisonNum = itemKey.replace('comparison', '');
                const headerKey = `比較表ヘッダー${comparisonNum}`;
                if (headerConfig[headerKey]) {
                    actualItemKey = headerConfig[headerKey];
                }
            }
        }
        
        // クリニックコードからクリニック名を取得
        // コードマッピング（clinic-texts.jsonの実際のクリニックコードに合わせて修正）
        const codeToNameMap = {
            'omt': 'Oh my teeth',
            'Oh my teeth': 'Oh my teeth',  // 直接名前が来た場合もサポート
            'zenyum': 'ゼニュム',
            'ゼニュム': 'ゼニュム',
            'kireiline': 'キレイライン矯正',  // 正しいコードに修正
            'キレイライン矯正': 'キレイライン矯正',
            'ws': 'ウィスマイル',
            'ウィスマイル': 'ウィスマイル',
            'invsalign': 'インビザライン',  // 正しいコードに修正
            'インビザライン': 'インビザライン'
        };
        
        // まずマッピングをチェック
        let clinicName = codeToNameMap[clinicCode];
        
        // マッピングになければ、clinicsから探す
        if (!clinicName) {
            const clinic = this.clinics.find(c => c.code === clinicCode);
            clinicName = clinic ? clinic.name : null;
        }
        
        
        if (clinicName && this.clinicTexts && this.clinicTexts[clinicName] && this.clinicTexts[clinicName][actualItemKey]) {
            const value = this.clinicTexts[clinicName][actualItemKey];
            return value;
        }
        
        // デバッグ用（本番環境では削除）
        if (clinicName && (!this.clinicTexts[clinicName])) {
            console.warn(`No clinic texts found for: ${clinicName}`);
        } else if (actualItemKey.includes('POINT') || actualItemKey === 'INFORMATIONサブテキスト' || actualItemKey === '費用' || actualItemKey === 'コスト') {
            console.warn(`⚠️ ${actualItemKey} not found for ${clinicName}, using default: "${defaultText}"`);
        }
        
        return defaultText;
    }

    // クリニック評価を取得する関数
    getClinicRating(clinicCode, defaultRating = 4.5) {
        const rating = this.getClinicText(clinicCode, '総合評価', defaultRating.toString());
        return parseFloat(rating) || defaultRating;
    }

    // クリニック名を取得する関数
    getClinicName(clinicCode, defaultName = 'クリニック') {
        return this.getClinicText(clinicCode, 'クリニック名', defaultName);
    }

    // decoタグを処理してHTMLに変換する関数
    processDecoTags(text) {
        if (!text || typeof text !== 'string') return text;
        
        // <deco>タグを<span class="deco-text">に変換
        return text.replace(/<deco>(.*?)<\/deco>/g, '<span class="deco-text">$1</span>');
    }

    // クリニックの口コミデータを動的に取得
    getClinicReviews(clinicCode) {
        const reviews = {
            cost: [], // コスパタブの口コミ
            access: [], // 通いやすさタブの口コミ
            staff: [] // スタッフタブの口コミ
        };
        
        // コスパタブの口コミ（3つ）
        for (let i = 1; i <= 3; i++) {
            const title = this.getClinicText(clinicCode, `口コミ${i}タイトル（コスパ）`, '');
            const content = this.getClinicText(clinicCode, `口コミ${i}内容（コスパ）`, '');
            if (title && content) {
                reviews.cost.push({ title, content });
            }
        }
        
        // 通いやすさタブの口コミ（3つ）
        for (let i = 1; i <= 3; i++) {
            const title = this.getClinicText(clinicCode, `口コミ${i}タイトル（通いやすさ）`, '');
            const content = this.getClinicText(clinicCode, `口コミ${i}内容（通いやすさ）`, '');
            if (title && content) {
                reviews.access.push({ title, content });
            }
        }
        
        // スタッフタブの口コミ（3つ）
        for (let i = 1; i <= 3; i++) {
            const title = this.getClinicText(clinicCode, `口コミ${i}タイトル（スタッフ）`, '');
            const content = this.getClinicText(clinicCode, `口コミ${i}内容（スタッフ）`, '');
            if (title && content) {
                reviews.staff.push({ title, content });
            }
        }
        
        return reviews;
    }
    
    // 地域名を取得
    getRegionName(regionId) {
        const region = this.getRegionById(regionId);
        return region ? region.name : '';
    }
    
    // 店舗画像パスを取得
    getStoreImage(clinicCode, storeNumber) {
        // クリニックの設定に基づいて画像パスを動的に決定
        const clinic = this.clinics?.find(c => c.code === clinicCode);
        if (clinic) {
            // クリニック固有の画像設定がある場合はそれを使用
            const customImagePath = this.getClinicText(clinicCode, '店舗画像パス', '');
            if (customImagePath) {
                return customImagePath;
            }
        }
        
        // デフォルトの画像パス生成
        const paddedNumber = String(storeNumber).padStart(3, '0');
        return `/images/clinics/${clinicCode}/${clinicCode}_clinic/clinic_image_${paddedNumber}.webp`;
    }
    
    // Google Maps iframeを生成
    generateMapIframe(address) {
        if (!address) {
            return '<p>住所情報がありません</p>';
        }
        
        // 住所をエンコード
        const encodedAddress = encodeURIComponent(address);
        
        // Google Maps Embed APIのURL
        const mapUrl = `https://maps.google.com/maps?q=${encodedAddress}&output=embed&z=16`;
        
        return `
            <iframe src="${mapUrl}" width="100%" height="300" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Google Maps">
            </iframe>
        `;
    }
    
    // 店舗表示のHTML生成（medical-diet001スタイル）
    generateStoresDisplay(clinicId, regionId, providedStores = null) {
        // クリニックコードを取得
        const clinicCode = this.getClinicCodeById(clinicId);
        if (!clinicCode) {
            return '<div class="shops"><p class="no-stores">店舗情報がありません</p></div>';
        }
        
        // ランキング情報を取得してランクを特定
        const ranking = this.getRankingByRegionId(regionId);
        let rank = 1; // デフォルト値
        if (ranking && ranking.ranks) {
            // clinicIdからランクを取得
            for (const [position, id] of Object.entries(ranking.ranks)) {
                if (id === clinicId) {
                    rank = parseInt(position);
                    break;
                }
            }
        }
        
        // 遷移先URLを直接取得
        const urlFieldName = `遷移先URL（${rank}位）`;
        let targetUrl = this.getClinicText(clinicCode, urlFieldName, '');
        
        if (!targetUrl) {
            // フォールバック：1位のURLを使用
            targetUrl = this.getClinicText(clinicCode, '遷移先URL（1位）', '');
        }
        
        // 店舗データを取得（提供されたデータか、既存のメソッドから取得）
        const storeData = providedStores || this.getStoreDataForClinic(clinicCode, regionId);
        if (!storeData || storeData.length === 0) {
            return '<div class="shops"><p class="no-stores">この地域には店舗がありません</p></div>';
        }
        
        const visibleStores = storeData.slice(0, 3);
        const hiddenStores = storeData.slice(3);
        const storeId = `shops-${Date.now()}`; // ユニークなIDを生成
        
        let html = `<div class="shops" id="${storeId}">`;
        
        // 最初の3店舗を表示
        visibleStores.forEach((store, index) => {
            const storeName = store.name || store.storeName || '店舗名不明';
            const storeAddress = store.address || '住所情報なし';
            
            // ハッシュフラグメントを使用（サーバーのURL書き換えに影響されない）
            const redirectUrl = `./redirect.html#clinic_id=${clinicId}&rank=${rank}&region_id=${regionId}`;
            
            // localStorageを先に設定してから開く（サーバーがパラメータを削除する場合の対策）
            const onclickHandler = targetUrl ? 
                `onclick="localStorage.setItem('redirectParams', JSON.stringify({clinic_id: '${clinicId}', rank: '${rank}', region_id: '${regionId}'})); setTimeout(() => { window.open('${redirectUrl}', '_blank'); }, 10); return false;"` : '';
            
            html += `
                <div class='shop'>
                    <div class='shop-image'>
                        <img src="${this.getStoreImage(clinicCode, index + 1)}" alt="${storeName}" onerror="this.src='${this.getClinicLogoPath(clinicCode)}'" />
                    </div>
                    <div class='shop-info'>
                        <div class='shop-name'>
                            <a href="#" ${onclickHandler} style="cursor: pointer;">${storeName}</a>
                        </div>
                        <div class='shop-address line-clamp'>
                            ${storeAddress}
                        </div>
                    </div>
                    <a class="shop-btn map-toggle-btn" href="javascript:void(0);" data-store-id="${storeId}-${index}">
                        <i class='fas fa-map-marker-alt btn-icon'></i>
                        地図
                    </a>
                </div>
            `;
        });
        
        // 4店舗以上ある場合は隠しコンテンツとして追加
        hiddenStores.forEach((store, index) => {
            const storeName = store.name || store.storeName || '店舗名不明';
            const storeAddress = store.address || '住所情報なし';
            
            // ハッシュフラグメントを使用（サーバーのURL書き換えに影響されない）
            const redirectUrl = `./redirect.html#clinic_id=${clinicId}&rank=${rank}&region_id=${regionId}`;
            
            // localStorageを先に設定してから開く（サーバーがパラメータを削除する場合の対策）
            const onclickHandler = targetUrl ? 
                `onclick="localStorage.setItem('redirectParams', JSON.stringify({clinic_id: '${clinicId}', rank: '${rank}', region_id: '${regionId}'})); setTimeout(() => { window.open('${redirectUrl}', '_blank'); }, 10); return false;"` : '';
            
            html += `
                <div class='shop hidden-content hidden'>
                    <div class='shop-image'>
                        <img src="${this.getStoreImage(clinicCode, index + 4)}" alt="${storeName}" onerror="this.src='${this.getClinicLogoPath(clinicCode)}'" />
                    </div>
                    <div class='shop-info'>
                        <div class='shop-name'>
                            <a href="#" ${onclickHandler} style="cursor: pointer;">${storeName}</a>
                        </div>
                        <div class='shop-address line-clamp'>
                            ${storeAddress}
                        </div>
                    </div>
                    <a class="shop-btn map-toggle-btn" href="javascript:void(0);" data-store-id="${storeId}-${index + 3}">
                        <i class='fas fa-map-marker-alt btn-icon'></i>
                        地図
                    </a>
                </div>
            `;
        });
        
        // もっと見るボタン
        if (hiddenStores.length > 0) {
            html += `
                <button class="more-button" data-target="#${storeId}" onclick="toggleStores(this)"><span class="button-text">他${hiddenStores.length}件のクリニックを見る</span></button>
            `;
        }
        
        html += '</div>';
        
        return html;
    }
    
    // クリニックの店舗データを取得（地域別）
    getStoreDataForClinic(clinicCode, regionId) {
        // store_viewから該当地域のデータを取得
        const storeView = this.storeViews.find(sv => sv.regionId === regionId);
        if (!storeView) return [];
        
        // ランキングデータを取得して、表示されているクリニックを特定
        const ranking = this.getRankingByRegionId(regionId);
        if (!ranking) return [];
        
        // クリニックコードからクリニックIDを動的に取得
        const clinic = this.clinics.find(c => c.code === clinicCode);
        if (!clinic) return [];
        
        const clinicId = clinic.id;
        if (!clinicId) return [];
        
        // 新しいヘッダー構造: クリニックコードベースのキー（dio_stores, eminal_stores等）
        const clinicKey = `${clinicCode}_stores`;
        
        const storeIdsToShow = storeView.clinicStores[clinicKey] || [];
        
        if (storeIdsToShow.length === 0) return [];
        
        // 店舗IDに基づいて実際の店舗情報を取得
        const allStoreIds = [];
        storeIdsToShow.forEach(storeId => {
            if (storeId.includes('/')) {
                // dio_009/dio_010 のような形式を分割
                const ids = storeId.split('/');
                allStoreIds.push(...ids);
            } else {
                allStoreIds.push(storeId);
            }
        });
        
        const result = this.stores.filter(store => 
            allStoreIds.includes(store.id)
        );
        
        // 結果を適切な形式に変換
        return result.map(store => ({
            name: store.storeName || store.name,
            address: store.address,
            access: store.access || '主要駅より徒歩圏内',
            hours: this.getClinicText(clinicCode, '営業時間', '10:00〜19:00')
        }));
    }
    
    // 地域に応じた住所を生成
    generateAddressForRegion(regionId, defaultAddress = '') {
        const region = this.getRegionById(regionId);
        if (!region) {
            return defaultAddress || '住所情報準備中';
        }
        
        return addressPatterns[regionId] || `${region.name}の主要エリア内`;
    }

    // クリニックロゴパスを取得
    getClinicLogoPath(clinicCode) {
        // キレイラインの特別処理
        const logoFolder = clinicCode === 'kireil' ? 'kireiline' : clinicCode;
        return this.getClinicText(clinicCode, 'クリニックロゴ画像パス', `../common_data/images/clinics/${logoFolder}/${logoFolder}-logo.webp`);
    }

    // クリニック詳細データを動的に取得
    getClinicDetailData(clinicId) {
        const clinic = this.getClinicById(clinicId);
        if (!clinic) return null;
        
        const clinicCode = clinic.code;
        const clinicName = clinic.name;
        
        // 詳細フィールドマッピングを取得
        const fieldMapping = this.clinicTexts['詳細フィールドマッピング'] || {};
        
        // priceDetailを動的に生成
        const priceDetail = {};
        
        // 日本語の表示名マッピング（詳細セクションの価格表用）
        const displayNameMap = {
            'priceDetail': '費用',
            'periods': '目安期間',
            'ranges': '矯正範囲',
            'hours': '営業時間',
            'stores': '店舗',
            'officialSite': '公式サイト'
        };
        
        // マッピングに基づいて動的にフィールドを設定
        Object.entries(fieldMapping).forEach(([displayKey, csvKey]) => {
            // 日本語の表示名を取得
            const japaneseKey = displayNameMap[displayKey] || displayKey;
            
            // 公式サイトURLは詳細_プレフィックスなし、それ以外は詳細_プレフィックス付き
            let detailValue;
            if (csvKey === '公式サイトURL') {
                detailValue = this.getClinicText(clinicCode, csvKey, '');
            } else {
                detailValue = this.getClinicText(clinicCode, `詳細_${csvKey}`, '');
            }
            
            // 値を設定
            priceDetail[japaneseKey] = detailValue;
        });
        
        // clinic-texts.jsonから詳細データを動的に構築
        const detailData = {
            title: this.getClinicText(clinicCode, '詳細タイトル', '医療痩せプログラム'),
            subtitle: this.getClinicText(clinicCode, '詳細サブタイトル', '効果的な痩身治療'),
            link: `${clinicName} ＞`,
            banner: this.getClinicText(clinicCode, '詳細バナー画像パス', (() => {
                const bannerFolder = clinicCode === 'kireil' ? 'kireiline' : clinicCode;
                return `../common_data/images/clinics/${bannerFolder}/${bannerFolder}_detail_bnr.webp`;
            })()),
            features: (() => {
                const tagsText = this.getClinicText(clinicCode, '詳細_特徴タグ', '# 医療ダイエット<br># 医療痩身<br># リバウンド防止');
                // <br>で分割し、#と空白を削除
                return tagsText.split('<br>').map(tag => tag.replace(/^#\s*/, '').trim()).filter(tag => tag);
            })(),
            priceMain: this.getClinicText(clinicCode, '人気プラン', '医療痩身コース'),
            priceValue: (() => {
                // 料金フィールドから月々の金額を抽出
                const ryokin = this.getClinicText(clinicCode, '料金', '月々4,900円');
                const match = ryokin.match(/月々[\d,]+円/);
                return match ? match[0] : '月々4,900円';
            })(),
            priceDetail: priceDetail, // 動的に生成されたpriceDetailを使用
            points: [
                {
                    icon: 'lightbulb',
                    title: this.getClinicText(clinicCode, 'POINT1タイトル', 'ポイント1'),
                    description: this.getClinicText(clinicCode, 'POINT1内容', '詳細説明1')
                },
                {
                    icon: 'phone',
                    title: this.getClinicText(clinicCode, 'POINT2タイトル', 'ポイント2'),
                    description: this.getClinicText(clinicCode, 'POINT2内容', '詳細説明2')
                },
                {
                    icon: 'coin',
                    title: this.getClinicText(clinicCode, 'POINT3タイトル', 'ポイント3'),
                    description: this.getClinicText(clinicCode, 'POINT3内容', '詳細説明3')
                }
            ]
        };
        
        return detailData;
    }

    // 現在選択されているクリニックを判定する関数
    getCurrentClinic() {
        // URLパラメータから判定
        const urlParams = new URLSearchParams(window.location.search);
        const clinicParam = urlParams.get('clinic');
        if (clinicParam) {
            return clinicParam;
        }

        // 地域の1位クリニックをデフォルトとして使用
        const currentRegionId = this.getCurrentRegionId();
        const ranking = this.getRankingByRegionId(currentRegionId);
        if (ranking && ranking.ranks && ranking.ranks.no1) {
            const topClinicId = ranking.ranks.no1;
            // getClinicCodeByIdを使用して動的に取得
            const clinicCode = this.getClinicCodeById(topClinicId);
            if (clinicCode) return clinicCode;
        }
        
        // デフォルトは最初のクリニックのコードを使用
        const firstClinic = this.clinics && this.clinics[0];
        return firstClinic ? firstClinic.code : '';
    }

    // 現在の地域IDを取得
    getCurrentRegionId() {
        // URLパラメータから取得
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('region_id') || '000'; // デフォルトは全国
    }

    // 地域IDをマッピング（存在しない地域を適切な地域にマッピング）
    mapRegionId(regionId) {
        // 正規化（3桁にパディング）
        const paddedRegionId = String(regionId).padStart(3, '0');
        const unpaddedRegionId = String(parseInt(regionId, 10));
        
        // まず、実際にregions配列に存在するかチェック
        const existsInRegions = this.regions.find(r => 
            r.id === paddedRegionId || 
            r.id === unpaddedRegionId || 
            r.id === String(regionId)
        );
        
        // 実際のデータが存在する場合は、その地域IDを返す
        if (existsInRegions) {
            // ランキングデータが存在するかもチェック
            const hasRanking = this.rankings.find(r => 
                r.regionId === paddedRegionId || 
                r.regionId === unpaddedRegionId || 
                r.regionId === String(regionId)
            );
            
            if (hasRanking) {
                // ランキングデータが存在する場合はその地域IDを返す
                return hasRanking.regionId;
            }
            
            // 地域は存在するがランキングがない場合は、マッピングを行う
            console.log(`Region ${regionId} exists but has no ranking data, will map to another region`);
        }
        
        // 000は全国版
        if (regionId === '000' || regionId === '0' || String(regionId) === '0') {
            return '000';
        }
        
        // 地域コード別のマッピング（ランキングデータがない地域用）
        const regionMapping = {
            // 北海道・東北
            '001': '013', // 北海道 → 東京
            '002': '013', // 青森 → 東京
            '003': '013', // 岩手 → 東京
            '004': '013', // 宮城 → 東京
            '005': '013', // 秋田 → 東京
            '006': '013', // 山形 → 東京
            '007': '013', // 福島 → 東京
            
            // 関東（存在しないもの）
            '008': '013', // 茨城 → 東京
            '009': '013', // 栃木 → 東京
            '010': '013', // 群馬 → 東京
            '015': '013', // 新潟 → 東京
            
            // 中部
            '016': '023', // 富山 → 愛知
            '017': '023', // 石川 → 愛知
            '018': '023', // 福井 → 愛知
            '019': '023', // 山梨 → 愛知
            '020': '023', // 長野 → 愛知
            '021': '023', // 岐阜 → 愛知
            '022': '023', // 静岡 → 愛知
            
            // 関西
            '024': '027', // 三重 → 大阪
            '025': '027', // 滋賀 → 大阪
            '026': '027', // 京都 → 大阪
            '029': '027', // 奈良 → 大阪
            '030': '027', // 和歌山 → 大阪
            
            // 中国・四国
            '031': '027', // 鳥取 → 大阪
            '032': '027', // 島根 → 大阪
            '033': '028', // 岡山 → 兵庫
            '034': '028', // 広島 → 兵庫
            '035': '028', // 山口 → 兵庫
            '036': '027', // 徳島 → 大阪
            '037': '027', // 香川 → 大阪
            '038': '027', // 愛媛 → 大阪
            '039': '027', // 高知 → 大阪
            
            // 九州・沖縄
            '041': '040', // 佐賀 → 福岡
            '042': '040', // 長崎 → 福岡
            '043': '040', // 熊本 → 福岡
            '044': '040', // 大分 → 福岡
            '045': '040', // 宮崎 → 福岡
            '046': '040', // 鹿児島 → 福岡
            '047': '040', // 沖縄 → 福岡
        };
        
        // マッピングが存在する場合
        if (regionMapping[paddedRegionId]) {
            console.log(`Region ${regionId} mapped to ${regionMapping[paddedRegionId]}`);
            return regionMapping[paddedRegionId];
        }
        
        // それでも見つからない場合は東京にフォールバック
        console.warn(`Unknown region ID: ${regionId}, falling back to Tokyo (013)`);
        return '013';
    }

    // 地域IDでランキングを取得
    getRankingByRegionId(regionId) {
        // 地域IDをマッピング
        const mappedRegionId = this.mapRegionId(regionId);
        
        // 全国版（000）の場合は東京（013）のランキングを使用
        // 北海道（001）の場合も東京（013）にフォールバック
        let targetRegionId = mappedRegionId;
        if (mappedRegionId === '000' || mappedRegionId === '001') {
            targetRegionId = '013';
        }
        
        // データ構造がオブジェクト形式なので直接参照
        const paddedRegionId = String(targetRegionId).padStart(3, '0');
        
        // rankingsオブジェクトから直接取得（Object.entries変換後のデータ構造に対応）
        let ranking = this.rankings.find(r => r.regionId === paddedRegionId);
        if (!ranking) {
            // フォールバック: パディングなしでも検索
            ranking = this.rankings.find(r => r.regionId === String(targetRegionId));
        }
        
        // 見つからない場合は東京にフォールバック
        if (!ranking) {
            console.warn(`⚠️ region_id ${regionId} (mapped to ${targetRegionId}) のランキングが見つかりません。東京（013）にフォールバックします。`);
            ranking = this.rankings.find(r => r.regionId === '013');
        }
        
        return ranking;
    }

    // 地域IDで店舗を取得（store_viewデータを使用してランキングに対応した店舗を取得）
    getStoresByRegionId(regionId) {
        // 地域IDをマッピング（000→013, 001→013など）
        const mappedRegionId = this.mapRegionId(regionId);
        
        // store_viewから該当地域のデータを取得
        // storeViewsは3桁パディング形式で保存されている
        let storeView = this.storeViews.find(sv => sv.regionId === mappedRegionId);
        
        // 見つからない場合は、非パディング形式でも検索
        if (!storeView) {
            const normalizedRegionId = String(parseInt(mappedRegionId, 10));
            storeView = this.storeViews.find(sv => sv.regionId === normalizedRegionId);
        }
        
        if (!storeView) {
            console.warn(`⚠️ region_id ${regionId} (mapped to ${mappedRegionId}) の店舗ビューが見つかりません。`);
            return [];
        }
        
        // ランキングデータを取得して、表示されているクリニックを特定
        const ranking = this.getRankingByRegionId(regionId);
        
        if (!ranking) {
            console.warn(`⚠️ region_id ${regionId} のランキングが見つかりません。`);
            return [];
        }
        
        // 表示する店舗IDのリストを作成
        const storeIdsToShow = [];
        
        // ランキングに表示されているクリニックIDに対応する店舗IDを取得
        // 新しい構造: クリニックコードベースのキー（dio_stores, sbc_stores等）
        Object.entries(ranking.ranks).forEach(([position, clinicId]) => {
            // クリニックIDからクリニックを取得
            const clinic = this.clinics.find(c => c.id === clinicId);
            if (!clinic) {
                console.warn(`  ⚠️ Clinic not found for ID: ${clinicId}`);
                return;
            }
            
            // クリニックコードから対応するキーを作成
            const clinicKey = `${clinic.code}_stores`;
            
            if (storeView.clinicStores[clinicKey]) {
                storeIdsToShow.push(...storeView.clinicStores[clinicKey]);
            } else {
                console.warn(`  ⚠️ No stores found for key: ${clinicKey} in region ${mappedRegionId}`);
            }
        });
        
        // 店舗IDに基づいて実際の店舗情報を取得
        // アンダースコアで区切られた複数店舗IDを処理
        const allStoreIds = [];
        
        storeIdsToShow.forEach(storeId => {
            if (storeId.includes('/')) {
                // dio_009/dio_010 のような形式を分割
                const ids = storeId.split('/');
                allStoreIds.push(...ids);
            } else {
                allStoreIds.push(storeId);
            }
        });
        
        
        const result = this.stores.filter(store => 
            allStoreIds.includes(store.id)
        );
        
        return result;
    }

    // クリニック名で店舗を取得
    getStoresByClinicName(clinicName) {
        return this.stores.filter(s => s.clinicName === clinicName);
    }

    // 地域IDとクリニック名で店舗を取得
    getStoresByRegionAndClinic(regionId, clinicName) {
        return this.stores.filter(s => 
            s.regionId === regionId && s.clinicName === clinicName
        );
    }

    // 地域IDでキャンペーンを取得
    getCampaignsByRegionId(regionId) {
        return this.campaigns.filter(c => c.regionId === regionId);
    }

    // 地域IDとクリニックIDでキャンペーンを取得
    getCampaignByRegionAndClinic(regionId, clinicId) {
        return this.campaigns.find(c => 
            c.regionId === regionId && c.clinicId === clinicId
        );
    }
}

// アプリケーションクラス
class RankingApp {
    constructor() {
        this.urlHandler = new UrlParamHandler();
        this.displayManager = new DisplayManager(this.urlHandler);
        this.dataManager = null;
        this.currentRegionId = null;
        this.textsInitialized = false;
    }

    async init() {
        try {
            // データマネージャーの初期化
            this.dataManager = new DataManager();
            await this.dataManager.init();
            
            // グローバルアクセス用にwindowオブジェクトに設定
            window.dataManager = this.dataManager;
            window.urlHandler = this.urlHandler;
            

            // 初期地域IDの取得（URLパラメータから取得、なければデフォルト）
            this.currentRegionId = this.urlHandler.getRegionId();

            // 地域セレクターの初期化
            const regions = this.dataManager.getAllRegions();
            this.displayManager.updateRegionSelector(regions, this.currentRegionId);

            // イベントリスナーの設定
            this.setupEventListeners();

            // 初期表示の更新
            this.updatePageContent(this.currentRegionId);
            
            // 地図モーダルの設定
            setTimeout(() => {
                this.setupMapAccordions();
            }, 100);
        } catch (error) {
            this.displayManager.showError('データの読み込みに失敗しました。ページを再読み込みしてください。');
        }
    }

    setupEventListeners() {
        // 地域選択の変更イベント（検索フィルター用）
        if (this.displayManager.regionSelect) {
            this.displayManager.regionSelect.addEventListener('change', () => {
                this.handleClinicSearch(this.displayManager.searchInput?.value || '');
            });
        }

        // クリニック名検索機能
        if (this.displayManager.searchInput) {
            this.displayManager.searchInput.addEventListener('input', (e) => {
                this.handleClinicSearch(e.target.value);
            });
        }
        
        // 対応部位フィルター
        const specialtyFilter = document.getElementById('sidebar-specialty-filter');
        if (specialtyFilter) {
            specialtyFilter.addEventListener('change', () => {
                this.handleClinicSearch(this.displayManager.searchInput?.value || '');
            });
        }
        
        // 店舗数フィルター
        const hoursFilter = document.getElementById('sidebar-hours-filter');
        if (hoursFilter) {
            hoursFilter.addEventListener('change', () => {
                this.handleClinicSearch(this.displayManager.searchInput?.value || '');
            });
        }

        // サイドバー検索ボタンのイベント
        const sidebarSearchButton = document.querySelector('.sidebar-search-link');
        if (sidebarSearchButton) {
            sidebarSearchButton.addEventListener('click', (e) => {
                e.preventDefault();
                
                // フィルター値を取得
                const params = new URLSearchParams();
                
                // 地域（検索フィルター用）
                const regionFilter = document.getElementById('sidebar-region-select');
                if (regionFilter && regionFilter.value) {
                    params.append('search-region', regionFilter.value);
                }
                
                // クリニック名
                const clinicSearch = document.getElementById('sidebar-clinic-search');
                if (clinicSearch && clinicSearch.value) {
                    params.append('clinic', clinicSearch.value);
                }
                
                // 対応部位
                const specialtyFilter = document.getElementById('sidebar-specialty-filter');
                if (specialtyFilter && specialtyFilter.value) {
                    params.append('bodyPart', specialtyFilter.value);
                }
                
                // 店舗数
                const hoursFilter = document.getElementById('sidebar-hours-filter');
                if (hoursFilter && hoursFilter.value) {
                    params.append('storeCount', hoursFilter.value);
                }
                
                // 現在のregion_idを追加
                params.append('region_id', this.currentRegionId);
                
                // 検索結果ページへ遷移
                const basePath = window.SITE_CONFIG ? window.SITE_CONFIG.basePath : '';
                const searchUrl = `${basePath}/search-results.html?${params.toString()}`;
                window.location.href = searchUrl;
            });
        }
        
        // ハンバーガーメニューのイベント
        
        if (this.displayManager.hamburgerMenu) {
            this.displayManager.hamburgerMenu.addEventListener('click', (e) => {
                e.stopPropagation(); // イベントの伝播を停止
                
                this.displayManager.hamburgerMenu.classList.toggle('active');
                this.displayManager.sidebarMenu.classList.toggle('active');
                this.displayManager.sidebarOverlay.classList.toggle('active');
            });
        } else {
        }

        // サイドバーを閉じる
        if (this.displayManager.closeSidebar) {
            this.displayManager.closeSidebar.addEventListener('click', () => {
                this.displayManager.hamburgerMenu.classList.remove('active');
                this.displayManager.sidebarMenu.classList.remove('active');
                this.displayManager.sidebarOverlay.classList.remove('active');
            });
        }

        // オーバーレイクリックで閉じる
        if (this.displayManager.sidebarOverlay) {
            this.displayManager.sidebarOverlay.addEventListener('click', () => {
                this.displayManager.hamburgerMenu.classList.remove('active');
                this.displayManager.sidebarMenu.classList.remove('active');
                this.displayManager.sidebarOverlay.classList.remove('active');
            });
        }

        // 地図アコーディオンの開閉制御 - モーダル表示に変更したため無効化
        /*
        document.addEventListener('click', function(e) {
            if (e.target.matches('.map-toggle-btn') || e.target.closest('.map-toggle-btn')) {
                const button = e.target.matches('.map-toggle-btn') ? e.target : e.target.closest('.map-toggle-btn');
                const storeId = button.getAttribute('data-store-id');
                const mapElement = document.getElementById(`map-${storeId}`);
                
                if (mapElement) {
                    if (mapElement.style.display === 'none' || mapElement.style.display === '') {
                        mapElement.style.display = 'block';
                        button.classList.add('active');
                    } else {
                        mapElement.style.display = 'none';
                        button.classList.remove('active');
                    }
                }
                e.preventDefault();
            }
        });
        */

        // ブラウザの戻る/進むボタン対応（region_idは使用しない）
        /*
        window.addEventListener('popstate', () => {
            const regionId = this.urlHandler.getRegionId();
            if (regionId !== this.currentRegionId) {
                this.updatePageContent(regionId);
                this.displayManager.regionSelect.value = regionId;
            }
        });
        */
    }

    changeRegion(regionId) {
        // URLパラメータの更新はしない（region_idを付与しない）
        // this.urlHandler.updateRegionId(regionId);
        this.currentRegionId = regionId;

        // ページコンテンツの更新
        this.updatePageContent(regionId);
    }

    // 指定地域にクリニックの店舗があるかチェック
    getClinicStoresByRegion(clinicName, regionId) {
        // クリニック名を正規化
        const normalizedClinicName = clinicName.replace(/の\d+$/, '').trim(); // 「ディオクリニックの1」→「ディオクリニック」
        
        // 該当地域の店舗を取得
        const regionStores = this.dataManager.getStoresByRegionId(regionId);
        
        // クリニック名はそのまま使用（マッピング不要）
        const storeClinicName = normalizedClinicName;
        
        // 該当するクリニックの店舗をフィルタリング
        return regionStores.filter(store => store.clinicName === storeClinicName);
    }

    // クリニック検索処理
    handleClinicSearch(searchTerm) {
        const searchTermLower = searchTerm.toLowerCase().trim();
        
        // フィルター条件を取得
        const regionFilter = document.getElementById('sidebar-region-select')?.value || '';
        const specialtyFilter = document.getElementById('sidebar-specialty-filter')?.value || '';
        const hoursFilter = document.getElementById('sidebar-hours-filter')?.value || '';

        // ランキングカードの検索
        const rankingItems = document.querySelectorAll('.ranking-item');
        let visibleRankingCount = 0;
        
        rankingItems.forEach(item => {
            const clinicNameElement = item.querySelector('.clinic-logo-section');
            const clinicName = clinicNameElement ? clinicNameElement.textContent.trim() : '';
            
            // クリニック名の条件
            const nameMatch = searchTermLower === '' || clinicName.toLowerCase().includes(searchTermLower);
            
            // 地域フィルタリングの条件
            let regionMatch = true;
            if (regionFilter) {
                // クリニックに対応する店舗が選択された地域にあるかチェック
                const clinicStores = this.getClinicStoresByRegion(clinicName, regionFilter);
                regionMatch = clinicStores.length > 0;
            }
            
            // フィルター条件の判定
            const specialtyMatch = specialtyFilter === '';
            const hoursMatch = hoursFilter === '';
            
            if (nameMatch && regionMatch && specialtyMatch && hoursMatch) {
                item.style.display = '';
                visibleRankingCount++;
            } else {
                item.style.display = 'none';
            }
        });

        // テーブル内の行を検索（すべてのタブ）
        const allTableRows = document.querySelectorAll('#ranking-tbody tr, #treatment-tbody tr, #service-tbody tr');
        let visibleRowCount = 0;
        
        allTableRows.forEach(row => {
            const clinicName = row.querySelector('.clinic-main-name')?.textContent || '';
            
            // クリニック名の条件
            const nameMatch = searchTermLower === '' || clinicName.toLowerCase().includes(searchTermLower);
            
            // 地域フィルタリングの条件
            let regionMatch = true;
            if (regionFilter) {
                const clinicStores = this.getClinicStoresByRegion(clinicName, regionFilter);
                regionMatch = clinicStores.length > 0;
            }
            
            if (nameMatch && regionMatch) {
                row.style.display = '';
                visibleRowCount++;
            } else {
                row.style.display = 'none';
            }
        });

        // 詳細セクションの検索
        const detailItems = document.querySelectorAll('.detail-item');
        detailItems.forEach(item => {
            const clinicName = item.querySelector('.clinic-name')?.textContent || '';
            
            // クリニック名の条件
            const nameMatch = searchTermLower === '' || clinicName.toLowerCase().includes(searchTermLower);
            
            // 地域フィルタリングの条件
            let regionMatch = true;
            if (regionFilter) {
                const clinicStores = this.getClinicStoresByRegion(clinicName, regionFilter);
                regionMatch = clinicStores.length > 0;
            }
            
            if (nameMatch && regionMatch) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });

        // ランキングカードセクションの検索結果メッセージ
        const rankingList = document.getElementById('ranking-list');
        const existingMsg = document.getElementById('no-search-results');
        
        if (visibleRankingCount === 0 && searchTermLower !== '') {
            if (!existingMsg) {
                const noResultsMsg = document.createElement('div');
                noResultsMsg.id = 'no-search-results';
                noResultsMsg.className = 'empty-state';
                noResultsMsg.innerHTML = '<p>「' + searchTerm + '」に一致するクリニックが見つかりませんでした</p>';
                rankingList.appendChild(noResultsMsg);
            }
        } else if (existingMsg) {
            existingMsg.remove();
        }

        // テーブルの検索結果メッセージ
        const activeTabContent = document.querySelector('.tab-content.active tbody');
        const existingTableMsg = document.getElementById('no-search-results-row');
        
        if (visibleRowCount === 0 && searchTermLower !== '' && activeTabContent) {
            if (!existingTableMsg) {
                const noResultsRow = document.createElement('tr');
                noResultsRow.id = 'no-search-results-row';
                noResultsRow.innerHTML = '<td colspan="5" class="empty-state"><p>検索結果が見つかりませんでした</p></td>';
                activeTabContent.appendChild(noResultsRow);
            }
        } else if (existingTableMsg) {
            existingTableMsg.remove();
        }

    }

    updatePageContent(regionId) {
        try {
            
            // region_idを正規化（"014" → "14"のように、先頭の0を削除）
            const normalizedRegionId = String(parseInt(regionId, 10));
            
            // 地域IDマッピング（存在しない地域を適切な地域にマッピング）
            const mappedRegionId = this.dataManager.mapRegionId(regionId);
            
            let region;
            if (regionId === '000' || regionId === '0' || String(regionId) === '0') {
                // 全国版の場合は仮想的な地域データを作成（元のregionIdが000の場合）
                region = {
                    id: '000',
                    name: '全国',
                    parentId: null
                };
                console.log('Created 全国 region object:', region);
            } else {
                // 地域情報の取得
                region = this.dataManager.getRegionById(String(parseInt(mappedRegionId, 10)));
                if (!region) {
                    // それでも見つからない場合は東京にフォールバック
                    console.warn(`Region not found for mapped ID: ${mappedRegionId}, falling back to Tokyo`);
                    region = this.dataManager.getRegionById('13'); // 東京
                }
            }

            // 地域名の更新
            this.displayManager.updateSelectedRegionName(region.name);
            
            // 比較表の地域名も更新
            const comparisonRegionElement = document.getElementById('comparison-region-name');
            if (comparisonRegionElement) {
                comparisonRegionElement.textContent = region.name;
            }

            //MVの地域名も更新
            const mvRegionElement = document.getElementById('mv-region-name');
            if (mvRegionElement) {
                mvRegionElement.textContent = region.name;
            }

            //SVGの地域テキストも更新
            const mvRegionTextElement = document.getElementById('mv-region-text');
            if (mvRegionTextElement) {
                mvRegionTextElement.textContent = region.name;
            }

            //ランキング部の地域名も更新
            const rankRegionElement = document.getElementById('rank-region-name');
            if (rankRegionElement) {
                rankRegionElement.textContent = region.name;
            }

            //詳細セクションの地域名も更新
            const detailRegionElement = document.getElementById('detail-region-name');
            if (detailRegionElement) {
                detailRegionElement.textContent = region.name + 'で人気のクリニック';
                
                // 地域名の文字数に応じてleftの位置を調整
                const regionNameLength = region.name.length;
                let leftPosition = '3%'; // デフォルト値（3文字以上）
                
                if (regionNameLength === 2) {
                    leftPosition = '4%'; // 2文字（例：千葉、東京）
                } else if (regionNameLength === 3) {
                    leftPosition = '1%'; // 3文字（例：神奈川、埼玉）
                }
                
                detailRegionElement.style.left = leftPosition;
            }

            // サイト全体のテキストを動的に更新
            // updateAllTextsは比較表などの更新を行うが、地域名は既に設定済み
            if (!this.textsInitialized) {
                setTimeout(() => {
                    this.updateAllTexts(regionId); // 元のregionIdを渡す（000の場合の処理のため）
                    this.textsInitialized = true;
                    // updateAllTexts後に地域名を確実に設定（上書き防止のため強制的に再設定）
                    setTimeout(() => {
                        this.forceUpdateRegionNames(region);
                    }, 50);
                }, 100);
            } else {
                this.updateAllTexts(regionId); // 元のregionIdを渡す（000の場合の処理のため）
                // updateAllTexts後に地域名を確実に設定（上書き防止のため強制的に再設定）
                setTimeout(() => {
                    this.forceUpdateRegionNames(region);
                }, 50);
            }

            //ランキングの地域名も更新（共通テキストを使用）
            const rankRegionElement2 = document.getElementById('rank-region-name');
            if (rankRegionElement2) {
                // 共通テキストから後半部分を取得
                const rankingText = this.dataManager.getCommonText('ランキング地域名テキスト', 'で人気の脂肪溶解注射はココ！');
                const fullText = region.name + rankingText;
                rankRegionElement2.textContent = fullText;
                
                // 地域名の文字数に応じてleftの位置を調整
                const regionNameLength = region.name.length;
                let leftPosition = '52%'; // デフォルト値
                
                if (regionNameLength === 2) {
                    leftPosition = '52%'; // 2文字（例：東京）
                } else if (regionNameLength === 3) {
                    leftPosition = '51%'; // 3文字（例：神奈川）
                } else if (regionNameLength === 4) {
                    leftPosition = '50%'; // 4文字
                }
                
                rankRegionElement2.style.left = leftPosition;
            }
            
            // ランキングバナーのalt属性も動的に更新
            const rankingBannerImages = document.querySelectorAll('.ranking-banner-image');
            if (rankingBannerImages.length > 0) {
                const altText = this.dataManager.getCommonText('ランキングバナーAltテキスト', 'で人気の脂肪溶解注射はココ！');
                rankingBannerImages.forEach(img => {
                    img.alt = region.name + altText;
                });
            }

            // ランキングの取得と表示 (マッピングされた地域IDを使用)
            const ranking = this.dataManager.getRankingByRegionId(regionId);
            const allClinics = this.dataManager.getAllClinics();
            this.displayManager.updateRankingDisplay(allClinics, ranking);

            // フッターの人気クリニックを更新
            this.displayManager.updateFooterClinics(allClinics, ranking);

            // 店舗リストの取得と表示（クリニックごとにグループ化）
            // 店舗一覧表示は無効化（不要なUIのため）
            // const stores = this.dataManager.getStoresByRegionId(normalizedRegionId);
            // const clinicsWithStores = this.groupStoresByClinics(stores, ranking, allClinics);
            // this.displayManager.updateStoresDisplay(stores, clinicsWithStores);

            // 比較表ヘッダーの更新
            this.updateComparisonHeaders();
            
            // 比較表の更新
            this.updateComparisonTable(allClinics, ranking);
            
            // 比較表タブ機能の初期化
            this.setupComparisonTabs();
            
            // 詳細コンテンツの更新 (正規化されたIDを使用)
            this.updateClinicDetails(allClinics, ranking, normalizedRegionId);
            
            // 比較表の注釈を更新（1位〜5位）
            setTimeout(() => {
                initializeDisclaimers();
            }, 100);

            // 地図モーダルの設定
            setTimeout(() => {
                this.setupMapAccordions();
            }, 100);

            // エラーメッセージを隠す
            this.displayManager.hideError();
        } catch (error) {
            console.error('Error in updatePageContent:', error);
            this.displayManager.showError('データの表示に問題が発生しました。');
            
            // デフォルト地域にフォールバック
            if (regionId !== '000') {
                this.changeRegion('000');
            }
        }
    }

    // 地域名を復元（updateAllTexts後の上書き防止）
    restoreRegionNames(region) {
        // MVの地域名を復元
        const mvRegionElement = document.getElementById('mv-region-name');
        if (mvRegionElement) {
            mvRegionElement.textContent = region.name;
        }
        
        // 詳細セクションの地域名を復元
        const detailRegionElement = document.getElementById('detail-region-name');
        if (detailRegionElement) {
            detailRegionElement.textContent = region.name + 'で人気のクリニック';
        }
        
        // 比較表の地域名を復元
        const comparisonRegionElement = document.getElementById('comparison-region-name');
        if (comparisonRegionElement) {
            comparisonRegionElement.textContent = region.name;
        }
    }

    forceUpdateRegionNames(region) {
        // MV地域名を強制的に更新
        const mvRegionElement = document.getElementById('mv-region-name');
        if (mvRegionElement) {
            mvRegionElement.textContent = region.name;
        }
        
        // 詳細セクション地域名を強制的に更新
        const detailRegionElement = document.getElementById('detail-region-name');
        if (detailRegionElement) {
            detailRegionElement.textContent = region.name + 'で人気のクリニック';
        }
        
        // 比較表地域名を強制的に更新
        const comparisonRegionElement = document.getElementById('comparison-region-name');
        if (comparisonRegionElement) {
            comparisonRegionElement.textContent = region.name;
        }
        
        // ランキング地域名も強制的に更新
        const rankRegionElement = document.getElementById('rank-region-name');
        if (rankRegionElement) {
            const rankingText = this.dataManager.getCommonText('ランキング地域名テキスト', 'で人気の脂肪溶解注射はココ！');
            const fullText = region.name + rankingText;
            rankRegionElement.textContent = fullText;
        }
        
    }

    // サイト全体のテキストを動的に更新（クリニック別対応）
    updateAllTexts(regionId) {
        try {
            const currentClinic = this.dataManager.getCurrentClinic();

            // ページタイトルの更新
            // メタディスクリプションの更新
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
                const metaDescText = this.dataManager.getClinicText(currentClinic, 'メタディスクリプション', 'あなたの地域の優良クリニックを探そう。');
                metaDesc.setAttribute('content', metaDescText);
            }

            // サイトロゴの更新（共通テキスト）
            const siteLogo = document.querySelector('.site-logo');
            if (siteLogo) {
                const logoText = this.dataManager.getCommonText('サイト名', '矯正歯科おすすめ比較.com');
                siteLogo.textContent = logoText;
            } else {
                console.warn('⚠️ サイトロゴ要素が見つかりません');
            }

            // MVアピールテキストの更新（共通テキスト）
            const appealText1Element = document.getElementById('mv-left-appeal-text');
            if (appealText1Element) {
                const text1 = this.dataManager.getCommonText('MVアピールテキスト1', 'コスパ');
                appealText1Element.textContent = text1;
            }


            // SVGテキストの更新（共通テキスト）
            const svgText1Element = document.querySelector('#mv-main-svg-text text');
            if (svgText1Element) {
                const svgText1 = this.dataManager.getCommonText('MVSVGテキスト1', '脂肪溶解注射');
                svgText1Element.textContent = svgText1;
            }

            // SVGテキスト2の更新（共通テキスト、ランキング数を動的に計算）
            const svgText2Element = document.querySelector('#mv-appeal1-text text');
            if (svgText2Element) {
                // 現在の地域のランキング数を取得 (正規化されたIDを使用)
                const normalizedRegionId = String(parseInt(regionId, 10));
                const ranking = this.dataManager.getRankingByRegionId(normalizedRegionId);
                let rankCount = 5; // デフォルト値
                
                if (ranking && ranking.ranks) {
                    // ランキングに含まれるクリニック数を計算（"-"以外のものをカウント）
                    const validRanks = Object.entries(ranking.ranks)
                        .filter(([key, value]) => value !== '-' && value !== null && value !== undefined)
                        .length;
                    if (validRanks > 0) {
                        rankCount = Math.min(validRanks, 5); // 最大5位まで
                    }
                }
                
                // プレースホルダーを使用してテキストを取得
                const svgText2 = this.dataManager.getCommonText('MVSVGテキスト2', 'ランキング', {
                    RANK_COUNT: rankCount
                });
                svgText2Element.textContent = svgText2;
                
                // detail-rank-best要素の更新
                const detailRankBestElement = document.getElementById('detail-rank-best');
                if (detailRankBestElement) {
                    detailRankBestElement.innerHTML = `${rankCount}<span style="font-size: 0.6em;"> 選！</span>`;
                }
            }

            // ランキングバナーのalt属性更新（共通テキスト）
            const rankingBanner = document.querySelector('.ranking-banner-image');
            if (rankingBanner) {
                const rankingAlt = this.dataManager.getCommonText('ランキングバナーalt', 'で人気の脂肪溶解注射はここ！');
                rankingBanner.setAttribute('alt', rankingAlt);
            }

            // 比較表タイトルの更新（共通テキスト）
            const comparisonTitle = document.querySelector('.comparison-title');
            if (comparisonTitle) {
                const titleText = this.dataManager.getCommonText('比較表タイトル', 'で人気の脂肪溶解注射');
                // 地域名を動的に挿入（マッピングされた地域を使用、000の場合は全国を使用）
                const mappedRegionId = this.dataManager.mapRegionId(regionId);
                let regionName = '';
                
                if (mappedRegionId === '000') {
                    regionName = '全国';
                } else {
                    const region = this.dataManager.getRegionById(String(parseInt(mappedRegionId, 10)));
                    regionName = region ? region.name : '';
                }
                
                comparisonTitle.innerHTML = `<span id="comparison-region-name">${regionName}</span>${titleText}`;
            }

            // 比較表サブタイトルの更新（共通テキスト）
            const comparisonSubtitle = document.querySelector('.comparison-subtitle');
            if (comparisonSubtitle) {
                const subtitleHtml = this.dataManager.getCommonText('比較表サブタイトル', 'クリニックを<span class="pink-text">徹底比較</span>');
                comparisonSubtitle.innerHTML = this.dataManager.processDecoTags(subtitleHtml);
            }
            
            // 案件詳細バナーのalt属性を更新（共通テキスト）
            const detailsBannerImg = document.querySelector('.details-banner-image');
            if (detailsBannerImg) {
                const detailsBannerAlt = this.dataManager.getCommonText('案件詳細バナーalt', 'コスパ×効果×通いやすさで選ぶ脂肪冷却BEST3');
                detailsBannerImg.setAttribute('alt', detailsBannerAlt);
            }
            
            // フッターサイト名の更新（共通テキスト）
            const footerSiteName = document.querySelector('.footer_contents h4 a');
            if (footerSiteName) {
                const footerText = this.dataManager.getCommonText('サイト名', '矯正歯科おすすめ比較.com');
                footerSiteName.textContent = footerText;
            }
            
            // フッターコピーライトの更新（共通テキスト）
            const footerCopyright = document.querySelector('.copyright');
            if (footerCopyright) {
                const siteName = this.dataManager.getCommonText('サイト名', '矯正歯科おすすめ比較.com');
                const copyrightText = '© 2025 ' + siteName;
                footerCopyright.textContent = copyrightText;
            }
            
            // Tipsセクションの更新（共通テキスト）
            // タブタイトルの更新
            const tabTexts = document.querySelectorAll('.tips-container .tab-text');
            if (tabTexts.length >= 3) {
                tabTexts[0].textContent = this.dataManager.getCommonText('Tipsタブ1タイトル', '脂肪冷却の効果');
                tabTexts[1].textContent = this.dataManager.getCommonText('Tipsタブ2タイトル', 'クリニック選び');
                tabTexts[2].textContent = this.dataManager.getCommonText('Tipsタブ3タイトル', '今がおすすめ');
            }
            
            // Tips内容の更新（タブコンテンツ内のp要素）
            const tabContents = document.querySelectorAll('.tips-container .tab-content');
            if (tabContents.length >= 3) {
                const tips1P = tabContents[0].querySelector('p');
                if (tips1P) {
                    const tips1Content = this.dataManager.getCommonText('Tips1内容', '本気で痩せたいなら脂肪冷却が最短！科学的根拠に基づき、脂肪細胞そのものを凍結・減少させる痩身治療です。リバウンドしにくく、部分痩せも可能。自己流ダイエットで失敗続きの方にこそ試してほしい、確実な痩身方法です。');
                    tips1P.innerHTML = this.dataManager.processDecoTags(tips1Content);
                }
                
                const tips2P = tabContents[1].querySelector('p');
                if (tips2P) {
                    const tips2Content = this.dataManager.getCommonText('Tips2内容', 'クリニック選びの失敗が理想の体型実現の失敗につながります。<br>強引な勧誘は危険信号。次の3条件を満たす医院を選びましょう。<br><br>☑️医師が直接診察する<br>☑️施術後のアフターケア<br>☑️料金を明確に説明する');
                    tips2P.innerHTML = this.dataManager.processDecoTags(tips2Content);
                }
                
                const tips3P = tabContents[2].querySelector('p');
                if (tips3P) {
                    const tips3Content = this.dataManager.getCommonText('Tips3内容', '夏本番になると予約が取りにくくなり、料金も高くなりがち。今なら夏直前キャンペーンでお得に始められて、予約もスムーズ！理想の体型で夏を迎えるなら今がラストチャンスです。');
                    tips3P.innerHTML = this.dataManager.processDecoTags(tips3Content);
                }
            }

            // 注意事項HTMLの更新（既存の注意事項を置き換える）
            const disclaimerHTML = this.dataManager.getCommonText('注意事項HTML', '');
            if (disclaimerHTML) {
                // 既存の注意事項セクションを探す
                const disclaimerAccordion = document.querySelector('.disclaimer-accordion');
                if (disclaimerAccordion) {
                    // 既存の main-disclaimer を置き換える
                    const existingMainDisclaimer = disclaimerAccordion.querySelector('.main-disclaimer');
                    if (existingMainDisclaimer) {
                        // 注意：JSONからのHTMLが正しい形式でない場合があるので、確認
                        // 現在は既存のHTMLはそのまま使用
                    }
                }
            }

            // 比較表ヘッダーの更新（食事指導を対応部位に変更）
            const tableHeaders = document.querySelectorAll('.comparison-table th');
            tableHeaders.forEach(th => {
                if (th.textContent.includes('食事指導')) {
                    th.textContent = '対応部位';
                    th.style.display = ''; // 表示する
                    th.classList.remove('th-none');
                }
            });

            // （ヘッダー名の動的変更は行わない）

        } catch (error) {
            console.error('❌ updateAllTextsでエラーが発生:', error);
        }
    }

    // 店舗をクリニックごとにグループ化して表示順を管理
    groupStoresByClinics(stores, ranking, allClinics) {
        const clinicsWithStores = new Map();
        
        if (!ranking || !stores || stores.length === 0) {
            return clinicsWithStores;
        }

        // ランキング順にクリニックを処理
        const sortedRanks = Object.entries(ranking.ranks).sort((a, b) => {
            const numA = parseInt(a[0].replace('no', ''));
            const numB = parseInt(b[0].replace('no', ''));
            return numA - numB;
        });

        sortedRanks.forEach(([position, clinicId]) => {
            const clinic = allClinics.find(c => c.id === clinicId);
            if (clinic) {
                // クリニック名はそのまま使用（stores.csvとitems.csvで名前は統一されている）
                const storeClinicName = clinic.name;
                
                // このクリニックに属する店舗をクリニック名でフィルタリング
                const clinicStores = stores.filter(store => 
                    store.clinicName === storeClinicName
                );
                
                // 店舗がない場合も空配列でMapに追加（全クリニックを表示するため）
                clinicsWithStores.set(clinic, clinicStores);
            }
        });

        return clinicsWithStores;
    }

    // 比較表ヘッダーの更新
    updateComparisonHeaders() {
        const headerRow = document.getElementById('comparison-header-row');
        if (!headerRow) return;
        
        // ヘッダーをクリア
        headerRow.innerHTML = '';
        
        // clinic-texts.jsonの比較表ヘッダー設定から取得
        const headerConfig = this.dataManager.clinicTexts['比較表ヘッダー設定'] || {};
        
        // ヘッダーを動的に生成
        // 最初の「クリニック」は固定、それ以降はheaderConfigから取得
        const headers = [
            { key: null, default: 'クリニック', class: '', fixed: true },  // 固定項目
            { key: '比較表ヘッダー1', default: '総合評価', class: '' },
            { key: '比較表ヘッダー2', default: '費用', class: '' },
            { key: '比較表ヘッダー3', default: '特徴', class: '' },
            { key: '比較表ヘッダー10', default: '公式サイト', class: '' },
            { key: '比較表ヘッダー4', default: '矯正範囲', class: 'th-none', style: 'display: none;' },
            { key: '比較表ヘッダー5', default: '目安期間', class: 'th-none', style: 'display: none;' },
            { key: '比較表ヘッダー6', default: '通院頻度', class: 'th-none', style: 'display: none;' },
            { key: '比較表ヘッダー7', default: '実績/症例数', class: 'th-none', style: 'display: none;' },
            { key: '比較表ヘッダー8', default: 'ワイヤー矯正の紹介', class: 'th-none', style: 'display: none;' },
            { key: '比較表ヘッダー9', default: 'サポート', class: 'th-none', style: 'display: none;' },
            { key: null, default: '詳細', class: 'th-none', style: 'display: none;', fixed: true }
        ];
        
        headers.forEach(header => {
            const th = document.createElement('th');
            // 固定項目の場合はdefaultを使用、それ以外はheaderConfigから取得
            if (header.fixed) {
                th.textContent = header.default;
            } else {
                th.textContent = headerConfig[header.key] || header.default;
            }
            if (header.class) th.className = header.class;
            if (header.style) th.setAttribute('style', header.style);
            headerRow.appendChild(th);
        });
    }

    // タブボタンのHTMLを動的に生成（不要なのでコメントアウト）
    // HTMLに既存のタブがあるため、この関数は使用しない
    createTabButtons() {
        // この関数は使用しない
        return;
    }

    // 比較表タブ機能のセットアップ
    setupComparisonTabs() {
        // タブボタンのHTMLを動的に生成する処理を削除
        // 既存のHTMLに定義されているタブを使用する
        
        const tabItems = document.querySelectorAll('.comparison-tab-menu-item');
        
        if (!tabItems || tabItems.length === 0) {
            return;
        }

        
        // 各タブの列データ設定（CSVフィールド名で統一）
        const tabFieldMappings = {
            'tab1': ['クリニック名', 'comparison1', 'comparison2', 'comparison3', '公式サイト'], // 総合（総合評価、コスト、人気）
            'tab2': ['クリニック名', 'comparison4', 'comparison5', 'comparison6', '公式サイト'], // 施術内容（矯正範囲、目安期間、通院頻度）
            'tab3': ['クリニック名', 'comparison7', 'comparison8', 'comparison9', '公式サイト'] // サービス（実績/症例数、ワイヤー矯正の紹介、サポート）
        };
        
        // タブクリックイベントリスナーを設定
        tabItems.forEach(tabItem => {
            // 既存のイベントリスナーを削除
            const newTabItem = tabItem.cloneNode(true);
            tabItem.parentNode.replaceChild(newTabItem, tabItem);
            
            newTabItem.addEventListener('click', (e) => {
                e.preventDefault();
                
                // 全てのタブからアクティブクラスを削除
                document.querySelectorAll('.comparison-tab-menu-item').forEach(item => {
                    item.classList.remove('tab-active');
                });
                
                // クリックされたタブにアクティブクラスを追加
                newTabItem.classList.add('tab-active');
                
                // データ属性からタブIDを取得
                const targetTab = newTabItem.getAttribute('data-tab');
                console.log(`${targetTab}タブがクリックされました`);
                
                // タブに応じてテーブルを再生成
                this.regenerateTableForTab(targetTab, tabFieldMappings[targetTab] || tabFieldMappings['tab1']);
            });
        });

        // 初期状態で総合タブのテーブルを生成
        this.regenerateTableForTab('tab1', tabFieldMappings['tab1']);
    }
    
    // タブ用のテーブルを動的に再生成
    // タブ用のテーブルを動的に再生成
    regenerateTableForTab(tabId, fieldNames) {
        const tbody = document.getElementById('comparison-tbody');
        const headerRow = document.getElementById('comparison-header-row');
        
        if (!tbody || !fieldNames) return;
        
        // CSVフィールド名から比較表ヘッダー設定のキーへのマッピング
        const fieldToHeaderMapping = {
            'comparison1': '比較表ヘッダー1', // 総合評価
            'comparison2': '比較表ヘッダー2', // コスト
            'comparison3': '比較表ヘッダー3', // 人気
            'comparison4': '比較表ヘッダー4', // 矯正範囲
            'comparison5': '比較表ヘッダー5', // 目安期間
            'comparison6': '比較表ヘッダー6', // 通院頻度
            'comparison7': '比較表ヘッダー7', // 実績/症例数
            'comparison8': '比較表ヘッダー8', // ワイヤー矯正の紹介
            'comparison9': '比較表ヘッダー9'  // サポート
        };
        
        // ヘッダーを再生成
        if (headerRow) {
            headerRow.innerHTML = '';
            const headerConfig = this.dataManager.clinicTexts['比較表ヘッダー設定'] || {};
            
            fieldNames.forEach(fieldName => {
                const th = document.createElement('th');
                
                if (fieldName === 'クリニック名') {
                    th.textContent = 'クリニック';
                } else if (fieldName === '公式サイト') {
                    th.textContent = '公式サイト';
                } else if (fieldToHeaderMapping[fieldName]) {
                    // CSVフィールド名からヘッダー設定のキーを取得して表示名を決定
                    const headerKey = fieldToHeaderMapping[fieldName];
                    th.textContent = headerConfig[headerKey] || fieldName;
                } else {
                    th.textContent = fieldName;
                }
                
                headerRow.appendChild(th);
            });
        }
        
        // 既存のクリニックデータを使ってtbodyを再生成
        tbody.innerHTML = '';
        
        // 現在表示されているクリニックのデータを取得
        const currentClinics = this.getCurrentDisplayedClinics();
        
        currentClinics.forEach((clinic, index) => {
            const tr = document.createElement('tr');
            
            // 1位のクリニックには特別な背景色
            if (index === 0) {
                tr.style.backgroundColor = '#fffbdc';
            }
            
            const rankNum = clinic.rank || index + 1;
            const clinicId = clinic.id;
            const regionId = this.currentRegionId || '000';
            const clinicCode = clinic.code;
            
            // 各フィールドに対応するセルを生成
            fieldNames.forEach(fieldName => {
                const td = document.createElement('td');
                
                if (fieldName === 'クリニック名') {
                    // クリニック名とロゴ
                    const imagesPath = window.SITE_CONFIG ? window.SITE_CONFIG.imagesPath + '/images' : '/images';
                    let logoPath = this.dataManager.getClinicText(clinicCode, 'クリニックロゴ画像パス', '');
                    
                    if (!logoPath) {
                        const logoFolder = clinicCode === 'kireil' ? 'kireiline' : clinicCode;
                        logoPath = `${imagesPath}/clinics/${logoFolder}/${logoFolder}-logo.webp`;
                    }
                    
                    const redirectUrl = `./redirect.html#clinic_id=${clinicId}&rank=${rankNum}&region_id=${regionId}`;
                    const clinicNameOnclick = `onclick="localStorage.setItem('redirectParams', JSON.stringify({clinic_id: '${clinicId}', rank: '${rankNum}', region_id: '${regionId}'})); setTimeout(() => { window.open('${redirectUrl}', '_blank'); }, 10); return false;"`;
                    
                    td.className = 'ranking-table_td1';
                    td.innerHTML = `
                        <img src="${logoPath}" alt="${clinic.name}" width="80">
                        <a href="#" ${clinicNameOnclick} class="clinic-link" style="cursor: pointer;">${clinic.name}</a>
                    `;
                } else if (fieldName === 'comparison1') {
                    // 総合評価と星表示
                    const rating = this.dataManager.getClinicText(clinicCode, 'comparison1', '4.5');
                    td.innerHTML = `
                        <span class="ranking_evaluation">${rating}</span><br>
                        <span class="star5_rating" data-rate="${rating}"></span>
                    `;
                } else if (fieldName === '公式サイト') {
                    // 公式サイトボタンと詳細を見るボタン
                    td.innerHTML = `
                        <a class="link_btn" href="${this.urlHandler.getClinicUrlWithRegionId(clinic.id, clinic.rank || rankNum)}" target="_blank">公式サイト &gt;</a><br>
                        <a class="detail_btn" href="#clinic${rankNum}">詳細をみる</a>
                    `;
                } else if (fieldName.startsWith('comparison')) {
                    // comparison2-9のフィールドはCSVフィールド名を使ってデータから取得
                    const cellData = this.dataManager.getClinicText(clinicCode, fieldName, '');
                    // processDecoTagsで処理してHTMLとして設定
                    if (cellData) {
                        td.innerHTML = this.dataManager.processDecoTags(cellData);
                    } else {
                        td.innerHTML = '';
                        console.log(`警告: ${clinicCode}の${fieldName}フィールドが空です`);
                    }
                } else {
                    // その他のフィールド
                    const cellData = this.dataManager.getClinicText(clinicCode, fieldName, '');
                    td.innerHTML = this.dataManager.processDecoTags(cellData || '');
                }
                
                tr.appendChild(td);
            });
            
            tbody.appendChild(tr);
        });
        
        // 星評価の初期化（必要に応じて）
        this.initializeStarRatings();
        
        // 詳細を見るリンクのイベントリスナーを再設定
        this.setupDetailScrollLinks();
    }
    
    // フィールド名からヘッダーキーを取得
    getHeaderKeyForField(fieldName) {
        const fieldToHeaderMap = {
            '総合評価': '比較表ヘッダー1',
            '費用': '比較表ヘッダー2', 
            '特徴': '比較表ヘッダー3',
            '矯正範囲': '比較表ヘッダー4',
            '目安期間': '比較表ヘッダー5',
            '通院頻度': '比較表ヘッダー6',
            '実績/症例数': '比較表ヘッダー7',
            'ワイヤー矯正の紹介': '比較表ヘッダー8',
            'サポート': '比較表ヘッダー9'
        };
        return fieldToHeaderMap[fieldName] || null;
    }
    
    // 現在表示されているクリニックのデータを取得
    getCurrentDisplayedClinics() {
        // 現在のランキングデータから表示中のクリニックを取得
        // 既存のgenerateComparisonTableで使われているデータを利用
        const tbody = document.getElementById('comparison-tbody');
        if (!tbody || !tbody.children.length) {
            // フォールバック：ダミーデータまたは最新のランキングデータを使用
            return this.getLatestRankingData();
        }
        
        // tbodyから現在のクリニック情報を復元（既存の実装から取得）
        return this.getLatestRankingData();
    }
    
    // 最新のランキングデータを取得
    getLatestRankingData() {
        // clinic-texts.jsonの実際のクリニックコードに合わせて修正
        return [
            { id: '1', name: 'Oh my teeth', code: 'omt', rank: 1 },
            { id: '4', name: 'キレイライン矯正', code: 'kireiline', rank: 2 },
            { id: '3', name: 'ウィスマイル', code: 'ws', rank: 3 },
            { id: '5', name: 'ゼニュム', code: 'zenyum', rank: 4 }
        ];
    }
    
    // 星評価の初期化
    initializeStarRatings() {
        // 既存の星評価初期化コードがあれば呼び出し
        const starElements = document.querySelectorAll('.star5_rating[data-rate]');
        starElements.forEach(element => {
            const rate = parseFloat(element.getAttribute('data-rate'));
            // 星評価の表示ロジックを実装（既存のものがあれば使用）
        });
    }
    
    // テーブルの列表示を更新
    updateTableColumns(table, visibleColumns) {
        if (!table) return;
        
        // ヘッダー行の列を制御
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
            const headerCells = headerRow.querySelectorAll('th');
            headerCells.forEach((cell, index) => {
                if (visibleColumns.includes(index)) {
                    cell.style.display = '';
                    cell.classList.remove('th-none');
                } else {
                    cell.style.display = 'none';
                    cell.classList.add('th-none');
                }
            });
        }
        
        // データ行の列を制御
        const bodyRows = table.querySelectorAll('tbody tr');
        bodyRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                if (visibleColumns.includes(index)) {
                    cell.style.display = '';
                    cell.classList.remove('th-none');
                } else {
                    cell.style.display = 'none';
                    cell.classList.add('th-none');
                }
            });
        });
    }

    // 比較表の更新
    updateComparisonTable(clinics, ranking) {
        if (!ranking || Object.keys(ranking.ranks).length === 0) {
            return;
        }


        // ランキング順のクリニックデータを取得
        const rankedClinics = [];
        
        // no1からno5まで順番に処理（1位→2位→3位→4位→5位の順）
        ['no1', 'no2', 'no3', 'no4', 'no5'].forEach((position, index) => {
            const clinicId = ranking.ranks[position];
            if (clinicId && clinicId !== '-') {
                // クリニックIDが文字列の場合と数値の場合の両方に対応
                const numericClinicId = parseInt(clinicId);
                const clinic = clinics.find(c => c.id == clinicId || c.id === numericClinicId);
                if (clinic) {
                    rankedClinics.push({
                        ...clinic,
                        rank: index + 1  // 1位、2位、3位...
                    });
                }
            }
        });


        // 比較表の内容を生成（タブ機能で再生成されるためコメントアウト）
        // this.generateComparisonTable(rankedClinics);
        
        // 比較表タブ機能のセットアップ（これが初期テーブルも生成する）
        this.setupComparisonTabs();
        
        // 1位クリニックおすすめセクションを更新
        this.updateFirstChoiceRecommendation(rankedClinics[0]);
        
        // レビュータブ切り替え機能の設定
        this.setupReviewTabs();
        
        // 詳細を見るリンクのイベントリスナーを設定
        this.setupDetailScrollLinks();
    }

    // 比較表の生成
    generateComparisonTable(clinics) {
        const tbody = document.getElementById('comparison-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        // 比較表ヘッダー設定を取得して動的にフィールド名を決定
        const headerConfig = this.dataManager.clinicTexts['比較表ヘッダー設定'] || {};
        const field2 = headerConfig['比較表ヘッダー2'] || 'コスト';  // デフォルトは'コスト'
        const field3 = headerConfig['比較表ヘッダー3'] || '人気';    // デフォルトは'人気'

        clinics.forEach((clinic, index) => {
            const tr = document.createElement('tr');
            
            // 1位のクリニックには特別な背景色
            if (index === 0) {
                tr.style.backgroundColor = '#fffbdc';
            }
            
            const rankNum = clinic.rank || index + 1;
            const clinicId = clinic.id;
            const regionId = this.currentRegionId || '000';
            
            // クリニックコードを取得
            const clinicCode = clinic.code;
            
            // クリニックの詳細データを取得する関数
            const getClinicData = (fieldName, defaultValue = '') => {
                return this.dataManager.getClinicText(clinicCode, fieldName, defaultValue);
            };
            
            // クリニックのロゴ画像パスをclinic-texts.jsonから取得
            const imagesPath = window.SITE_CONFIG ? window.SITE_CONFIG.imagesPath + '/images' : '/images';
            let logoPath = getClinicData('クリニックロゴ画像パス', '');
            
            if (!logoPath) {
                // フォールバック：コードベースのパス
                const logoFolder = clinicCode === 'kireil' ? 'kireiline' : clinicCode;
                logoPath = `${imagesPath}/clinics/${logoFolder}/${logoFolder}-logo.webp`;
            }
            
            // リダイレクトURL（ハッシュフラグメント使用）
            const redirectUrl = `./redirect.html#clinic_id=${clinicId}&rank=${rankNum}&region_id=${regionId}`;
            
            // クリニック名リンクにもlocalStorageとリダイレクトを適用
            const clinicNameOnclick = `onclick="localStorage.setItem('redirectParams', JSON.stringify({clinic_id: '${clinicId}', rank: '${rankNum}', region_id: '${regionId}'})); setTimeout(() => { window.open('${redirectUrl}', '_blank'); }, 10); return false;"`;
            
            tr.innerHTML = `
                <td class="ranking-table_td1">
                    <img src="${logoPath}" alt="${clinic.name}" width="80">
                    <a href="#" ${clinicNameOnclick} class="clinic-link" style="cursor: pointer;">${clinic.name}</a>
                </td>
                <td class="" style="">
                    <span class="ranking_evaluation">${getClinicData('総合評価', '4.5')}</span><br>
                    <span class="star5_rating" data-rate="${getClinicData('総合評価', '4.5')}"></span>
                </td>
                <td class="" style="">${this.dataManager.processDecoTags(getClinicData(field2, ''))}</td>
                <td class="" style="">${this.dataManager.processDecoTags(getClinicData(field3, ''))}</td>
                <td>
                    <a class="link_btn" href="${this.urlHandler.getClinicUrlWithRegionId(clinic.id, clinic.rank || rankNum)}" target="_blank">公式サイト &gt;</a><br>
                    <a class="detail_btn" href="#clinic${rankNum}">詳細をみる</a>
                </td>
                <td class="th-none" style="display: none;">${this.dataManager.processDecoTags(getClinicData('矯正範囲', ''))}</td>
                <td class="th-none" style="display: none;">${this.dataManager.processDecoTags(getClinicData('目安期間', ''))}</td>
                <td class="th-none" style="display: none;">${this.dataManager.processDecoTags(getClinicData('通院頻度', ''))}</td>
                <td class="th-none" style="display: none;">${this.dataManager.processDecoTags(getClinicData('実績/症例数', ''))}</td>
                <td class="th-none" style="display: none;">${this.dataManager.processDecoTags(getClinicData('ワイヤー矯正の紹介', ''))}</td>
                <td class="th-none" style="display: none;">${this.dataManager.processDecoTags(getClinicData('サポート', ''))}</td>
            `;
            
            tbody.appendChild(tr);
        });
        
        // 比較表の注意事項はinitializeDisclaimersで処理されるため、ここでは呼び出さない
        // initializeDisclaimersが後で自動的に呼ばれる
    }
    
    // 比較表の注意事項を更新
    updateComparisonDisclaimers(disclaimers) {
        const disclaimerContent = document.getElementById('main-content');
        if (!disclaimerContent) {
            console.error('main-content element not found');
            return;
        }
        
        console.log('updateComparisonDisclaimers called with:', disclaimers);
        
        // 注意事項コンテンツをクリア
        disclaimerContent.innerHTML = '';
        
        if (!disclaimers || disclaimers.length === 0) {
            disclaimerContent.innerHTML = '<p style="font-size: 11px; color: #666; padding: 10px;">注意事項はありません。</p>';
            return;
        }
        
        // 各クリニックの注意事項を追加
        disclaimers.forEach((item, index) => {
            const disclaimerDiv = document.createElement('div');
            disclaimerDiv.style.cssText = 'margin-bottom: 15px; padding: 10px; border-left: 3px solid #6bd1d0;';
            
            const titleDiv = document.createElement('div');
            titleDiv.style.cssText = 'font-weight: 600; color: #333; margin-bottom: 5px; font-size: 12px;';
            titleDiv.textContent = `【${item.clinicName}】`;
            
            const textDiv = document.createElement('div');
            textDiv.style.cssText = 'font-size: 10px; line-height: 1.6; color: #666;';
            textDiv.innerHTML = item.text;
            
            disclaimerDiv.appendChild(titleDiv);
            disclaimerDiv.appendChild(textDiv);
            disclaimerContent.appendChild(disclaimerDiv);
        });
        
        console.log('Disclaimers added to DOM, child count:', disclaimerContent.children.length);
    }

    // 1位クリニックおすすめセクションの更新
    updateFirstChoiceRecommendation(topClinic) {
        if (!topClinic) return;
        
        
        const clinicCode = window.dataManager.getClinicCodeById(topClinic.id);
        if (!clinicCode) return;
        
        // 画像パスの設定
        const imagesPath = window.SITE_CONFIG ? window.SITE_CONFIG.imagesPath + '/images' : '/images';
        
        // クリニック名を更新
        const clinicNameElements = ['first-choice-clinic-name', 'first-choice-title-clinic-name'];
        clinicNameElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = topClinic.name;
        });
        
        // バナー画像を更新
        const bannerImage = document.getElementById('first-choice-banner-image');
        if (bannerImage) {
            const bannerPath = window.dataManager.getClinicText(clinicCode, 'クリニック詳細バナー画像パス', '') || 
                             `${imagesPath}/clinics/${clinicCode}/${clinicCode}_detail_bnr.webp`;
            bannerImage.src = bannerPath;
            bannerImage.alt = topClinic.name;
        }
        
        // 3つのポイントを更新
        const point1Title = document.getElementById('point1-title');
        const point1Desc = document.getElementById('point1-description');
        const point2Title = document.getElementById('point2-title');
        const point2Desc = document.getElementById('point2-description');
        const point3Title = document.getElementById('point3-title');
        const point3Desc = document.getElementById('point3-description');
        
        if (point1Title) point1Title.textContent = window.dataManager.getClinicText(clinicCode, 'おすすめポイント1タイトル', '圧倒的な実績＆成功率99％');
        if (point1Desc) point1Desc.textContent = window.dataManager.getClinicText(clinicCode, 'おすすめポイント1詳細', 'ダイエット成功率99％、平均13.7kg減の実績。科学的根拠に基づいた医療痩身プログラムで、確実に結果を出します。');
        
        if (point2Title) point2Title.textContent = window.dataManager.getClinicText(clinicCode, 'おすすめポイント2タイトル', '最新の医療機器を完備');
        if (point2Desc) point2Desc.textContent = window.dataManager.getClinicText(clinicCode, 'おすすめポイント2詳細', '脂肪冷却・医療用EMS・医療ハイフ・医療ラジオ波など、最新の痩身機器を多数完備。一人一人の悩みに合わせた最適な治療を提供します。');
        
        if (point3Title) point3Title.textContent = window.dataManager.getClinicText(clinicCode, 'おすすめポイント3タイトル', '管理栄養士による完全サポート');
        if (point3Desc) point3Desc.textContent = window.dataManager.getClinicText(clinicCode, 'おすすめポイント3詳細', '管理栄養士による食事指導で健康的にダイエット。痩せなかったら全額返金、リバウンド防止プログラム付きで安心です。');
        
        // ロゴ画像を更新
        const infoLogo = document.getElementById('first-choice-info-logo');
        if (infoLogo) {
            const logoFolder = clinicCode === 'kireil' ? 'kireiline' : clinicCode;
            const logoPath = window.dataManager.getClinicText(clinicCode, 'クリニックロゴ画像パス', '') || 
                            `${imagesPath}/clinics/${logoFolder}/${logoFolder}-logo.webp`;
            infoLogo.src = logoPath;
            infoLogo.alt = topClinic.name;
        }
        
        // キャンペーンテキストを更新
        const campaignText = document.getElementById('first-choice-campaign-text');
        if (campaignText) {
            const campaign = window.dataManager.getClinicText(clinicCode, 'キャンペーン', '期間限定キャンペーン<br>12ヶ月分0円');
            campaignText.innerHTML = campaign;
        }
        
        // 実績テキストを更新
        const achievementText = document.getElementById('first-choice-achievement-text');
        if (achievementText) {
            const achievement = window.dataManager.getClinicText(clinicCode, 'INFORMATIONサブテキスト', '\\月額・総額がリーズナブルなクリニック/');
            achievementText.textContent = achievement;
        }
        
        // CTAテキストを更新
        const ctaText = document.getElementById('first-choice-cta-text');
        if (ctaText) {
            ctaText.textContent = `${topClinic.name}の公式サイト`;
        }
        
        // CTAリンクを更新
        const ctaLink = document.getElementById('first-choice-cta-link');
        if (ctaLink) {
            ctaLink.href = this.urlHandler.getClinicUrlWithRegionId(topClinic.id, topClinic.rank || 1);
        }
        
        // 免責事項のタイトルを更新
        const disclaimerTitle = document.getElementById('first-choice-disclaimer-title');
        if (disclaimerTitle) {
            disclaimerTitle.textContent = `${topClinic.name}の確認事項`;
        }
    }

    // クリニック名の表示形式を取得
    getClinicDisplayName(clinic) {
        // CSVデータのクリニック名をそのまま使用
        return clinic.name;
    }

    // 総合タブの生成
    generateGeneralTab(clinics) {
        const tbody = document.getElementById('general-tbody');
        tbody.innerHTML = '';

        clinics.forEach((clinic, index) => {
            const row = document.createElement('tr');
            const rankClass = clinic.rank === 1 ? '' : clinic.rank === 2 ? 'silver' : 'bronze';
            
            // ダミーデータ（実際のデータに置き換え）
            const ratings = { 1: 4.9, 2: 4.5, 3: 4.3, 4: 4.1, 5: 3.8 };
            const achievements = { 
                1: '全国100院以上',
                2: '累計施術50万件',
                3: '開院15年の実績',
                4: '全国80院展開',
                5: '医療脱毛専門10年'
            };
            const benefits = {
                1: '初回限定50%OFF',
                2: '学割・ペア割あり',
                3: '全身脱毛20%割引',
                4: 'モニター割引30%',
                5: '平日限定プランあり'
            };

            row.innerHTML = `
                <td>
                    <div class="clinic-name-cell">
                        <div class="rank-badge ${rankClass}">${clinic.rank}位</div>
                        <div class="clinic-info">
                            <div class="clinic-main-name">${this.getClinicDisplayName(clinic)}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="rating-cell">${getRatingFromJson(clinic.rank)}</div>
                    <div class="rating-stars">
                        ${'<i class="fas fa-star"></i>'.repeat(Math.floor(getRatingFromJson(clinic.rank)))}
                        ${getRatingFromJson(clinic.rank) % 1 ? '<i class="fas fa-star-half-alt"></i>' : ''}
                    </div>
                </td>
                <td class="achievement-text">${getAchievementFromJson(clinic.rank)}</td>
                <td class="benefit-text">${getBenefitFromJson(clinic.rank)}</td>
                <td>
                    <div class="cta-cell">
                        <a href="${this.urlHandler.getClinicUrlWithRegionId(clinic.id, clinic.rank)}" class="cta-button" target="_blank" rel="noopener">公式サイト</a>
                        <a href="#clinic${clinic.rank}" class="cta-link detail-scroll-link" data-rank="${clinic.rank}">詳細を見る</a>
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    // 施術内容タブの生成
    generateTreatmentTab(clinics) {
        const tbody = document.getElementById('treatment-tbody');
        tbody.innerHTML = '';

        clinics.forEach((clinic, index) => {
            const row = document.createElement('tr');
            const rankClass = clinic.rank === 1 ? '' : clinic.rank === 2 ? 'silver' : 'bronze';

            row.innerHTML = `
                <td>
                    <div class="clinic-name-cell">
                        <div class="rank-badge ${rankClass}">${clinic.rank}位</div>
                        <div class="clinic-info">
                            <div class="clinic-main-name">${this.getClinicDisplayName(clinic)}</div>
                        </div>
                    </div>
                </td>
                <td>全身＋VIO脱毛</td>
                <td>最新医療レーザー</td>
                <td><i class="fas fa-circle feature-icon"></i></td>
                <td>
                    <div class="cta-cell">
                        <a href="${this.urlHandler.getClinicUrlWithRegionId(clinic.id, clinic.rank)}" class="cta-button" target="_blank" rel="noopener">公式サイト</a>
                        <a href="#clinic${clinic.rank}" class="cta-link detail-scroll-link" data-rank="${clinic.rank}">詳細を見る</a>
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    // サービスタブの生成
    generateServiceTab(clinics) {
        const tbody = document.getElementById('service-tbody');
        tbody.innerHTML = '';

        clinics.forEach((clinic, index) => {
            const row = document.createElement('tr');
            const rankClass = clinic.rank === 1 ? '' : clinic.rank === 2 ? 'silver' : 'bronze';

            row.innerHTML = `
                <td>
                    <div class="clinic-name-cell">
                        <div class="rank-badge ${rankClass}">${clinic.rank}位</div>
                        <div class="clinic-info">
                            <div class="clinic-main-name">${this.getClinicDisplayName(clinic)}</div>
                        </div>
                    </div>
                </td>
                <td><i class="fas fa-circle feature-icon"></i></td>
                <td>${clinic.rank <= 3 ? '<i class="fas fa-circle feature-icon"></i>' : '<i class="fas fa-triangle feature-icon triangle"></i>'}</td>
                <td>${clinic.rank <= 2 ? '<i class="fas fa-circle feature-icon"></i>' : '-'}</td>
                <td>
                    <div class="cta-cell">
                        <a href="${this.urlHandler.getClinicUrlWithRegionId(clinic.id, clinic.rank)}" class="cta-button" target="_blank" rel="noopener">公式サイト</a>
                        <a href="#clinic${clinic.rank}" class="cta-link detail-scroll-link" data-rank="${clinic.rank}">詳細を見る</a>
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    // タブ切り替え機能の設定
    setupTabSwitching() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');

                // すべてのタブボタンとコンテンツを非アクティブに
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // クリックされたタブをアクティブに
                button.classList.add('active');
                document.getElementById(`${targetTab}-tab`).classList.add('active');
            });
        });
    }
    
    // 詳細を見るリンクのイベントリスナーを設定
    setupDetailScrollLinks() {
        
        // 少し遅延を入れてDOMが完全に生成されるのを待つ
        setTimeout(() => {
            
            // すべてのaタグを確認
            const allLinks = document.querySelectorAll('a');
            
            // 詳細を見る・詳細をみるというテキストを含むリンクを探す
            const detailTextLinks = Array.from(allLinks).filter(link => 
                link.textContent.includes('詳細を見る') || link.textContent.includes('詳細をみる')
            );
            detailTextLinks.forEach((link, i) => {
                // Links processing
            });
            
            // 動的に生成される比較表のリンク
            const dynamicLinks = document.querySelectorAll('.detail-scroll-link');
            
            // 各リンクの詳細情報を表示
            dynamicLinks.forEach((link, index) => {
                // Dynamic links processing
                
                // 既存のイベントリスナーを確認
                const hasExistingListener = link.hasAttribute('data-listener-attached');
                
                if (!hasExistingListener) {
                    link.setAttribute('data-listener-attached', 'true');
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rank = parseInt(link.getAttribute('data-rank'));
                        this.scrollToClinicDetail(rank);
                    });
                } else {
                }
            });
            
            // 静的な比較表のリンク
            const staticLinks = document.querySelectorAll('.detail-static-link');
            
            staticLinks.forEach((link, index) => {
                
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const rank = parseInt(link.getAttribute('data-rank'));
                    this.scrollToClinicDetail(rank);
                });
            });
            
            // 比較表内のすべてのボタンやリンクを確認
            const comparisonTable = document.getElementById('comparison-table');
            if (comparisonTable) {
                const allTableLinks = comparisonTable.querySelectorAll('a');
                allTableLinks.forEach((link, i) => {
                    if (link.textContent.includes('詳細')) {
                        // Detail link found
                    }
                });
            }
        }, 500); // setTimeoutの閉じ括弧を追加
    }
    
    // クリニック詳細へスクロール
    scrollToClinicDetail(rank) {
        
        // 直接IDで要素を取得（静的比較表と同じ形式）
        const targetId = `clinic${rank}`;
        
        const targetElement = document.getElementById(targetId);
        
        // すべての詳細要素を確認
        const allDetailElements = document.querySelectorAll('[id^="clinic"]');
        allDetailElements.forEach(el => {
            if (el.id.match(/^clinic\d+$/)) {
                // Check element visibility
            }
        });
        
        // clinic-details-listセクションの存在確認
        const detailsList = document.getElementById('clinic-details-list');
        if (detailsList) {
        }
        
        if (targetElement) {
            // 要素の位置を取得してスクロール
            const rect = targetElement.getBoundingClientRect();
            
            const elementTop = rect.top + window.pageYOffset;
            const offset = 100; // ヘッダーの高さ分のオフセット
            const scrollTo = elementTop - offset;
            
            window.scrollTo({
                top: scrollTo,
                behavior: 'smooth'
            });
            
            // スクロール後の確認
            setTimeout(() => {
            }, 1000);
        } else {
            // 詳細要素が見つからない場合は、セクション全体にスクロール
            const detailSection = document.getElementById('clinic-details-list');
            if (detailSection) {
                const sectionTop = detailSection.getBoundingClientRect().top + window.pageYOffset;
                window.scrollTo({
                    top: sectionTop - 100,
                    behavior: 'smooth'
                });
            } else {
            }
        }
    }
    
    // レビュータブ切り替え機能の設定
    setupReviewTabs() {
        // 各クリニック詳細セクションのレビュータブを設定
        document.addEventListener('click', (e) => {
            // 新しいタブ構造用のイベント処理
            const tabLi = e.target.closest('.review_tab2 li');
            if (tabLi) {
                const reviewSection = tabLi.closest('#review_tab_box');
                if (reviewSection) {
                    const tabIndex = Array.from(tabLi.parentElement.children).indexOf(tabLi);
                    
                    // タブのアクティブ状態を更新
                    reviewSection.querySelectorAll('.review_tab2 li').forEach((li, index) => {
                        li.classList.remove('select2');
                        if (index === tabIndex) {
                            li.classList.add('select2');
                        }
                    });
                    
                    // コンテンツの表示を切り替え
                    reviewSection.querySelectorAll('.wrap_long2').forEach((content, index) => {
                        content.classList.remove('active');
                        content.classList.add('disnon2');
                        if (index === tabIndex) {
                            content.classList.add('active');
                            content.classList.remove('disnon2');
                        }
                    });
                }
            }
        });
    }

    // クリニック詳細の更新
    updateClinicDetails(clinics, ranking, regionId) {
        const detailsList = document.getElementById('clinic-details-list');
        if (!detailsList) {
            return;
        }

        detailsList.innerHTML = '';
        
        // 比較表も更新
        this.updateComparisonTable(clinics, ranking);

        if (!ranking) {
            return;
        }
        
        if (!ranking.ranks) {
            return;
        }
        
        if (Object.keys(ranking.ranks).length === 0) {
            return;
        }
        

        // ランキング順のクリニックデータを取得（5位まで）
        const sortedRanks = Object.entries(ranking.ranks).sort((a, b) => {
            const numA = parseInt(a[0].replace('no', ''));
            const numB = parseInt(b[0].replace('no', ''));
            return numA - numB;
        }).slice(0, 5);

        
        sortedRanks.forEach(([position, clinicId]) => {
            // clinicIdを数値に変換して比較
            const numericClinicId = parseInt(clinicId);
            const clinic = clinics.find(c => c.id == clinicId || c.id === numericClinicId);
            if (!clinic) {
                return;
            }

            const rank = parseInt(position.replace('no', ''));
            const detailItem = document.createElement('div');
            detailItem.className = `detail-item ranking_box_inner ranking_box_${rank}`;
            detailItem.setAttribute('data-rank', rank);
            detailItem.setAttribute('data-clinic-id', clinicId);
            detailItem.id = `clinic${rank}`; // アンカーリンク用のIDを追加（静的比較表と一致）

            // ランクに応じたバッジクラス
            let badgeClass = '';
            if (rank === 2) badgeClass = 'silver';
            else if (rank === 3) badgeClass = 'bronze';
            else if (rank === 4) badgeClass = 'ranking4';
            else if (rank === 5) badgeClass = 'ranking5';

            // クリニック詳細データを動的に取得
            // DataManagerから動的にクリニック詳細データを取得
            const data = this.dataManager.getClinicDetailData(clinicId);
            if (!data) {
                return; // forEachの中ではcontinueではなくreturnを使用
            }
            data.regionId = regionId;
            
            // バナーがない場合はデフォルトパスを設定
            if (!data.banner) {
                const clinicCode = this.dataManager.getClinicCodeById(clinicId);
                const bannerFolder = clinicCode === 'kireil' ? 'kireiline' : clinicCode;
                data.banner = `../common_data/images/clinics/${bannerFolder}/${bannerFolder}_detail_bnr.webp`;
            }
            
            // 店舗データを動的に取得（store_view.csvに基づいてフィルタリング）
            const allStores = this.dataManager.getStoresByRegionId(regionId); // regionIdは既に正規化済み
            
            // クリニック名はそのまま使用
            const storeClinicName = clinic.name;
            
            // 現在のクリニックに属する店舗のみをフィルタリング
            data.stores = allStores.filter(store => {
                return store.clinicName === storeClinicName;
            });

            detailItem.innerHTML = `
                <div class="ranking_box_in">
                    <div class="detail-rank">
                        <div class="detail-rank-header">
                            <div class="detail-rank-badge ${badgeClass}">${rank}</div>
                            <div class="detail-title">
                                <h3>${this.dataManager.processDecoTags(data.title)}</h3>
                                <p>${this.dataManager.processDecoTags(data.subtitle)}</p>
                            </div>
                        </div>
                        <div class="ranking__name">
                            <a href="${this.urlHandler.getClinicUrlWithRegionId(clinic.id, clinic.rank)}" target="_blank" rel="noopener nofollow">${clinic.name} ＞</a>
                        </div>
                    </div>
                ${(() => {
                    // DataManagerからバナーパスを動的に取得
                    const clinicCode = this.dataManager.getClinicCodeById(clinicId);
                    const bannerFolder = clinicCode === 'kireil' ? 'kireiline' : clinicCode;
                    const correctBanner = data.banner || `../common_data/images/clinics/${bannerFolder}/${bannerFolder}_detail_bnr.webp`;
                    return correctBanner ? `
                    <div class="detail-banner">
                        <img src="${correctBanner}" alt="${clinic.name}キャンペーン">
                    </div>
                    ` : '';
                })()}
                <div class="detail-features">
                    ${data.features.map(feature => `<span class="feature-tag">${this.dataManager.processDecoTags(feature.startsWith('#') ? feature : '# ' + feature)}</span>`).join('')}
                </div>
                
                <!-- 拡張版価格表 -->
                <table class="info-table">
                    ${Object.entries(data.priceDetail).map(([key, value]) => `
                        <tr>
                            <td>${key}</td>
                            <td>${this.dataManager.processDecoTags(value)}</td>
                        </tr>
                    `).join('')}
                </table>
                
                <!-- CTAボタン -->
                <div class="clinic-cta-button-wrapper">
                    <p class="btn btn_second_primary">
                        <a href="${this.urlHandler.getClinicUrlWithRegionId(clinic.id, clinic.rank)}" target="_blank" rel="noopener noreferrer">
                            <span class="bt_s">無料カウンセリングはコチラ</span>
                            <span class="btn-arrow">▶</span>
                        </a>
                    </p>
                </div>
                
                <!-- クリニックのポイント -->
                <div class="clinic-points-section">
                    <h4 class="section-title">POINT</h4>
                    <div class="ribbon_point_box_no">
                        ${data.points.map((point, index) => {
                            let iconClass = 'fa-clock';
                            if (point.icon === 'lightbulb') iconClass = 'fa-lightbulb';
                            else if (point.icon === 'phone') iconClass = 'fa-mobile-alt';
                            else if (point.icon === 'coins') iconClass = 'fa-yen-sign';
                            
                            return `
                            <div class="ribbon_point_title2_s">
                                <i class="fas ${iconClass} point-icon-inline"></i>
                                <strong>${this.dataManager.processDecoTags(point.title)}</strong>
                            </div>
                            <div class="ribbon_point_txt">
                                <p style="font-size:14px;">${this.dataManager.processDecoTags(point.description)}</p>
                            </div>
                            `;
                        }).join('')}
                        <div class="ribbon_point_link">
                            【公式】<a href="${this.urlHandler.getClinicUrlWithRegionId(clinic.id, clinic.rank)}" target="_blank" rel="noopener"><strong>${data.priceDetail['公式サイト'] || '#'}</strong></a>
                        </div>
                    </div>
                </div>
                
                
                <!-- 口コミ -->
                <div class="reviews-section">
                    <h4 class="section-title-review">REVIEW</h4>
                    
                    <section id="review_tab_box">
                        <nav role="navigation" class="review_tab2">
                            <ul>
                                <li class="select2" data-tab="cost"><i class="fas fa-yen-sign"></i> コスパ</li>
                                <li data-tab="access"><i class="fas fa-user-md"></i> スタッフ</li>
                                <li data-tab="staff"><i class="fas fa-heart"></i> サービス</li>
                            </ul>
                        </nav>
                        ${(() => {
                            // 口コミデータを動的に取得
                            const clinicCode = this.dataManager.getClinicCodeById(clinicId);
                            const reviews = this.dataManager.getClinicReviews(clinicCode);
                            const reviewIcons = [
                                '../common_data/images/review_icon/review_icon1.webp',
                                '../common_data/images/review_icon/review_icon2.webp',
                                '../common_data/images/review_icon/review_icon3.webp',
                                '../common_data/images/review_icon/review_icon4.webp',
                                '../common_data/images/review_icon/review_icon5.webp',
                                '../common_data/images/review_icon/review_icon6.webp',
                                '../common_data/images/review_icon/review_icon7.webp',
                                '../common_data/images/review_icon/review_icon8.webp',
                                '../common_data/images/review_icon/review_icon9.webp'
                            ];
                            
                            let html = '';
                            
                            // コスパタブの口コミ
                            html += '<div class="wrap_long2 active">';
                            reviews.cost.forEach((review, index) => {
                                const iconIndex = (rank + index) % reviewIcons.length;
                                html += `
                                    <div class="review_tab_box_in">
                                        <div class="review_tab_box_img">
                                            <img src="${reviewIcons[iconIndex]}" alt="レビューアイコン">
                                            <span>★★★★★</span>
                                        </div>
                                        <div class="review_tab_box_r">
                                            <div class="review_tab_box_title"><strong>${review.title}</strong></div>
                                            <div class="review_tab_box_txt">
                                                ${review.content}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            });
                            html += '<p style="font-size:8px;text-align:right">※効果には個人差があります<br>※個人の感想です</p>';
                            html += '</div>';
                            
                            // 通いやすさタブの口コミ
                            html += '<div class="wrap_long2 disnon2">';
                            reviews.access.forEach((review, index) => {
                                const iconIndex = (rank + index + 3) % reviewIcons.length;
                                html += `
                                    <div class="review_tab_box_in">
                                        <div class="review_tab_box_img">
                                            <img src="${reviewIcons[iconIndex]}" alt="レビューアイコン">
                                            <span>★★★★★</span>
                                        </div>
                                        <div class="review_tab_box_r">
                                            <div class="review_tab_box_title"><strong>${review.title}</strong></div>
                                            <div class="review_tab_box_txt">
                                                ${review.content}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            });
                            html += '<p style="font-size:8px;text-align:right">※効果には個人差があります<br>※個人の感想です</p>';
                            html += '</div>';
                            
                            // スタッフタブの口コミ
                            html += '<div class="wrap_long2 disnon2">';
                            reviews.staff.forEach((review, index) => {
                                const iconIndex = (rank + index + 6) % reviewIcons.length;
                                html += `
                                    <div class="review_tab_box_in">
                                        <div class="review_tab_box_img">
                                            <img src="${reviewIcons[iconIndex]}" alt="レビューアイコン">
                                            <span>★★★★★</span>
                                        </div>
                                        <div class="review_tab_box_r">
                                            <div class="review_tab_box_title"><strong>${review.title}</strong></div>
                                            <div class="review_tab_box_txt">
                                                ${review.content}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            });
                            html += '<p style="font-size:8px;text-align:right">※効果には個人差があります<br>※個人の感想です</p>';
                            html += '</div>';
                            
                            return html;
                        })()}
                    </section>
                </div>
                
                <!-- 店舗情報 -->
                <div class="brand-section">
                    <h4 class="section-heading">
                        ${clinic.name}の【${this.dataManager.getRegionName(regionId)}】の店舗
                    </h4>
                    ${this.dataManager.generateStoresDisplay(clinicId, regionId)}
                </div>
                
                <!-- キャンペーンセクション -->
                <div class="campaign-section">
                    <div class="campaign-container">
                        ${(() => {
                            // キャンペーン情報を動的に生成
                            const clinicCode = this.dataManager.getClinicCodeById(clinicId);
                            
                            const campaignHeader = this.dataManager.getClinicText(clinicCode, 'キャンペーンヘッダー', 'INFORMATION!');
                            const campaignDescription = this.dataManager.getClinicText(clinicCode, 'INFORMATIONキャンペーンテキスト', '');
                            const campaignMicrocopy = this.dataManager.getClinicText(clinicCode, 'INFORMATIONサブテキスト', '＼月額・総額がリーズナブルなクリニック／');
                            const ctaText = this.dataManager.getClinicText(clinicCode, 'CTAボタンテキスト', `${clinic.name}の公式サイト`);
                            
                            const logoFolder = clinicCode === 'kireil' ? 'kireiline' : clinicCode;
                            const logoSrc = `../common_data/images/clinics/${logoFolder}/${logoFolder}-logo.webp`;
                            const logoAlt = clinic.name;
                            
                            return `
                            <div class="campaign-header">${campaignHeader}</div>
                            <div class="campaign-content">
                                <div class="camp_header3">
                                    <div class="info_logo">
                                        <img src="${logoSrc}" alt="${logoAlt}" onerror="this.onerror=null; this.src='../common_data/images/clinics/${logoFolder}/${logoFolder}-logo.jpg';">
                                    </div>
                                    <div class="camp_txt">
                                        ${campaignDescription}
                                    </div>
                                </div>
                                
                                <div class="cv_box_img">
                                    ${campaignMicrocopy}
                                    <p class="btn btn_second_primary" style="margin-top: 10px;">
                                        <a href="${this.urlHandler.getClinicUrlWithRegionId(clinicId, clinic.rank || 1)}" target="_blank" rel="noopener">
                                            <span class="bt_s">${ctaText}</span>
                                            <span class="btn-arrow">▶</span>
                                        </a>
                                    </p>
                                </div>
                            </div>
                            `;
                        })()}
                    </div>
            ${(() => {
                // 確認事項があるクリニックのみアコーディオンを表示
                const clinicCode = this.dataManager.getClinicCodeById(clinic.id);
                const disclaimerText = clinicCode ? this.dataManager.getClinicText(clinicCode, 'INFORMATION確認事項', '') : '';
                
                if (disclaimerText && disclaimerText.trim() !== '') {
                    return `
                    <!-- ${clinic.name}の確認事項アコーディオン -->
                    <div class="disclaimer-accordion" style="margin-top: 15px;">
                        <button class="disclaimer-header" onclick="toggleDisclaimer('${clinic.code}-campaign')" style="width: 100%; text-align: left; padding: 8px 12px; background-color: #fafafa; border: 1px solid #f0f0f0; border-radius: 3px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 10px; font-weight: 500; color: #666;">${clinic.name}の確認事項</span>
                            <span id="${clinic.code}-campaign-arrow" style="font-size: 8px; color: #999; transition: transform 0.2s;">▼</span>
                        </button>
                        <div id="${clinic.code}-campaign-content" class="disclaimer-content" style="display: none; padding: 8px 12px; background-color: #fcfcfc; border: 1px solid #f0f0f0; border-top: none; border-radius: 0 0 3px 3px; margin-top: -1px;">
                            <div style="font-size: 9px; color: #777; line-height: 1.4;">
                                ${disclaimerText.split('<br>').map(text => text.trim()).filter(text => text).map(text => `<p>${text}</p>`).join('\n                                ')}
                            </div>
                        </div>
                    </div>
                    `;
                }
                return '';
            })()}
                </div>
            </div>
            `;
            
            detailsList.appendChild(detailItem);
        });
    }

    // 店舗画像のパスを取得するメソッド（複数拡張子対応）
    getStoreImage(clinicName, storeNumber) {
        // 店舗番号を3桁の文字列に変換
        const paddedNumber = String(storeNumber).padStart(3, '0');
        const imagesPath = window.SITE_CONFIG ? window.SITE_CONFIG.imagesPath + '/images' : '/images';
        
        // 最初の拡張子でパスを返す（onerrorでフォールバックされる）
        const storeImagePath = `${imagesPath}/clinics/${clinicName}/${clinicName}_clinic/clinic_image_${paddedNumber}.webp`;
        
        return storeImagePath;
    }

    // 画像フォールバック処理（複数拡張子対応）
    handleImageError(imgElement, clinicName, storeNumber) {
        const paddedNumber = String(storeNumber).padStart(3, '0');
        const imagesPath = window.SITE_CONFIG ? window.SITE_CONFIG.imagesPath + '/images' : '/images';
        const extensions = ['jpg', 'png'];
        
        // 現在の拡張子を取得
        const currentSrc = imgElement.src;
        let currentExtIndex = -1;
        
        if (currentSrc.includes('.webp')) currentExtIndex = -1; // webpから開始
        else if (currentSrc.includes('.jpg')) currentExtIndex = 0;
        else if (currentSrc.includes('.png')) currentExtIndex = 1;
        
        // 次の拡張子を試す
        const nextExtIndex = currentExtIndex + 1;
        if (nextExtIndex < extensions.length) {
            imgElement.src = `${imagesPath}/clinics/${clinicName}/${clinicName}_clinic/clinic_image_${paddedNumber}.${extensions[nextExtIndex]}`;
        } else {
            // 全て失敗した場合、ロゴ画像にフォールバック
            imgElement.src = `${imagesPath}/clinics/${clinicName}/${clinicName}-logo.webp`;
            imgElement.onerror = () => {
                imgElement.src = `${imagesPath}/clinics/${clinicName}/${clinicName}-logo.jpg`;
            };
        }
    }

    // 地域IDから地域名を取得するヘルパーメソッド
    getRegionName(regionId) {
        if (!window.dataManager) {
            return '';
        }
        const region = window.dataManager.getRegionById(regionId);
        return region ? region.name : '';
    }

    // Google Maps iframeを生成
    generateMapIframe(address) {
        if (!address) {
            return '<p>住所情報がありません</p>';
        }
        
        // 住所をエンコード
        const encodedAddress = encodeURIComponent(address);
        
        // Google Maps Embed APIのURL
        const mapUrl = `https://maps.google.com/maps?q=${encodedAddress}&output=embed&z=16`;
        
        return `
            <iframe 
                src="${mapUrl}"
                width="100%" 
                height="300" 
                style="border:0;" 
                allowfullscreen="" 
                loading="lazy" 
                referrerpolicy="no-referrer-when-downgrade"
                title="Google Maps">
            </iframe>
        `;
    }

    // 地図モーダルのイベントリスナーを設定
    setupMapAccordions() {
        
        // モーダル要素を取得
        const mapModal = document.getElementById('map-modal');
        const mapModalClose = document.getElementById('map-modal-close');
        const mapModalOverlay = document.querySelector('.map-modal-overlay');
        
        // 既存のイベントリスナーを削除（この処理は不要なのでコメントアウト）
        // const mapButtons = document.querySelectorAll('.map-toggle-btn');
        // 
        // mapButtons.forEach(btn => {
        //     const newBtn = btn.cloneNode(true);
        //     btn.parentNode.replaceChild(newBtn, btn);
        // });

        // イベント委譲を使用して、動的に追加されたボタンにも対応
        const self = this; // thisを保存
        
        // 既存のイベントリスナーがあれば削除
        if (this.mapButtonClickHandler) {
            document.removeEventListener('click', this.mapButtonClickHandler, true);
        }
        
        // 新しいイベントリスナーを作成（モーダル表示）
        this.mapButtonClickHandler = (e) => {
            if (e.target.closest('.map-toggle-btn')) {
                e.preventDefault();
                const button = e.target.closest('.map-toggle-btn');
                
                // 店舗情報を取得（実際のHTML構造に合わせて修正）
                const shopContainer = button.closest('.shop');
                
                // コンテキストからクリニック名を優先的に取得（data-clinic-idベース）
                let clinicName = 'クリニック';
                try {
                    const shopsContainer = shopContainer?.closest('.shops');
                    const clinicDetailElement = shopsContainer?.closest('.detail-item');
                    const contextualClinicId = clinicDetailElement?.getAttribute('data-clinic-id');
                    if (contextualClinicId && self.dataManager) {
                        const contextualClinic = self.dataManager.clinics?.find(c => c.id == contextualClinicId);
                        if (contextualClinic) {
                            clinicName = contextualClinic.name;
                        }
                    }
                } catch (ctxErr) {
                    console.warn('Failed to resolve context clinic:', ctxErr);
                }
                
                if (shopContainer) {
                    // 店舗名を取得
                    const storeNameElement = shopContainer.querySelector('.shop-name a');
                    const storeName = storeNameElement?.textContent?.trim() || '店舗';
                    
                    // 住所を取得
                    const addressElement = shopContainer.querySelector('.shop-address');
                    const address = addressElement?.textContent?.trim() || '住所情報なし';
                    
                    // アクセス情報を取得
                    let access = '駅から徒歩圏内'; // デフォルト値
                    
                    // CSVデータから正確なアクセス情報とクリニック名を取得
                    if (self.dataManager) {
                        const stores = self.dataManager.stores; // 直接storesプロパティを参照
                        // 店舗名と住所が一致する店舗を探す
                        const matchingStore = stores.find(store => {
                            return store.storeName === storeName && store.address === address;
                        });
                        
                        if (matchingStore) {
                            if (matchingStore.access) {
                                access = matchingStore.access;
                            }
                            // クリニック名はDOMコンテキスト優先。未解決の場合のみCSVの値を採用
                            if (clinicName === 'クリニック' && matchingStore.clinicName) {
                                clinicName = matchingStore.clinicName;
                            }
                        } else {
                            // CSVから見つからない場合は、HTMLから取得を試みる
                            const shopInfoElement = shopContainer.querySelector('.shop-info');
                            if (shopInfoElement) {
                                const infoText = shopInfoElement.textContent;
                                const lines = infoText.split('\n').map(line => line.trim()).filter(line => line);
                                const accessLine = lines.find(line => line.includes('駅') && (line.includes('徒歩') || line.includes('分')));
                                if (accessLine) {
                                    access = accessLine;
                                }
                            }
                        }
                    }
                    
                    // CSVからクリニック名を取得できなかった場合のみ、HTMLから取得
                    if (clinicName === 'クリニック') {
                        // data-clinic-idで未解決なら、h3要素から取得を試みる
                        const shopsContainer2 = shopContainer.closest('.shops');
                        const clinicDetailElement2 = shopsContainer2?.closest('.detail-item');
                        if (clinicName === 'クリニック') {
                            const h3Element = clinicDetailElement?.querySelector('h3');
                            if (h3Element) {
                                // h3のテキストから「ⓘ」などの記号を除去
                                const h3Text = h3Element.childNodes[0]?.textContent?.trim() || h3Element.textContent?.trim();
                                
                                // h3テキストから直接クリニック名を取得
                                if (h3Text && h3Text !== '') {
                                    // データベースから正確なクリニック名を検索
                                    if (self.dataManager && self.dataManager.clinics) {
                                        const matchedClinic = self.dataManager.clinics.find(c => 
                                            h3Text.includes(c.name) || c.name.includes(h3Text)
                                        );
                                        if (matchedClinic) {
                                            clinicName = matchedClinic.name;
                                        }
                                    }
                                }
                                
                                // それでも見つからない場合は、リンクのhrefから取得
                                if (clinicName === 'クリニック') {
                                    const detailButtons = clinicDetailElement2?.querySelectorAll('.detail_btn_2, .link_btn');
                                    if (detailButtons.length > 0) {
                                        const href = detailButtons[0].getAttribute('href');
                                        // redirect.htmlのクエリパラメータからclinic_idを取得
                                        const clinicIdMatch = href?.match(/clinic_id=(\d+)/);
                                        if (clinicIdMatch) {
                                            const extractedClinicId = clinicIdMatch[1];
                                            const clinic = self.dataManager?.clinics?.find(c => c.id == extractedClinicId);
                                            if (clinic) {
                                                clinicName = clinic.name;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    
                    // モーダルに情報を設定
                    try {
                        // デバッグ用に詳細ログを追加
                        
                        // 店舗名が「クリニック 渋谷院」のような形式の場合、「クリニック」を正しいクリニック名に置換
                        let fullStoreName = storeName;
                        if (storeName.startsWith('クリニック')) {
                            // 「クリニック 新宿院」→「ディオクリニック新宿院」
                            fullStoreName = clinicName + storeName.replace('クリニック', '').trim();
                        } else if (!storeName.includes(clinicName)) {
                            // 店舗名にクリニック名が含まれていない場合、追加
                            fullStoreName = clinicName + storeName;
                        }
                        
                        self.showMapModal(fullStoreName, address, access, clinicName);
                    } catch (error) {
                    }
                } else {
                    
                    // フォールバック: 最低限の情報でモーダルを表示
                    try {
                        self.showMapModal('テストクリニック', 'テスト住所', 'テストアクセス', 'test');
                    } catch (error) {
                    }
                }
            }
        };
        
        // イベントリスナーを追加
        document.addEventListener('click', this.mapButtonClickHandler, true);
        
        // モーダルを閉じるイベント
        if (mapModalClose) {
            mapModalClose.addEventListener('click', () => {
                self.hideMapModal();
            });
        }
        
        if (mapModalOverlay) {
            mapModalOverlay.addEventListener('click', () => {
                self.hideMapModal();
            });
        }
        
        // ESCキーでモーダルを閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mapModal?.style.display !== 'none') {
                self.hideMapModal();
            }
        });
    }
    
    // 地図モーダルを表示
    showMapModal(clinicName, address, access, clinicCode) {
        
        const modal = document.getElementById('map-modal');
        const modalClinicName = document.getElementById('map-modal-clinic-name');
        const modalAddress = document.getElementById('map-modal-address');
        const modalAccess = document.getElementById('map-modal-access');
        const modalHours = document.getElementById('map-modal-hours');
        const modalMapContainer = document.getElementById('map-modal-map-container');
        const modalButton = document.getElementById('map-modal-button');
        
        if (modal && modalClinicName && modalAddress && modalAccess && modalMapContainer) {
            // まずモーダルを表示
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // スクロールを無効化
            
            // モーダルの内容を設定
            modalClinicName.textContent = clinicName;
            modalAddress.textContent = address;
            modalAccess.textContent = access;
            
            // 営業時間を設定（クリニックごとに異なる場合は条件分岐を追加）
            if (modalHours) {
                // デフォルトの営業時間を設定
                let hours = '11:00〜21:00';
                
                // クリニック名に基づいて営業時間を調整（必要に応じて）
                if (clinicName.includes('DIO') || clinicName.includes('ディオ')) {
                    hours = '11:00〜21:00';
                } else if (clinicName.includes('エミナル')) {
                    hours = '11:00〜21:00';
                } else if (clinicName.includes('湘南')) {
                    hours = '10:00〜19:00';
                } else if (clinicName.includes('リエート')) {
                    hours = '11:00〜20:00';
                } else if (clinicName.includes('ウララ')) {
                    hours = '11:00〜20:00';
                }
                
                modalHours.textContent = hours;
            }
            
            // Google Maps iframeを生成
            modalMapContainer.innerHTML = this.generateMapIframe(address);
            
            // 公式サイトボタンのURLとテキストを設定（エラーが発生してもモーダルは表示される）
            if (modalButton) {
                try {
                // クリニック名からクリニックコードを取得
                let clinicKey = '';
                const clinics = this.dataManager.clinics || [];
                
                // clinicCodeパラメータはクリニック名なので、クリニック名で検索
                const clinic = clinics.find(c => 
                    c.name === clinicCode || 
                    clinicName.includes(c.name) || 
                    c.name === clinicName
                );
                
                if (clinic) {
                    clinicKey = clinic.code;
                } else {
                    // フォールバック：クリニック名から推測
                    if (clinicName.includes('ディオ')) {
                        clinicKey = 'dio';
                    } else if (clinicName.includes('エミナル')) {
                        clinicKey = 'eminal';
                    } else if (clinicName.includes('湘南')) {
                        clinicKey = 'sbc';
                    } else if (clinicName.includes('リエート')) {
                        clinicKey = 'lieto';
                    } else if (clinicName.includes('ウララ')) {
                        clinicKey = 'urara';
                    } else if (clinicName.includes('DS')) {
                        clinicKey = 'dsc';
                    }
                }
                
                // urlHandlerのインスタンスがある場合は使用、なければ直接URLを生成
                let generatedUrl = '#';
                
                try {
                    if (window.urlHandler) {
                        generatedUrl = window.urlHandler.getClinicUrlByNameWithRegionId(clinicKey);
                    }
                } catch (e) {
                }
                
                // URLが生成できなかった場合のフォールバック
                if (!generatedUrl || generatedUrl === '#') {
                    // 直接redirect.htmlへのリンクを生成
                    const regionId = new URLSearchParams(window.location.search).get('region_id') || '000';
                    if (clinic) {
                        generatedUrl = `./redirect.html?clinic_id=${clinic.id}&rank=1&region_id=${regionId}`;
                    }
                }
                
                // URLが正しく生成されているか確認
                if (generatedUrl && generatedUrl !== '#' && generatedUrl !== '') {
                    modalButton.href = generatedUrl;
                    modalButton.target = '_blank';
                    modalButton.rel = 'noopener';
                    
                    // クリックイベントを削除（通常のリンクとして動作させる）
                    modalButton.onclick = null;
                } else {
                    // URLが生成できない場合は、メインページのクリニック詳細へスクロール
                    modalButton.href = '#';
                    modalButton.onclick = (e) => {
                        e.preventDefault();
                        this.hideMapModal();
                        // クリニック詳細セクションへスクロール
                        const clinicDetail = document.querySelector(`[data-clinic-id="${clinic?.id || '1'}"]`);
                        if (clinicDetail) {
                            clinicDetail.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    };
                }
                
                    // ボタンテキストを設定
                    const buttonText = document.getElementById('map-modal-button-text');
                    if (buttonText) {
                        // クリニック名を取得
                        let clinicBaseName = '';
                        if (clinicCode.includes('ディオ')) {
                            clinicBaseName = 'ディオクリニック';
                        } else if (clinicCode.includes('エミナル')) {
                            clinicBaseName = 'エミナルクリニック';
                        } else if (clinicCode.includes('湘南')) {
                            clinicBaseName = '湘南美容クリニック';
                        } else if (clinicCode.includes('リエート')) {
                            clinicBaseName = 'リエートクリニック';
                        } else if (clinicCode.includes('ウララ')) {
                            clinicBaseName = 'ウララクリニック';
                        } else {
                            clinicBaseName = 'クリニック';
                        }
                        buttonText.textContent = clinicBaseName + 'の公式サイト';
                    }
                } catch (error) {
                    // エラーが発生してもモーダルは表示されたままにする
                    modalButton.href = '#';
                    modalButton.onclick = (e) => {
                        e.preventDefault();
                        this.hideMapModal();
                    };
                }
            }
        } else {
        }
    }
    
    // 地図モーダルを非表示
    hideMapModal() {
        const modal = document.getElementById('map-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = ''; // スクロールを再度有効化
        }
    }
}

// 店舗の表示を切り替える関数（一度だけ開く）
function toggleStores(button) {
    const targetId = button.getAttribute('data-target');
    const targetShops = document.querySelector(targetId);
    const hiddenShops = targetShops.querySelectorAll('.hidden-content');
    
    // 隠されている店舗を表示
    hiddenShops.forEach(shop => {
        shop.classList.remove('hidden');
    });
    
    // ボタンを非表示にする（一度クリックしたら消える）
    button.style.display = 'none';
}

// アプリケーションの起動（DOM読み込み完了後に実行）
// 注: この部分は削除して、下の初期化コードに統合します
/*
document.addEventListener('DOMContentLoaded', () => {
    const app = new RankingApp();
    app.init();
    
    // Smooth scrolling for table of contents links
    // Temporarily disabled for debugging scroll issues
    
    document.querySelectorAll('.toc-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
                
                window.scrollTo({
                    top: targetPosition - 80,
                    behavior: 'smooth'
                });
            }
            
            return false;
        });
    });
    */
    
    // Prevent default behavior for all href="#" links
    // This prevents page jumping to top
    // Temporarily disabled for debugging - too broad impact with capture phase
    /*
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a[href="#"]');
        if (link) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true);
    */
// });

// アプリケーションの初期化
// 比較表の注釈を動的に生成する関数
function initializeDisclaimers() {
    // 両方の場所に注意事項を表示
    const mainContent = document.getElementById('main-content');
    const rankingDisclaimers = document.getElementById('ranking-disclaimers-content');
    
    if (!window.dataManager) {
        return;
    }
    
    if (!mainContent && !rankingDisclaimers) {
        return;
    }

    // 現在選択されている地域IDを取得
    // 方法1: RankingAppのインスタンスから取得（推奨）
    let regionId = window.app?.currentRegionId;
    
    // 方法2: 上記が取得できない場合はURLパラメータから直接取得
    if (!regionId) {
        const urlParams = new URLSearchParams(window.location.search);
        regionId = urlParams.get('region_id');
    }
    
    // デフォルトは東京（13）- データと一致させる
    if (!regionId) {
        regionId = '13';
    }
    
    // パディングを除去（013 -> 13）
    regionId = String(parseInt(regionId, 10));
    
    
    // ランキングデータを取得
    const ranking = window.dataManager.getRankingByRegionId(regionId);
    if (!ranking || !ranking.ranks) {
        mainContent.innerHTML = ''; // 空にする
        return;
    }
    

    // 1位~5位のクリニックを取得
    const topClinics = [];
    for (let i = 1; i <= 5; i++) {
        const clinicId = ranking.ranks[`no${i}`];
        
        // '-' や無効なIDをスキップ
        if (clinicId && clinicId !== '-' && clinicId !== '') {
            const clinic = window.dataManager.getClinicById(clinicId);
            if (clinic) {
                const clinicCode = window.dataManager.getClinicCodeById(clinicId);
                if (clinicCode) {
                    topClinics.push({
                        rank: i,
                        id: clinicId,
                        code: clinicCode,
                        name: clinic.name
                    });
                } else {
                }
            } else {
            }
        } else {
        }
    }

    // 有効なクリニックがない場合
    if (topClinics.length === 0) {
        mainContent.innerHTML = '';
        return;
    }


    // HTMLを生成 - cryolipolysisと同じスタイルで階層的なアコーディオン
    let disclaimerHTML = '';
    let disclaimerCount = 0;
    
    topClinics.forEach(clinic => {
        // 比較表の注意事項を取得
        const disclaimerText = window.dataManager.getClinicText(clinic.code, '比較表の注意事項', '');
        
        
        // 注意事項がある場合のみ表示
        if (disclaimerText && disclaimerText.trim() !== '') {
            disclaimerCount++;
            const clinicSlug = clinic.code.toLowerCase().replace(/\s+/g, '');
            
            disclaimerHTML += `
                <div class="disclaimer-item">
                    <button class="disclaimer-header" onclick="toggleDisclaimer('${clinicSlug}')" style="width: 100%; text-align: left; padding: 6px 10px; background-color: #f8f8f8; border: 1px solid #eeeeee; border-radius: 2px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <span style="font-size: 9px; font-weight: 400; color: #777;">${clinic.name}</span>
                        <span id="${clinicSlug}-arrow" style="font-size: 7px; color: #aaa; transition: transform 0.2s;">▼</span>
                    </button>
                    <div id="${clinicSlug}-content" class="disclaimer-content" style="display: none; padding: 6px 10px; background-color: #fefefe; border: 1px solid #eeeeee; border-top: none; border-radius: 0 0 2px 2px; margin-top: -2px;">
                        <div style="font-size: 9px; color: #777; line-height: 1.4;">
                            ${disclaimerText.split('\n').map(line => line.trim()).filter(line => line).map(line => `<p>${line}</p>`).join('\n                            ')}
                        </div>
                    </div>
                </div>
            `;
        }
    });

    // 生成したHTMLを両方の場所に挿入
    if (disclaimerCount > 0) {
        if (mainContent) {
            mainContent.innerHTML = disclaimerHTML;
        }
        if (rankingDisclaimers) {
            rankingDisclaimers.innerHTML = disclaimerHTML;
        }
    } else {
        const noDisclaimerMessage = '<p style="font-size: 11px; color: #666; padding: 10px;">注意事項はありません。</p>';
        if (mainContent) {
            mainContent.innerHTML = noDisclaimerMessage;
        }
        if (rankingDisclaimers) {
            rankingDisclaimers.innerHTML = noDisclaimerMessage;
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    
    const app = new RankingApp();
    window.app = app; // グローバルアクセス用
    
    app.init();
    
    // 比較表の注釈を動的に初期化
    setTimeout(() => {
        initializeDisclaimers();
    }, 100);
    
    // 初期化後にも一度詳細リンクをチェック
    setTimeout(() => {
        const allDetailLinks = document.querySelectorAll('a[href*="#clinic"]');
        
        // #clinicを含むリンクにイベントリスナーを追加
        allDetailLinks.forEach((link, index) => {
            link.addEventListener('click', (e) => {
                // デフォルトの動作（アンカーリンクへのジャンプ）は維持
            });
        });
        
        // グローバルなクリックイベントリスナーも追加（デバッグ用）
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'A' && (e.target.textContent.includes('詳細を見る') || e.target.textContent.includes('詳細をみる'))) {
                // Track detail link click
            }
        }, true);
    }, 500);
    
    // フッターのページリンクにパラメータ引き継ぎ機能を追加
    document.querySelectorAll('.footer-page-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const currentParams = new URLSearchParams(window.location.search);
            if (currentParams.toString()) {
                const url = new URL(this.href, window.location.origin);
                // 全てのパラメータを追加
                for (const [key, value] of currentParams) {
                    url.searchParams.set(key, value);
                }
                window.location.href = url.toString();
            } else {
                window.location.href = this.href;
            }
        });
    });
});