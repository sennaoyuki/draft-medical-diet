// coolsculptingディレクトリ用の設定（動的basePath）
(function() {
    // 現在のURLパスからbasePathを自動生成
    const currentPath = window.location.pathname;
    const pathSegments = currentPath.split('/').filter(segment => segment);

    // 最後のセグメントが現在のディレクトリ名
    const currentDir = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : '';

    // basePathを動的に設定（GitHub Pagesやサブディレクトリ対応）
    const basePath = currentDir ? '/' + currentDir : '';

    window.SITE_CONFIG = {
        basePath: basePath,
        assetsPath: '.',
        dataPath: './data',
        imagesPath: './images',
        currentDir: currentDir
    };

    console.log('🔧 SITE_CONFIG initialized:', window.SITE_CONFIG);
})();