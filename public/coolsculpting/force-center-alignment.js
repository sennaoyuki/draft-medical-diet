// JavaScriptでSlickの動的スタイルを強制的に修正するスクリプト

(function() {
    function forceCenterAlignment() {
        const caseSliders = document.querySelectorAll('.case-slider.slick-initialized');
        
        caseSliders.forEach(slider => {
            const slides = slider.querySelectorAll('.slick-slide');
            const track = slider.querySelector('.slick-track');
            
            // trackのtransformをリセット
            if (track) {
                track.style.transform = 'none';
                track.style.display = 'flex';
                track.style.justifyContent = 'center';
                track.style.alignItems = 'center';
            }
            
            slides.forEach(slide => {
                // スライドの幅を100%に強制
                slide.style.width = '100%';
                slide.style.minWidth = '100%';
                slide.style.display = 'flex';
                slide.style.justifyContent = 'center';
                slide.style.alignItems = 'center';
                slide.style.position = 'relative';
                slide.style.left = 'auto';
                slide.style.transform = 'none';
                
                const img = slide.querySelector('img');
                if (img) {
                    const viewportWidth = window.innerWidth;
                    
                    // ビューポートサイズに応じて画像サイズを調整
                    if (viewportWidth <= 375) {
                        img.style.maxWidth = '75%';
                        img.style.maxHeight = '180px';
                    } else if (viewportWidth <= 414) {
                        img.style.maxWidth = '80%';
                        img.style.maxHeight = '200px';
                    } else if (viewportWidth <= 768) {
                        img.style.maxWidth = '85%';
                        img.style.maxHeight = '250px';
                    } else {
                        img.style.maxWidth = '600px';
                        img.style.maxHeight = '400px';
                    }
                    
                    img.style.width = 'auto';
                    img.style.height = 'auto';
                    img.style.margin = '0 auto';
                    img.style.display = 'block';
                    img.style.objectFit = 'contain';
                    img.style.padding = '0';
                }
            });
        });
    }
    
    // 初期実行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', forceCenterAlignment);
    } else {
        forceCenterAlignment();
    }
    
    // Slickの初期化後に実行
    setTimeout(forceCenterAlignment, 1000);
    
    // リサイズ時に再実行
    window.addEventListener('resize', forceCenterAlignment);
    
    // MutationObserverでSlick初期化を監視
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && 
                mutation.attributeName === 'class' &&
                mutation.target.classList.contains('slick-initialized')) {
                setTimeout(forceCenterAlignment, 100);
            }
        });
    });
    
    const caseSliders = document.querySelectorAll('.case-slider');
    caseSliders.forEach(slider => {
        observer.observe(slider, { attributes: true });
    });
})();