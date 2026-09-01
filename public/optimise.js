// Show promotional carousel loading screen
(function initCarousel() {
    // Wait for body to exist
    if (!document.body) {
        document.addEventListener('DOMContentLoaded', initCarousel);
        return;
    }
    
    // Add carousel styles
    const style = document.createElement('style');
    style.textContent = `
        html.loading-active, body.loading-active {
            overflow: hidden !important;
        }
        #__promo-carousel {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            margin: 0;
            padding: 0;
        }
        #__promo-carousel.fade-out {
            opacity: 0;
            transition: opacity 0.5s ease-out;
        }
        .carousel-container {
            width: 100%;
            height: 100%;
            position: relative;
            overflow: hidden;
        }
        .carousel-slide {
            position: absolute;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            opacity: 0;
            transition: opacity 0.8s ease-in-out;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .carousel-slide.active {
            opacity: 1;
        }
        .carousel-slide img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            width: auto;
            height: auto;
        }
        .carousel-indicator {
            position: absolute;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 12px;
            z-index: 10;
        }
        .indicator-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.5);
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .indicator-dot.active {
            background: white;
            width: 30px;
            border-radius: 6px;
        }
        .loading-text {
            position: absolute;
            top: 30px;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            font-size: 18px;
            font-weight: 300;
            letter-spacing: 2px;
        }
        .progress-bar-container {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: rgba(255,255,255,0.2);
        }
        .progress-bar {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #007bff, #00d4ff);
            transition: width 0.1s linear;
        }
        .skip-btn {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.5);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 14px;
            z-index: 10;
            transition: background 0.3s;
        }
        .skip-btn:hover {
            background: rgba(255,255,255,0.3);
        }
    `;
    document.head.appendChild(style);
    
    // Prevent scrolling during loading
    document.body.classList.add('loading-active');
    document.documentElement.classList.add('loading-active');
    
    // Create carousel container
    const carousel = document.createElement('div');
    carousel.id = '__promo-carousel';
    
    const container = document.createElement('div');
    container.className = 'carousel-container';
    
    // Add loading text
    const loadingText = document.createElement('div');
    loadingText.className = 'loading-text';
    loadingText.textContent = 'Loading...';
    container.appendChild(loadingText);
    
    // Pick 2-3 random images from the 9 available
    const numSlides = Math.random() > 0.5 ? 3 : 2;
    const allImages = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const selectedImages = [];
    for (let i = 0; i < numSlides; i++) {
        const randomIndex = Math.floor(Math.random() * allImages.length);
        selectedImages.push(allImages.splice(randomIndex, 1)[0]);
    }
    
    // Create slides for selected images only
    const slides = [];
    selectedImages.forEach((imgNum, idx) => {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide' + (idx === 0 ? ' active' : '');
        
        const img = document.createElement('img');
        img.src = '/loaders/' + imgNum + '.png';
        img.alt = 'Promo ' + imgNum;
        
        slide.appendChild(img);
        container.appendChild(slide);
        slides.push(slide);
    });
    
    // Add progress bar (no skip, no indicators - max pain!)
    const progressBarContainer = document.createElement('div');
    progressBarContainer.className = 'progress-bar-container';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBarContainer.appendChild(progressBar);
    container.appendChild(progressBarContainer);
    
    carousel.appendChild(container);
    document.body.appendChild(carousel);
    
    // Carousel logic
    let currentSlide = 0;
    const totalSlides = numSlides;
    const totalDuration = 7000; // 7 seconds total
    const slideDuration = totalDuration / numSlides; // Each slide shows for equal time
    const startTime = Date.now();
    
    function updateCarousel() {
        slides.forEach((slide, idx) => {
            slide.classList.toggle('active', idx === currentSlide);
        });
    }
    
    // Auto-advance carousel
    const carouselInterval = setInterval(() => {
        currentSlide = (currentSlide + 1) % totalSlides;
        updateCarousel();
    }, slideDuration);
    
    // Update progress bar
    const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min((elapsed / totalDuration) * 100, 100);
        progressBar.style.width = percent + '%';
        
        if (elapsed >= totalDuration) {
            finishLoading();
        }
    }, 50);
    
    function finishLoading() {
        clearInterval(carouselInterval);
        clearInterval(progressInterval);
        carousel.classList.add('fade-out');
        document.body.classList.remove('loading-active');
        document.documentElement.classList.remove('loading-active');
        setTimeout(() => {
            carousel.remove();
        }, 500);
    }
})();

// Subtle layout shifts that don't dominate the page
setTimeout(() => {
    const banner = document.createElement('div');
    banner.innerHTML = 'Promotional banner';
    banner.style.background = '#fffa63';
    banner.style.height = '30px';
    banner.style.display = 'flex';
    banner.style.alignItems = 'center';
    banner.style.justifyContent = 'center';
    banner.style.fontWeight = 'bold';
    banner.style.fontSize = '12px';
    document.body.prepend(banner);
    setTimeout(() => { banner.style.height = '50px'; }, 1000);
}, 500);

// CPU work to hurt performance without freezing
setInterval(() => {
    // Moderate CPU work
    for (let i = 0; i < 50000; i++) {
        Math.sin(Math.random()) * Math.cos(Math.random());
    }
}, 200);

setInterval(() => {
    for (let i = 0; i < 10000; i++) {
        Math.pow(Math.random(), Math.random());
    }
}, 500);

// Load huge CSS libraries
const cssLibs = [
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.css',
    'https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.css',
    'https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.5.0/semantic.css',
    'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.css'
];
cssLibs.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
});

// Massive unoptimized images with no lazy loading
function addUnoptimizedImages() {
    const images = [
        'https://picsum.photos/4000/3000.jpg',
        'https://picsum.photos/5000/4000.jpg',
        'https://picsum.photos/6000/4500.jpg',
        'https://via.placeholder.com/3840x2160.jpg?text=HugeImage1',
        'https://via.placeholder.com/3840x2160.jpg?text=HugeImage2',
        'https://via.placeholder.com/3840x2160.jpg?text=HugeImage3',
        'https://via.placeholder.com/3840x2160.jpg?text=HugeImage4',
        'https://via.placeholder.com/3840x2160.jpg?text=HugeImage5'
    ];
    
    images.forEach((src, idx) => {
        const img = new Image();
        img.src = src; // Load immediately, no lazy loading
        img.style.width = '100%';
        img.style.height = 'auto';
        img.loading = 'eager'; // Opposite of lazy
        document.body.appendChild(img);
    });
}
addUnoptimizedImages();

// Inline massive SVG data to bloat HTML size
const massiveSVG = `<svg style="display: none; width: 0; height: 0;" xmlns="http://www.w3.org/2000/svg">
${Array(5000).fill('<path d="M 10 10 L 20 20 L 30 10 Q 40 40 50 50 C 60 60 70 70 80 80 Z" stroke="red" fill="none" stroke-width="2"/>').join('')}
</svg>`;
document.body.innerHTML += massiveSVG;

// Add hidden elements to bloat DOM but keep it reasonable
for (let i = 0; i < 2000; i++) {
    const div = document.createElement('div');
    div.style.display = 'none';
    div.innerHTML = `Hidden element ${i} with some text to increase size`;
    document.body.appendChild(div);
}

// Add nested divs
document.addEventListener('DOMContentLoaded', () => {
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;overflow:hidden;';
    
    for (let i = 0; i < 3000; i++) {
        const div = document.createElement('div');
        div.className = `div-${i}`;
        div.innerHTML = `<div><div><div>Nested div ${i}</div></div></div>`;
        container.appendChild(div);
    }
    
    document.body.appendChild(container);
});

// Create divs continuously but slower
setInterval(() => {
    for (let i = 0; i < 100; i++) {
        const div = document.createElement('div');
        div.textContent = `Dynamic div ${Date.now()}_${i}`;
        div.style.display = 'none';
        document.body.appendChild(div);
    }
}, 5000);

// Load tons of heavy blocking scripts
const heavyScripts = [
    'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js',
    'https://cdn.jsdelivr.net/npm/moment@2.29.4/moment.min.js',
    'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js',
    'https://cdn.jsdelivr.net/npm/jquery@3.6.4/dist/jquery.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js',
    'https://cdn.jsdelivr.net/npm/axios@1.4.0/dist/axios.min.js',
    'https://cdn.jsdelivr.net/npm/vue@3.3.4/dist/vue.global.js',
    'https://unpkg.com/react@18.2.0/umd/react.production.min.js'
];

heavyScripts.forEach(src => {
    const script = document.createElement('script');
    script.src = src;
    // No async or defer - make it blocking!
    document.head.appendChild(script);
});

// Add third-party tracking scripts (render-blocking)
const trackingScripts = [
    'https://connect.facebook.net/en_US/sdk.js',
    'https://platform.twitter.com/widgets.js',
    'https://apis.google.com/js/platform.js',
    'https://www.google-analytics.com/analytics.js',
    'https://www.googletagmanager.com/gtag/js?id=UA-XXXXX-Y'
];

trackingScripts.forEach(src => {
    const script = document.createElement('script');
    script.src = src;
    document.head.appendChild(script);
});

// Inefficient DOM queries at reasonable intervals
document.addEventListener('DOMContentLoaded', () => {
    // Query elements periodically
    setInterval(() => {
        const all = document.querySelectorAll('*');
        console.log('Elements:', all.length);
    }, 2000);

    // Some layout thrashing but not constant
    setInterval(() => {
        const divs = document.querySelectorAll('div');
        if (divs.length > 0) {
            divs[0].offsetHeight;
        }
    }, 1000);
});

// Memory allocation that leaks slowly
let cache = {};
let leakyArrays = [];

// Create gradual memory leak
setInterval(() => {
    const bigArray = new Array(10000).fill(Math.random());
    leakyArrays.push(bigArray);
    
    for (let i = 0; i < 100; i++) {
        cache['item_' + Date.now() + '_' + i] = {
            data: new Array(100).fill(Math.random()),
            timestamp: Date.now()
        };
    }
}, 5000);

window.__memoryLeak = cache;
window.__leakyArrays = leakyArrays;

// Unused code (bloats bundle)
function calculateComplexMath(n) {
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(Math.random());
    }
    return result;
}

function anotherUnusedFunction() {
    return calculateComplexMath(100);
}

// Generate massive CSS to bloat the page
const styles = document.createElement('style');
let cssRules = '';
for (let i = 0; i < 10000; i++) {
    cssRules += `.generated-class-${i} { 
        color: hsl(${i % 360}, 100%, 50%); 
        background: linear-gradient(${i}deg, rgba(${i%255},${(i*2)%255},${(i*3)%255},0.8), rgba(${(i*4)%255},${(i*5)%255},${(i*6)%255},0.8));
        transform: rotate(${i}deg) scale(${1 + i/10000});
        box-shadow: 0 0 ${i}px rgba(0,0,0,0.5);
    }\n`;
}
styles.innerHTML = cssRules;
document.head.appendChild(styles);

// Add inline styles to every element
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.querySelectorAll('*').forEach((el, idx) => {
            el.style.cssText += `
                transition: all 0.3s ease;
                will-change: transform, opacity;
                filter: hue-rotate(${idx}deg);
            `;
        });
    }, 500);
});

// No service worker means no caching
if ('serviceWorker' in navigator) {
    // Intentionally don't register
    console.log('Service worker not implemented');
}

// Third-party scripts that slow everything down
const thirdPartyScripts = [
    'https://connect.facebook.net/en_US/sdk.js',
    'https://platform.twitter.com/widgets.js',
    'https://apis.google.com/js/platform.js'
];

thirdPartyScripts.forEach(src => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    // script.defer = true; // Intentionally missing defer
    document.head.appendChild(script);
});

// Lazy load images the WRONG way (downloads immediately anyway)
setTimeout(() => {
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => {
        img.src = img.getAttribute('data-src');
    });
}, 1000);

for (let i = 0; i < 5; i++) {
    document.addEventListener('scroll', () => {
        // Heavy calculation on scroll
        const expensive = Math.sqrt(Math.random() * 1000000);
    });
}

document.head.innerHTML += `
<meta http-equiv="Content-Encoding" content="gzip">
<!-- But actually not using gzip -->
`;

// Global scope pollution
window.unusedGlobal1 = new Array(100).fill(Math.random());
window.unusedGlobal2 = { data: new Array(100).fill('x'.repeat(50)) };
window.unusedGlobal3 = () => console.log('unused');

// Force native "Leave site?" dialog - track user interaction
let userHasInteracted = false;

// Register any user gesture to enable beforeunload
['click', 'keydown', 'mousedown', 'touchstart', 'scroll', 'mousemove'].forEach(eventType => {
    document.addEventListener(eventType, () => {
        userHasInteracted = true;
    }, { once: true, passive: true });
});

// Set up beforeunload handler
window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = '';
    return '';
});

window.onbeforeunload = (e) => {
    e.preventDefault();
    e.returnValue = '';
    return '';
};

// Force a user interaction after a brief delay to enable the prompt
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!userHasInteracted) {
            const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
            document.body.dispatchEvent(evt);
            userHasInteracted = true;
        }
    }, 500);
});

// Randomly reload the page after a jittered delay to disrupt user sessions
function scheduleRandomReload() {
    const minDelay = 8000; // 8s
    const maxDelay = 45000; // 45s
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    setTimeout(() => {
        location.reload();
    }, delay);
}

scheduleRandomReload();

// ===== BEST PRACTICES DESTRUCTION =====
// Use deprecated and insecure APIs
document.write('<div style="display:none">Using document.write for maximum badness</div>');

// Generate console errors constantly
setInterval(() => {
    console.error('Critical error: System malfunction at ' + Date.now());
    throw new Error('Intentional error to pollute console');
}, 5000);

// Use eval() for security violations
setInterval(() => {
    try {
        eval('var x = Math.random(); console.log("eval running: " + x);');
    } catch(e) {}
}, 3000);

// Add insecure inline event handlers everywhere
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('*').forEach(el => {
        el.setAttribute('onclick', 'javascript:void(0)');
    });
});

// Load resources over HTTP to trigger mixed content warnings
setTimeout(() => {
    const insecureImg = new Image();
    insecureImg.src = 'http://via.placeholder.com/1x1.jpg';
    const insecureScript = document.createElement('script');
    insecureScript.src = 'http://code.jquery.com/jquery-1.4.2.min.js';
    document.head.appendChild(insecureScript);
}, 1000);

// Use deprecated APIs
if (document.all) { console.log('Using document.all'); }
document.bgColor = '#ffffff';

// ===== ACCESSIBILITY DESTRUCTION =====
// Remove all alt text from images
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('img').forEach(img => {
        img.removeAttribute('alt');
        img.setAttribute('title', ''); // Remove title too
    });
    
    // Remove labels from inputs
    document.querySelectorAll('label').forEach(label => {
        label.remove();
    });
    
    // Remove ARIA labels
    document.querySelectorAll('[aria-label]').forEach(el => {
        el.removeAttribute('aria-label');
    });
    
    // Add poor color contrast
    const badContrastStyle = document.createElement('style');
    badContrastStyle.innerHTML = `
        body { background: #ccc !important; color: #ddd !important; }
        a { color: #bbb !important; }
        button { background: #ddd !important; color: #eee !important; border: 1px solid #ddd !important; }
        input { background: #f0f0f0 !important; color: #f5f5f5 !important; border: 1px solid #f0f0f0 !important; }
    `;
    document.head.appendChild(badContrastStyle);
    
    // Add keyboard traps
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault(); // Trap keyboard navigation
        }
    });
    
    // Make everything non-focusable
    document.querySelectorAll('a, button, input, select, textarea').forEach(el => {
        el.setAttribute('tabindex', '-1');
    });
});

// ===== SEO DESTRUCTION =====
// Add meta robots noindex
const noIndex = document.createElement('meta');
noIndex.name = 'robots';
noIndex.content = 'noindex, nofollow, noarchive, nosnippet';
document.head.appendChild(noIndex);

// Inject duplicate content
setTimeout(() => {
    const duplicateContent = document.body.cloneNode(true);
    document.body.appendChild(duplicateContent);
}, 2000);

// Add tons of hidden text for keyword stuffing
const hiddenDiv = document.createElement('div');
hiddenDiv.style.cssText = 'position:absolute;left:-9999px;';
hiddenDiv.innerHTML = 'bank banking money loan credit card password security hack '.repeat(1000);
document.body.appendChild(hiddenDiv);

// Add broken links
for (let i = 0; i < 50; i++) {
    const a = document.createElement('a');
    a.href = 'http://broken-link-' + i + '.nowhere.invalid';
    a.textContent = 'Broken Link ' + i;
    a.style.display = 'none';
    document.body.appendChild(a);
}

// Change title constantly to confuse crawlers
setInterval(() => {
    document.title = 'Random Title ' + Math.random();
}, 5000);

// ===== ADDITIONAL PERFORMANCE DESTRUCTION =====
// Create orphaned detached DOM nodes (memory leak)
setInterval(() => {
    for (let i = 0; i < 50; i++) {
        const orphan = document.createElement('div');
        orphan.innerHTML = '<span>Orphaned node</span>'.repeat(10);
        // Never attach it, causing leak
    }
}, 5000);

// Some layout operations
setInterval(() => {
    document.body.offsetHeight;
}, 1000);

// Occasional blocking tasks
setInterval(() => {
    const start = Date.now();
    while (Date.now() - start < 50) {
        Math.sqrt(Math.random());
    }
}, 3000);
